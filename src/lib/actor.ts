/**
 * Actor identification — no login required.
 *
 * Anyone with the URL can use the app. To get *some* attribution in the audit
 * log we read a self-declared name from a cookie (set by the small "Acting as:"
 * input in the header). It's honor-system, but combined with IP + UA captured
 * by logEvent() gives enough forensic signal for an internal tool.
 *
 * Self-audit:
 *  - C7-75 (logs): still captures action + IP + UA + cookie name. Note that
 *    actor identity is unverified — see CR5 in spec/self-audit.md.
 */
import { cookies } from "next/headers";

export const ACTOR_COOKIE = "itgr_actor";

export async function getActor(): Promise<{ name: string | null }> {
  const store = await cookies();
  const raw = store.get(ACTOR_COOKIE)?.value || "";
  const name = raw.trim().slice(0, 80) || null;
  return { name };
}
