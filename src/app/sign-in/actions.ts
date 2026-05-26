"use server";
import { rsc } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function signInWithGoogle() {
  const sb = await rsc();
  const h = await headers();
  const origin = h.get("origin") || h.get("x-forwarded-host") || "http://localhost:4040";
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        hd: process.env.ALLOWED_EMAIL_DOMAIN || "autocorp.co.th",
        prompt: "select_account",
      },
    },
  });
  if (error) throw new Error(error.message);
  if (data?.url) redirect(data.url);
}
