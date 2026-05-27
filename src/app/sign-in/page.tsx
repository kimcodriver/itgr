import Link from "next/link";
import { signIn } from "./actions";

export const metadata = { title: "เข้าสู่ระบบ · ITGR Audit Tracker" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string; ok?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="min-h-[80vh] grid place-items-center">
      <div className="glass rounded-3xl p-8 max-w-md w-full space-y-5">
        <Brand />
        <div>
          <div className="text-xl font-bold">เข้าสู่ระบบ</div>
          <div className="text-xs t-muted mt-1">ใส่ email + password ที่ลงทะเบียนไว้</div>
        </div>
        {sp.ok === "signup" && <Banner kind="ok">ลงทะเบียนสำเร็จ · กรุณา sign in</Banner>}
        {sp.ok === "reset" && <Banner kind="ok">เปลี่ยนรหัสผ่านสำเร็จ · เข้าสู่ระบบใหม่ได้เลย</Banner>}
        {sp.error && <Banner kind="err">{decodeURIComponent(sp.error)}</Banner>}
        <form action={signIn} className="space-y-3">
          <input type="hidden" name="next" value={sp.next || "/"} />
          <Field label="Email" name="email" type="email" required autoComplete="email" />
          <Field label="Password" name="password" type="password" required autoComplete="current-password" minLength={8} />
          <button className="w-full py-2.5 rounded-xl font-semibold text-sm" style={{ background: "#818cf8", color: "#fff" }}>
            เข้าสู่ระบบ
          </button>
        </form>
        <div className="flex items-center justify-between text-xs">
          <Link href="/forgot-password" className="t-muted hover:underline">ลืมรหัสผ่าน?</Link>
          <Link href="/sign-up" className="t-muted hover:underline">ยังไม่มี account? ลงทะเบียน</Link>
        </div>
      </div>
    </div>
  );
}

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-2xl grid place-items-center text-white text-lg font-black"
        style={{ background: "radial-gradient(circle at 30% 30%, #818cf8, #4338ca 70%)" }}>IT</div>
      <div>
        <div className="text-[10px] uppercase tracking-widest t-dim">Marubeni ITGR FY2025</div>
        <div className="font-bold">ITGR Audit Tracker</div>
      </div>
    </div>
  );
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest t-dim mb-1">{label}</span>
      <input {...rest} className="w-full px-3 py-2 rounded-lg glass-soft text-sm" />
    </label>
  );
}

export function Banner({ kind, children }: { kind: "ok" | "err"; children: React.ReactNode }) {
  const color = kind === "ok" ? "#10b981" : "#f43f5e";
  return (
    <div className="text-xs px-3 py-2 rounded-lg"
      style={{ background: color + "18", color, border: `1px solid ${color}55` }}>{children}</div>
  );
}
