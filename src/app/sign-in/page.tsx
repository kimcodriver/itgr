import { signInWithGoogle } from "./actions";

export const metadata = { title: "เข้าสู่ระบบ · Autocorp ITGR Tracker" };

export default function SignIn() {
  return (
    <div className="min-h-[70vh] grid place-items-center">
      <div className="glass rounded-3xl p-8 max-w-md text-center space-y-5">
        <div className="w-14 h-14 mx-auto rounded-2xl grid place-items-center text-white text-2xl font-black"
             style={{ background: "radial-gradient(circle at 30% 30%, #818cf8, #4338ca 70%)" }}>IT</div>
        <div>
          <div className="text-[10px] uppercase tracking-widest t-dim">Autocorp · Marubeni ITGR FY2025</div>
          <div className="text-xl font-bold">เข้าสู่ระบบเพื่อดูสถานะ Audit</div>
          <div className="text-xs t-muted mt-2">
            เฉพาะอีเมล <code>@autocorp.co.th</code> เท่านั้น (Google Workspace SSO)
          </div>
        </div>
        <form action={signInWithGoogle}>
          <button className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-3"
            style={{ background: "#fff", color: "#0f172a" }}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20H42V20H24v8h11.3C33.6 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.2 0-9.6-3-11.3-7.4l-6.6 5.1C9.4 39.7 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.5l6.2 5.2c-.4.4 6.6-4.8 6.6-14.7 0-1.3-.1-2.7-.4-4z"/>
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>
        </form>
        <div className="text-[10px] t-dim">
          การเข้าสู่ระบบและการกระทำใดๆ จะถูกบันทึกใน Audit Log (control C7-75 / C8-92)
        </div>
      </div>
    </div>
  );
}
