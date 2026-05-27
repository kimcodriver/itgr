import { redirect } from "next/navigation";
import { resetPassword } from "./actions";
import { rsc } from "@/lib/supabase/server";
import { Brand, Field, Banner } from "@/app/sign-in/page";

export const metadata = { title: "ตั้งรหัสผ่านใหม่ · ITGR Audit Tracker" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;

  // User must already have a session (created by /api/auth/callback after clicking the reset link).
  const sb = await rsc();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/sign-in?error=" + encodeURIComponent("ลิงก์ reset หมดอายุ · ขอใหม่ที่ลืมรหัสผ่าน"));

  return (
    <div className="min-h-[80vh] grid place-items-center">
      <div className="glass rounded-3xl p-8 max-w-md w-full space-y-5">
        <Brand />
        <div>
          <div className="text-xl font-bold">ตั้งรหัสผ่านใหม่</div>
          <div className="text-xs t-muted mt-1">สำหรับ <b>{data.user.email}</b></div>
        </div>
        {sp.error && <Banner kind="err">{decodeURIComponent(sp.error)}</Banner>}
        <form action={resetPassword} className="space-y-3">
          <Field label="Password ใหม่ (≥ 8 ตัว)" name="password" type="password" required autoComplete="new-password" minLength={8} />
          <Field label="ยืนยัน Password ใหม่" name="confirm" type="password" required autoComplete="new-password" minLength={8} />
          <button className="w-full py-2.5 rounded-xl font-semibold text-sm" style={{ background: "#10b981", color: "#062a1c" }}>
            ตั้งรหัสผ่านใหม่
          </button>
        </form>
      </div>
    </div>
  );
}
