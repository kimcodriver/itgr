/**
 * Auth helpers used by Server Actions and middleware.
 * Self-audit: C2-13 (access permission control for important systems).
 */
import { rsc } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Role = "audit_lead" | "it_engineer" | "observer";

export type AppUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: Role;
  active: boolean;
};

export async function getUser(): Promise<AppUser | null> {
  const sb = await rsc();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data: p } = await sb
    .from("profiles")
    .select("id,email,display_name,role,active")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!p || !p.active) return null;
  return {
    id: p.id, email: p.email, displayName: p.display_name,
    role: p.role as Role, active: p.active,
  };
}

export async function requireUser(): Promise<AppUser> {
  const u = await getUser();
  if (!u) redirect("/sign-in");
  return u;
}

export async function requireRole(...roles: Role[]): Promise<AppUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) {
    throw new Error(`Forbidden: requires one of [${roles.join(",")}] · current=${u.role}`);
  }
  return u;
}
