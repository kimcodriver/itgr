"use server";
import { requireAdmin } from "@/lib/auth";
import { admin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type RawRecord = {
  no: number;
  cat: string;
  cat_th: string;
  cat_short: string;
  cat_short_th: string;
  name: string;
  name_th?: string;
  question: string;
  standards: string;
  evidence_req?: string;
  article?: string;
  risk: string;
  qtype?: string;
  note_file?: string;
};

/**
 * Parse the ITGR Appendix F template text into individual evidence items.
 * Splits by newline, strips leading bullet markers (①②③ etc.), trims.
 */
function parseEvidenceTemplate(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n+/)
    .map(line => line.replace(/^[\s①②③④⑤⑥⑦⑧⑨⑩・·•\-*]+/, "").trim())
    .filter(line => line.length > 2)
    .slice(0, 10);
}

export async function seedControls() {
  const me = await requireAdmin();
  const sb = admin();

  const dataPath = resolve(process.cwd(), "data/audit_data.json");
  let parsed: { records: RawRecord[] };
  try {
    parsed = JSON.parse(readFileSync(dataPath, "utf-8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "อ่าน data/audit_data.json ไม่ได้";
    redirect("/admin?error=" + encodeURIComponent(msg));
  }

  const rows = parsed.records.map(r => ({
    no: r.no,
    category: r.cat,
    category_short: r.cat_short,
    category_th: r.cat_th,
    category_short_th: r.cat_short_th,
    name: r.name,
    name_th: r.name_th ?? null,
    question: r.question,
    standards: r.standards,
    evidence_req: r.evidence_req ?? null,
    article: r.article ?? null,
    risk: r.risk,
    qtype: r.qtype ?? null,
    note_file: r.note_file ?? null,
  }));

  // Insert in small batches so a constraint failure on a single row doesn't
  // silently kill the rest of the batch. (Supabase upsert error includes the
  // row that broke — capture it in the redirect message.)
  const BATCH = 25;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await sb.from("controls").upsert(slice, { onConflict: "no" });
    if (error) {
      const firstNo = slice[0]?.no;
      const lastNo = slice[slice.length - 1]?.no;
      redirect("/admin?error=" + encodeURIComponent(`Seed ล้มเหลวที่ batch #${firstNo}–${lastNo}: ${error.message}`));
    }
    inserted += slice.length;
  }

  // Verify what's actually in the DB now
  const { count: actualCount } = await sb.from("controls").select("*", { count: "exact", head: true });
  const { data: nums } = await sb.from("controls").select("no");
  const present = new Set((nums ?? []).map(r => r.no));
  const expected = parsed.records.map(r => r.no);
  const missing = expected.filter(n => !present.has(n));

  await logEvent({
    action: "self.review",
    targetKind: "controls", targetId: "seed",
    after: { attempted: rows.length, db_count: actualCount, missing, source: "data/audit_data.json", by: me.email },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/controls");
  revalidatePath("/mindmap");

  if (missing.length > 0) {
    redirect("/admin?error=" + encodeURIComponent(`Seed เสร็จแต่ DB มีแค่ ${actualCount}/96 · controls ที่ขาด: #${missing.join(", #")}`));
  }
  redirect("/admin?ok=" + encodeURIComponent(`Seed ${rows.length} controls สำเร็จ · DB มี ${actualCount} แถว`));
}

/** Wipe ALL controls + cascade delete their evidence_links, then re-seed.
 *  For when the DB is in a known-bad state. */
export async function wipeAndReseedControls() {
  const me = await requireAdmin();
  const sb = admin();

  // Delete all controls (FK ON DELETE CASCADE on evidence_links removes their evidence)
  // Use a always-true filter (no >= 0) since supabase-js requires a filter on delete.
  const { error: delErr } = await sb.from("controls").delete().gte("no", 0);
  if (delErr) redirect("/admin?error=" + encodeURIComponent(`Wipe ล้มเหลว: ${delErr.message}`));

  await logEvent({
    action: "self.review",
    targetKind: "controls", targetId: "wipe",
    before: { action: "delete all" },
    after: { by: me.email },
  });

  // Now re-seed via the same path
  return seedControls();
}

/**
 * Seed evidence templates from each control's ITGR Appendix F entry.
 *  - Removes all previously system-seeded rows (submitted_by='system') and re-creates.
 *  - drive_url left NULL — user attaches the actual Drive link later.
 *  - kind='legacy' (default for templates; can re-tag as 'new' when verifying).
 */
export async function seedEvidenceTemplates() {
  const me = await requireAdmin();

  // Confirm controls are seeded first
  const { count: controlCount } = await admin().from("controls").select("*", { count: "exact", head: true });
  if (!controlCount || controlCount < 96) {
    redirect("/admin?error=" + encodeURIComponent("กรุณา seed 96 controls ก่อน · ปุ่มข้างบน"));
  }

  const dataPath = resolve(process.cwd(), "data/audit_data.json");
  let parsed: { records: RawRecord[] };
  try {
    parsed = JSON.parse(readFileSync(dataPath, "utf-8"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "อ่าน data/audit_data.json ไม่ได้";
    redirect("/admin?error=" + encodeURIComponent(msg));
  }

  // Wipe previous system-seeded entries (idempotent re-run)
  await admin().from("evidence_links").delete().eq("submitted_by", "system");

  const rows: Array<{
    control_no: number; kind: "legacy"; drive_url: null;
    title: string; note: string; submitted_by: string;
  }> = [];
  for (const r of parsed.records) {
    const items = parseEvidenceTemplate(r.evidence_req);
    for (const item of items) {
      rows.push({
        control_no: r.no,
        kind: "legacy",
        drive_url: null,
        title: item.slice(0, 200),
        note: "Seeded จาก ITGR Appendix F (evidence_req template) — รอแนบ Drive link",
        submitted_by: "system",
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await admin().from("evidence_links").insert(rows);
    if (error) redirect("/admin?error=" + encodeURIComponent(error.message));
  }

  // Count how many controls now have ≥1 evidence row
  const { data: covered } = await admin()
    .from("evidence_links").select("control_no").is("archived_at", null);
  const uniqCovered = new Set((covered ?? []).map(c => c.control_no)).size;

  await logEvent({
    action: "self.review",
    targetKind: "evidence", targetId: "template-seed",
    after: { row_count: rows.length, controls_covered: uniqCovered, source: "ITGR Appendix F", by: me.email },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/controls");
  revalidatePath("/mindmap");
  redirect("/admin?ok=" + encodeURIComponent(`Seed ${rows.length} evidence templates · ครอบคลุม ${uniqCovered}/96 controls · ยังต้องแนบ Drive link`));
}

export async function clearEvidenceTemplates() {
  const me = await requireAdmin();
  const { count } = await admin()
    .from("evidence_links").select("*", { count: "exact", head: true })
    .eq("submitted_by", "system").is("verified_at", null);
  await admin().from("evidence_links").delete().eq("submitted_by", "system").is("verified_at", null);
  await logEvent({
    action: "self.review",
    targetKind: "evidence", targetId: "template-clear",
    after: { removed: count, by: me.email },
  });
  revalidatePath("/admin");
  revalidatePath("/controls");
  redirect("/admin?ok=" + encodeURIComponent(`ลบ template ที่ยังไม่ verified แล้ว ${count} รายการ`));
}

export async function promoteUser(formData: FormData) {
  const me = await requireAdmin();
  const userId = String(formData.get("user_id"));
  if (!userId) redirect("/admin?error=" + encodeURIComponent("user_id ไม่ถูกต้อง"));

  const { data: before } = await admin().from("profiles").select("email,role").eq("id", userId).maybeSingle();
  const { error } = await admin().from("profiles").update({ role: "admin" }).eq("id", userId);
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message));

  await logEvent({
    action: "user.role.change",
    targetKind: "profile", targetId: userId,
    before, after: { email: before?.email, role: "admin", by: me.email },
  });
  revalidatePath("/admin");
  redirect("/admin?ok=" + encodeURIComponent(`Promote ${before?.email} เป็น admin สำเร็จ`));
}

export async function demoteUser(formData: FormData) {
  const me = await requireAdmin();
  const userId = String(formData.get("user_id"));
  if (!userId) redirect("/admin?error=" + encodeURIComponent("user_id ไม่ถูกต้อง"));
  if (userId === me.id) redirect("/admin?error=" + encodeURIComponent("demote ตัวเองไม่ได้"));

  // Safety: prevent demoting the last remaining admin
  const { count: adminCount } = await admin()
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if ((adminCount ?? 0) <= 1) {
    redirect("/admin?error=" + encodeURIComponent("ต้องมี admin อย่างน้อย 1 คน — demote ทุกคนไม่ได้"));
  }

  const { data: before } = await admin().from("profiles").select("email,role").eq("id", userId).maybeSingle();
  const { error } = await admin().from("profiles").update({ role: "member" }).eq("id", userId);
  if (error) redirect("/admin?error=" + encodeURIComponent(error.message));

  await logEvent({
    action: "user.role.change",
    targetKind: "profile", targetId: userId,
    before, after: { email: before?.email, role: "member", by: me.email },
  });
  revalidatePath("/admin");
  redirect("/admin?ok=" + encodeURIComponent(`Demote ${before?.email} เป็น member สำเร็จ`));
}
