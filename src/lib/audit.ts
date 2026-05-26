/**
 * Audit-log writer — every state mutation in the BFF should call this.
 * Self-audit: C7-75 (log acquisition for important systems), C8-92 (detection of removal).
 */
import { admin } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type AuditEvent = {
  action:
    | "session.signin" | "session.signout"
    | "evidence.submit" | "evidence.edit" | "evidence.archive"
    | "evidence.verify" | "evidence.reject"
    | "verdict.change" | "control.assign"
    | "user.invite" | "user.role.change" | "user.deactivate"
    | "snapshot.create"
    | "self.review";
  actorId?: string | null;
  actorEmail?: string | null;
  targetKind?: string | null;
  targetId?: string | number | null;
  before?: unknown;
  after?: unknown;
};

export async function logEvent(e: AuditEvent) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = h.get("user-agent") ?? null;
  const { error } = await admin().from("audit_log").insert({
    actor_id: e.actorId ?? null,
    actor_email: e.actorEmail ?? null,
    action: e.action,
    target_kind: e.targetKind ?? null,
    target_id: e.targetId != null ? String(e.targetId) : null,
    before: e.before ?? null,
    after: e.after ?? null,
    request_ip: ip,
    user_agent: ua,
  });
  if (error) {
    // Last-ditch: log to stderr; do not throw — never block the user flow on audit insert.
    console.error("[audit-log insert failed]", error.message, e);
  }
}
