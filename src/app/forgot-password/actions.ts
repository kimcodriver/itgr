"use server";
import { rsc } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

const schema = z.object({ email: z.string().email() });

export async function requestReset(formData: FormData) {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) redirect("/forgot-password?error=" + encodeURIComponent("Email ไม่ถูกต้อง"));

  const sb = await rsc();
  const h = await headers();
  const origin = h.get("origin") || h.get("x-forwarded-host") || "http://localhost:4040";
  const { error } = await sb.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });
  if (error) redirect("/forgot-password?error=" + encodeURIComponent(error.message));
  redirect("/forgot-password?sent=" + encodeURIComponent(parsed.data.email));
}
