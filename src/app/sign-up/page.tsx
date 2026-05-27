import Link from "next/link";
import { signUp } from "./actions";
import { Brand, Field, Banner } from "@/app/sign-in/page";

export const metadata = { title: "ลงทะเบียน · ITGR Audit Tracker" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string; check?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-[80vh] grid place-items-center">
      <div className="glass rounded-3xl p-8 max-w-md w-full space-y-5">
        <Brand />
        <div>
          <div className="text-xl font-bold">ลงทะเบียน</div>
          <div className="text-xs t-muted mt-1">สร้าง account ใหม่ — ผู้ลงทะเบียนคนแรกจะเป็น admin โดยอัตโนมัติ</div>
        </div>
        {sp.check && (
          <Banner kind="ok">
            ลงทะเบียนสำเร็จ · กรุณาเช็คอีเมล <b>{decodeURIComponent(sp.check)}</b> เพื่อยืนยัน
            <div className="mt-1 t-dim">ถ้า Supabase ของคุณปิด email confirmation ไว้ ระบบจะ sign in ให้อัตโนมัติ</div>
          </Banner>
        )}
        {sp.error && <Banner kind="err">{decodeURIComponent(sp.error)}</Banner>}
        <form action={signUp} className="space-y-3">
          <Field label="Email" name="email" type="email" required autoComplete="email" />
          <Field label="ชื่อแสดง (display name)" name="display_name" type="text" maxLength={80} placeholder="ระบุชื่อตัวเอง" />
          <Field label="Password (≥ 8 ตัว)" name="password" type="password" required autoComplete="new-password" minLength={8} />
          <Field label="ยืนยัน Password" name="confirm" type="password" required autoComplete="new-password" minLength={8} />
          <div className="text-[11px] t-dim">
            แนะนำ: รหัสผ่านยาว ≥ 12 ตัวอักษร ผสม uppercase/lowercase/ตัวเลข/สัญลักษณ์ (ตาม ITGR Appendix 2)
          </div>
          <button className="w-full py-2.5 rounded-xl font-semibold text-sm" style={{ background: "#10b981", color: "#062a1c" }}>
            ลงทะเบียน
          </button>
        </form>
        <div className="text-xs text-center">
          <Link href="/sign-in" className="t-muted hover:underline">มี account แล้ว? เข้าสู่ระบบ</Link>
        </div>
      </div>
    </div>
  );
}
