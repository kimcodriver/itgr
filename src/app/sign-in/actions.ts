"use server";
import { rsc } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function signInWithGoogle() {
  const sb = await rsc();
  const h = await headers();
  const origin = h.get("origin") || h.get("x-forwarded-host") || "http://localhost:4040";
  const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || "").trim();
  const queryParams: Record<string, string> = { prompt: "select_account" };
  // Only ask Google to pre-filter by hosted-domain if env explicitly sets it.
  if (allowedDomain) queryParams.hd = allowedDomain;

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/api/auth/callback`, queryParams },
  });
  if (error) throw new Error(error.message);
  if (data?.url) redirect(data.url);
}
