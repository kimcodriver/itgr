/**
 * Supabase clients used by the BFF (server-side only).
 *  - rsc(): per-request cookie-bound client for Server Components / Server Actions.
 *           Used to read the authenticated user's session.
 *  - admin(): service-role bypass-RLS for audit_log inserts + cross-user queries.
 *
 * Self-audit:
 *  - C2-23: service-role key stays in server env, never sent to browser.
 *  - C2-13: auth.uid() resolves only inside cookie-bound client.
 *  - C8-89: profiles RLS default-deny; controls/evidence_links accessed only via admin().
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function rsc() {
  const store = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: Array<{ name: string; value: string; options: CookieOptions }>) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // RSCs cannot set cookies — only Server Actions / Route Handlers can.
        }
      },
    },
  });
}

export function admin() {
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}
