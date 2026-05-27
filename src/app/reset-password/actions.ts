"use server";
import { rsc } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  password: z.string().min(8),
  confirm: z.string().min(8),
}).refine((d) => d.password === d.confirm, { message: "รหัสผ่านยืนยันไม่ตรง", path: ["confirm"] });

export async function resetPassword(formData: FormData) {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    redirect("/reset-password?error=" + encodeURIComponent(parsed.error.issues[0]?.message || "ข้อมูลไม่ถูกต้อง"));
  }
  const sb = await rsc();
  const { error } = await sb.auth.updateUser({ password: parsed.data.password });
  if (error) redirect("/reset-password?error=" + encodeURIComponent(error.message));
  await sb.auth.signOut();
  redirect("/sign-in?ok=reset");
}
