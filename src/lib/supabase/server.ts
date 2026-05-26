/**
 * Supabase clients used by the BFF (server-side only).
 *  - browser(): public anon, never expose mutations
 *  - rsc(): per-request cookie-bound client for Server Components / Server Actions
 *  - admin(): service-role bypass-RLS for audit_log inserts & seed
 *
 * Self-audit:
 *  - C5-52 / C5-59: service-role key is server-only, never sent to client.
 *  - C8-89: default-deny RLS; admin() used only for audit_log insert and snapshot creation.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Per-request user-bound client. Reads cookies set by /auth/callback.
export async function rsc() {
  const store = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options as CookieOptions));
        } catch {
          // RSCs cannot set cookies — set during Route Handlers / Server Actions only.
        }
      },
    },
  });
}

// Service-role client (server-only). Bypasses RLS — use sparingly.
export function admin() {
  return createClient(URL, SERVICE, { auth: { persistSession: false } });
}
