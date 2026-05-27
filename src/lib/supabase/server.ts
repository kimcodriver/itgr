/**
 * Supabase client used by the BFF (server-side only).
 *
 * Single client: admin() with service_role key — bypasses RLS. Since the BFF
 * is the only client (browser never talks to Supabase directly), the security
 * boundary lives at the BFF layer (server actions + route handlers).
 *
 * Self-audit:
 *  - C2-23: service_role key stays in server env, never sent to browser.
 *  - C5-52: privileged cloud access; key rotated quarterly per runbook.
 *  - C8-89: RLS still deny-by-default for anon, in case key leaks.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function admin() {
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}
