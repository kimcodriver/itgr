/**
 * Audit-log writer — every state mutation in the BFF should call this.
 * Self-audit: C7-75 (log acquisition), C8-92 (detection of removal).
 *
 * Actor identity comes from the optional "Acting as" cookie (see actor.ts).
 * Unidentified actors get null actor_email + the IP/UA from request headers.
 */
import { admin } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { getActor } from "@/lib/actor";

export type AuditEvent = {
  action:
    | "evidence.submit" | "evidence.edit" | "evidence.archive"
    | "evidence.verify" | "evidence.reject"
    | "verdict.change" | "control.assign"
    | "snapshot.create"
    | "self.review";
  targetKind?: string | null;
  targetId?: string | number | null;
  before?: unknown;
  after?: unknown;
};

export async function logEvent(e: AuditEvent) {
  const h = await headers();
  const actor = await getActor();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = h.get("user-agent") ?? null;
  const { error } = await admin().from("audit_log").insert({
    actor_id: null,
    actor_email: actor.name,
    action: e.action,
    target_kind: e.targetKind ?? null,
    target_id: e.targetId != null ? String(e.targetId) : null,
    before: e.before ?? null,
    after: e.after ?? null,
    request_ip: ip,
    user_agent: ua,
  });
  if (error) {
    console.error("[audit-log insert failed]", error.message, e);
  }
}
