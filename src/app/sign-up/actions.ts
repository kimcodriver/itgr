"use server";
import { rsc } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "รหัสผ่านต้องยาว ≥ 8 ตัว"),
  confirm: z.string().min(8),
  display_name: z.string().max(80).optional().nullable(),
}).refine((d) => d.password === d.confirm, { message: "รหัสผ่านยืนยันไม่ตรงกัน", path: ["confirm"] });

export async function signUp(formData: FormData) {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    display_name: formData.get("display_name") || null,
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง";
    redirect("/sign-up?error=" + encodeURIComponent(msg));
  }

  const sb = await rsc();
  const h = await headers();
  const origin = h.get("origin") || h.get("x-forwarded-host") || "http://localhost:4040";
  const { data, error } = await sb.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.display_name || parsed.data.email.split("@")[0] },
      emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent("/")}`,
    },
  });
  if (error) redirect("/sign-up?error=" + encodeURIComponent(error.message));

  // If Supabase has email confirmation enabled, session is null and user must click link
  if (!data.session) {
    redirect("/sign-up?check=" + encodeURIComponent(parsed.data.email));
  }

  // Email confirmation disabled — user is signed in already
  await logEvent({
    action: "session.signup",
    actorId: data.user?.id, actorEmail: data.user?.email,
    targetKind: "auth", targetId: data.user?.id,
  });
  redirect("/");
}
