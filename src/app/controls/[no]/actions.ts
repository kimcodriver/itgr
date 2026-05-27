"use server";
/**
 * Server actions for control detail.
 * Every mutation calls logEvent which captures actor from the authenticated session + IP/UA.
 * Defensibility guard: cannot set verdict comply/partial without verified evidence.
 *
 * Error handling: each action wraps its work in try/catch and on failure redirects
 * back to the control page with a ?error=… query so the user sees a banner instead
 * of the generic "A server error occurred" page.
 */
import { admin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/** Run an action; on uncaught error redirect back to the control page with ?error=msg.
 *  Re-throws redirect signals (Next.js uses thrown sentinels for redirect/notFound). */
async function safeRun(controlNo: number | string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    // Next.js redirect/notFound throw special sentinels — let them bubble.
    if (err && typeof err === "object" && "digest" in err && typeof (err as { digest?: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[control action #${controlNo}] failed:`, msg, err);
    redirect(`/controls/${controlNo}?error=${encodeURIComponent(msg)}`);
  }
}

const evidenceSchema = z.object({
  control_no: z.coerce.number().int().min(1).max(96),
  drive_url: z.string().url().regex(/^https?:\/\/(drive|docs|sheets)\.google\.com\//, "ต้องเป็น URL ของ drive/docs/sheets.google.com"),
  kind: z.enum(["legacy", "new"]),
  title: z.string().max(200).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export async function submitEvidence(formData: FormData) {
  const controlNo = formData.get("control_no");
  await safeRun(String(controlNo), async () => {
    const user = await requireUser();
    const parsed = evidenceSchema.parse({
      control_no: controlNo,
      drive_url: formData.get("drive_url"),
      kind: formData.get("kind"),
      title: formData.get("title") || null,
      note: formData.get("note") || null,
    });
    const { data, error } = await admin().from("evidence_links").insert({
      ...parsed,
      submitted_by: user.displayName || user.email,
    }).select().single();
    if (error) throw new Error(`เพิ่ม evidence ไม่สำเร็จ: ${error.message}`);
    await logEvent({
      action: "evidence.submit",
      targetKind: "evidence", targetId: data.id,
      after: { control_no: parsed.control_no, kind: parsed.kind, drive_url: parsed.drive_url, title: parsed.title },
    });
    revalidatePath(`/controls/${parsed.control_no}`);
    redirect(`/controls/${parsed.control_no}?ok=${encodeURIComponent("เพิ่ม evidence สำเร็จ")}`);
  });
}

export async function archiveEvidence(formData: FormData) {
  const id = String(formData.get("id"));
  const { data: e } = await admin().from("evidence_links").select("control_no").eq("id", id).maybeSingle();
  const controlNo = e?.control_no ?? "";
  await safeRun(String(controlNo), async () => {
    if (!e) throw new Error("ไม่พบ evidence");
    const { error } = await admin().from("evidence_links").update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(`ลบ evidence ไม่สำเร็จ: ${error.message}`);
    await logEvent({
      action: "evidence.archive",
      targetKind: "evidence", targetId: id,
      before: { control_no: e.control_no },
    });
    revalidatePath(`/controls/${e.control_no}`);
  });
}

export async function verifyEvidence(formData: FormData) {
  const id = String(formData.get("id"));
  const { data: e } = await admin().from("evidence_links").select("control_no").eq("id", id).maybeSingle();
  const controlNo = e?.control_no ?? "";
  await safeRun(String(controlNo), async () => {
    const user = await requireUser();
    if (!e) throw new Error("ไม่พบ evidence");
    const { error } = await admin().from("evidence_links").update({
      verified_by: user.displayName || user.email, verified_at: new Date().toISOString(),
      rejected_by: null, rejected_at: null, rejected_reason: null,
    }).eq("id", id);
    if (error) throw new Error(`Verify ไม่สำเร็จ: ${error.message}`);
    await logEvent({ action: "evidence.verify", targetKind: "evidence", targetId: id });
    revalidatePath(`/controls/${e.control_no}`);
  });
}

const attachSchema = z.object({
  id: z.string().uuid(),
  drive_url: z.string().url().regex(/^https?:\/\/(drive|docs|sheets)\.google\.com\//, "ต้องเป็น URL ของ drive/docs/sheets.google.com"),
});
export async function attachEvidenceUrl(formData: FormData) {
  const id = String(formData.get("id"));
  const { data: before } = await admin().from("evidence_links").select("control_no,drive_url,title").eq("id", id).maybeSingle();
  const controlNo = before?.control_no ?? "";
  await safeRun(String(controlNo), async () => {
    const user = await requireUser();
    const parsed = attachSchema.parse({ id, drive_url: formData.get("drive_url") });
    if (!before) throw new Error("ไม่พบ evidence");
    const { error } = await admin().from("evidence_links").update({ drive_url: parsed.drive_url }).eq("id", parsed.id);
    if (error) throw new Error(`แนบ link ไม่สำเร็จ: ${error.message}`);
    await logEvent({
      action: "evidence.edit",
      actorId: user.id, actorEmail: user.email,
      targetKind: "evidence", targetId: parsed.id,
      before: { drive_url: before.drive_url },
      after: { drive_url: parsed.drive_url, title: before.title },
    });
    revalidatePath(`/controls/${before.control_no}`);
  });
}

export async function rejectEvidence(formData: FormData) {
  const id = String(formData.get("id"));
  const { data: e } = await admin().from("evidence_links").select("control_no").eq("id", id).maybeSingle();
  const controlNo = e?.control_no ?? "";
  await safeRun(String(controlNo), async () => {
    const user = await requireUser();
    const reason = String(formData.get("reason") || "").slice(0, 500) || "rejected";
    if (!e) throw new Error("ไม่พบ evidence");
    const { error } = await admin().from("evidence_links").update({
      rejected_by: user.displayName || user.email, rejected_at: new Date().toISOString(), rejected_reason: reason,
    }).eq("id", id);
    if (error) throw new Error(`Reject ไม่สำเร็จ: ${error.message}`);
    await logEvent({
      action: "evidence.reject",
      targetKind: "evidence", targetId: id, after: { reason },
    });
    revalidatePath(`/controls/${e.control_no}`);
  });
}

const verdictSchema = z.object({
  control_no: z.coerce.number().int().min(1).max(96),
  verdict: z.enum(["comply", "partial", "non", "na"]),
  finding_th: z.string().max(2000).optional().nullable(),
  recommendation_th: z.string().max(2000).optional().nullable(),
});

export async function setVerdict(formData: FormData) {
  const controlNoRaw = formData.get("control_no");
  await safeRun(String(controlNoRaw ?? ""), async () => {
    await requireUser();
    const parsed = verdictSchema.parse({
      control_no: controlNoRaw,
      verdict: formData.get("verdict"),
      finding_th: formData.get("finding_th") || null,
      recommendation_th: formData.get("recommendation_th") || null,
    });

    // Read previous state — used for audit log diff and as fallback if defensibility fails
    const { data: before, error: readErr } = await admin()
      .from("controls").select("verdict,finding_th,recommendation_th")
      .eq("no", parsed.control_no).maybeSingle();
    if (readErr) throw new Error(`อ่าน control ไม่สำเร็จ: ${readErr.message}`);
    if (!before) throw new Error(`ไม่พบ control #${parsed.control_no} — กรุณา seed ที่หน้า /admin ก่อน`);

    // Defensibility guard: comply/partial requires ≥1 verified evidence
    if (parsed.verdict === "comply" || parsed.verdict === "partial") {
      const { count, error: countErr } = await admin().from("evidence_links")
        .select("*", { count: "exact", head: true })
        .eq("control_no", parsed.control_no)
        .not("verified_at", "is", null)
        .is("archived_at", null);
      if (countErr) throw new Error(`ตรวจ evidence ไม่สำเร็จ: ${countErr.message}`);
      if (!count || count < 1) {
        throw new Error("ต้องมีหลักฐานที่ verified อย่างน้อย 1 รายการ ก่อนตั้งสถานะเป็น comply/partial");
      }
    }

    const { error: updErr } = await admin().from("controls").update({
      verdict: parsed.verdict,
      finding_th: parsed.finding_th,
      recommendation_th: parsed.recommendation_th,
    }).eq("no", parsed.control_no);
    if (updErr) throw new Error(`บันทึก verdict ไม่สำเร็จ: ${updErr.message}`);

    await logEvent({
      action: "verdict.change",
      targetKind: "control", targetId: parsed.control_no,
      before, after: parsed,
    });
    revalidatePath(`/controls/${parsed.control_no}`);
    revalidatePath("/");
    redirect(`/controls/${parsed.control_no}?ok=${encodeURIComponent("บันทึก verdict สำเร็จ")}`);
  });
}
