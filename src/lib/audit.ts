/**
 * Audit-log writer — every state mutation in the BFF should call this.
 * Self-audit: C7-75 (log acquisition), C8-92 (detection of removal).
 *
 * Actor identity comes from the authenticated session (Supabase Auth).
 */
import { admin } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { getUser } from "@/lib/auth";

export type AuditEvent = {
  action:
    | "session.signin" | "session.signout" | "session.signup"
    | "evidence.submit" | "evidence.edit" | "evidence.archive"
    | "evidence.verify" | "evidence.reject"
    | "verdict.change" | "control.assign"
    | "user.role.change"
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
  // Resolve actor from session if not provided explicitly.
  let actorId = e.actorId ?? null;
  let actorEmail = e.actorEmail ?? null;
  if (!actorId && !actorEmail) {
    const u = await getUser();
    if (u) { actorId = u.id; actorEmail = u.email; }
  }
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = h.get("user-agent") ?? null;
  const { error } = await admin().from("audit_log").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action: e.action,
    target_kind: e.targetKind ?? null,
    target_id: e.targetId != null ? String(e.targetId) : null,
    before: e.before ?? null,
    after: e.after ?? null,
    request_ip: ip,
    user_agent: ua,
  });
  if (error) console.error("[audit-log insert failed]", error.message, e);
}
