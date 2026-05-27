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

export async function seedControls() {
  const me = await requireAdmin();

  // Read the bundled audit_data.json. In Vercel, process.cwd() = the project root.
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

  const { error } = await admin().from("controls").upsert(rows, { onConflict: "no" });
  if (error) {
    redirect("/admin?error=" + encodeURIComponent(error.message));
  }

  await logEvent({
    action: "self.review",  // re-use existing action enum; describe in audit_log
    targetKind: "controls", targetId: "seed",
    after: { row_count: rows.length, source: "data/audit_data.json", by: me.email },
  });

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/controls");
  redirect("/admin?ok=" + encodeURIComponent(`Seed ${rows.length} controls สำเร็จ`));
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
