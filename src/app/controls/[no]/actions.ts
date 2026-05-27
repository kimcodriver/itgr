"use server";
/**
 * Server actions for control detail.
 * Every mutation calls logEvent which captures actor from the authenticated session + IP/UA.
 * Defensibility guard: cannot set verdict comply/partial without verified evidence.
 */
import { admin } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const evidenceSchema = z.object({
  control_no: z.coerce.number().int().min(1).max(96),
  drive_url: z.string().url().regex(/^https?:\/\/(drive|docs|sheets)\.google\.com\//, "Must be a Google Drive/Docs/Sheets URL"),
  kind: z.enum(["legacy", "new"]),
  title: z.string().max(200).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export async function submitEvidence(formData: FormData) {
  const user = await requireUser();
  const parsed = evidenceSchema.parse({
    control_no: formData.get("control_no"),
    drive_url: formData.get("drive_url"),
    kind: formData.get("kind"),
    title: formData.get("title") || null,
    note: formData.get("note") || null,
  });
  const { data, error } = await admin().from("evidence_links").insert({
    ...parsed,
    submitted_by: user.displayName || user.email,
  }).select().single();
  if (error) throw new Error(error.message);
  await logEvent({
    action: "evidence.submit",
    targetKind: "evidence", targetId: data.id,
    after: { control_no: parsed.control_no, kind: parsed.kind, drive_url: parsed.drive_url, title: parsed.title },
  });
  revalidatePath(`/controls/${parsed.control_no}`);
}

export async function archiveEvidence(formData: FormData) {
  const id = String(formData.get("id"));
  const { data: e } = await admin().from("evidence_links").select("*").eq("id", id).maybeSingle();
  if (!e) throw new Error("Not found");
  await admin().from("evidence_links").update({ archived_at: new Date().toISOString() }).eq("id", id);
  await logEvent({
    action: "evidence.archive",
    targetKind: "evidence", targetId: id,
    before: { drive_url: e.drive_url, control_no: e.control_no, kind: e.kind },
  });
  revalidatePath(`/controls/${e.control_no}`);
}

export async function verifyEvidence(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const { data: e } = await admin().from("evidence_links").select("control_no").eq("id", id).maybeSingle();
  if (!e) throw new Error("Not found");
  await admin().from("evidence_links").update({
    verified_by: user.displayName || user.email, verified_at: new Date().toISOString(),
    rejected_by: null, rejected_at: null, rejected_reason: null,
  }).eq("id", id);
  await logEvent({
    action: "evidence.verify",
    targetKind: "evidence", targetId: id,
  });
  revalidatePath(`/controls/${e.control_no}`);
}

// Attach (or update) the Drive URL on an evidence row that was seeded without one.
const attachSchema = z.object({
  id: z.string().uuid(),
  drive_url: z.string().url().regex(/^https?:\/\/(drive|docs|sheets)\.google\.com\//, "ต้องเป็น URL ของ drive/docs/sheets.google.com"),
});
export async function attachEvidenceUrl(formData: FormData) {
  const user = await requireUser();
  const parsed = attachSchema.parse({
    id: formData.get("id"),
    drive_url: formData.get("drive_url"),
  });
  const { data: before } = await admin().from("evidence_links")
    .select("control_no,drive_url,title").eq("id", parsed.id).maybeSingle();
  if (!before) throw new Error("Not found");
  await admin().from("evidence_links").update({ drive_url: parsed.drive_url }).eq("id", parsed.id);
  await logEvent({
    action: "evidence.edit",
    actorId: user.id, actorEmail: user.email,
    targetKind: "evidence", targetId: parsed.id,
    before: { drive_url: before.drive_url },
    after: { drive_url: parsed.drive_url, title: before.title },
  });
  revalidatePath(`/controls/${before.control_no}`);
}

export async function rejectEvidence(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const reason = String(formData.get("reason") || "").slice(0, 500) || "rejected";
  const { data: e } = await admin().from("evidence_links").select("control_no").eq("id", id).maybeSingle();
  if (!e) throw new Error("Not found");
  await admin().from("evidence_links").update({
    rejected_by: user.displayName || user.email, rejected_at: new Date().toISOString(), rejected_reason: reason,
  }).eq("id", id);
  await logEvent({
    action: "evidence.reject",
    targetKind: "evidence", targetId: id, after: { reason },
  });
  revalidatePath(`/controls/${e.control_no}`);
}

const verdictSchema = z.object({
  control_no: z.coerce.number().int().min(1).max(96),
  verdict: z.enum(["comply", "partial", "non", "na"]),
  finding_th: z.string().max(2000).optional().nullable(),
  recommendation_th: z.string().max(2000).optional().nullable(),
});

export async function setVerdict(formData: FormData) {
  const parsed = verdictSchema.parse({
    control_no: formData.get("control_no"),
    verdict: formData.get("verdict"),
    finding_th: formData.get("finding_th") || null,
    recommendation_th: formData.get("recommendation_th") || null,
  });

  const { data: before } = await admin().from("controls").select("verdict,finding_th,recommendation_th").eq("no", parsed.control_no).maybeSingle();

  if (parsed.verdict === "comply" || parsed.verdict === "partial") {
    const { count } = await admin().from("evidence_links")
      .select("*", { count: "exact", head: true })
      .eq("control_no", parsed.control_no)
      .not("verified_at", "is", null)
      .is("archived_at", null);
    if (!count || count < 1) {
      throw new Error("ต้องมีหลักฐานที่ verified อย่างน้อย 1 รายการ ก่อนตั้งสถานะเป็น comply/partial");
    }
  }

  await admin().from("controls").update({
    verdict: parsed.verdict,
    finding_th: parsed.finding_th,
    recommendation_th: parsed.recommendation_th,
  }).eq("no", parsed.control_no);

  await logEvent({
    action: "verdict.change",
    targetKind: "control", targetId: parsed.control_no,
    before, after: parsed,
  });
  revalidatePath(`/controls/${parsed.control_no}`);
  revalidatePath("/");
}
