"use server";
import { rsc } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function signIn(formData: FormData) {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });
  if (!parsed.success) redirect("/sign-in?error=" + encodeURIComponent("ข้อมูลไม่ถูกต้อง"));

  const sb = await rsc();
  const { data, error } = await sb.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    redirect("/sign-in?error=" + encodeURIComponent(error?.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง"));
  }

  await logEvent({
    action: "session.signin",
    actorId: data.user.id, actorEmail: data.user.email,
    targetKind: "auth", targetId: data.user.id,
  });

  redirect(parsed.data.next || "/");
}
