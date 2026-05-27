import Link from "next/link";
import { requestReset } from "./actions";
import { Brand, Field, Banner } from "@/app/sign-in/page";

export const metadata = { title: "ลืมรหัสผ่าน · ITGR Audit Tracker" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-[80vh] grid place-items-center">
      <div className="glass rounded-3xl p-8 max-w-md w-full space-y-5">
        <Brand />
        <div>
          <div className="text-xl font-bold">ลืมรหัสผ่าน</div>
          <div className="text-xs t-muted mt-1">กรอก email ที่ลงทะเบียนไว้ — เราจะส่งลิงก์ reset ไปให้</div>
        </div>
        {sp.sent && <Banner kind="ok">ส่งลิงก์ reset ไปที่ <b>{decodeURIComponent(sp.sent)}</b> แล้ว · กรุณาเช็คอีเมล</Banner>}
        {sp.error && <Banner kind="err">{decodeURIComponent(sp.error)}</Banner>}
        <form action={requestReset} className="space-y-3">
          <Field label="Email" name="email" type="email" required autoComplete="email" />
          <button className="w-full py-2.5 rounded-xl font-semibold text-sm" style={{ background: "#818cf8", color: "#fff" }}>
            ส่งลิงก์ reset
          </button>
        </form>
        <div className="text-xs text-center">
          <Link href="/sign-in" className="t-muted hover:underline">← กลับไป sign in</Link>
        </div>
      </div>
    </div>
  );
}
