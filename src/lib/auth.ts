/**
 * Auth helpers used by Server Components and Server Actions.
 *
 * Self-audit: C2-13 (access permission control for important systems).
 *  - getUser() reads the cookie-bound session — never trusts a header or query.
 *  - requireUser() redirects unauthenticated callers to /sign-in.
 */
import { rsc, admin } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AppUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: "admin" | "member";
};

export async function getUser(): Promise<AppUser | null> {
  const sb = await rsc();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  // Profile is created automatically by the auth trigger (see 0002_auth.sql)
  const { data: p } = await admin()
    .from("profiles")
    .select("id,email,display_name,role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!p) return null;
  return {
    id: p.id,
    email: p.email,
    displayName: p.display_name,
    role: (p.role as "admin" | "member") ?? "member",
  };
}

export async function requireUser(): Promise<AppUser> {
  const u = await getUser();
  if (!u) redirect("/sign-in");
  return u;
}

export async function requireAdmin(): Promise<AppUser> {
  const u = await requireUser();
  if (u.role !== "admin") throw new Error("ต้องเป็น admin เท่านั้น");
  return u;
}
