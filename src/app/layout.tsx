import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { setActor, clearActor } from "./actions";

export const metadata: Metadata = {
  title: "ITGR Audit Tracker",
  description: "FY2026 audit tracking — Marubeni Group ITGR FY2025",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  return (
    <html lang="th" data-theme="dark">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 p-4 backdrop-blur">
          <div className="glass rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap">
            <Link href="/" className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl grid place-items-center text-white font-black"
                   style={{ background: "radial-gradient(circle at 30% 30%, #818cf8, #4338ca 70%)" }}>IT</div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest t-dim">Marubeni ITGR FY2025</div>
                <div className="font-bold truncate">ITGR Audit Tracker</div>
              </div>
            </Link>
            <nav className="ml-auto flex gap-1 text-sm">
              {[
                ["/", "แดชบอร์ด"],
                ["/controls", "Controls"],
                ["/audit-log", "Audit Log"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="px-3 py-1.5 rounded-lg hover-bg t-muted">{label}</Link>
              ))}
            </nav>
            <form action={setActor} className="flex items-center gap-2 text-xs">
              <label className="t-dim text-[10px] uppercase tracking-widest">acting as</label>
              <input name="name" defaultValue={actor.name ?? ""} maxLength={80}
                placeholder="ระบุชื่อตัวเอง"
                className="px-2.5 py-1 rounded-lg glass-soft text-xs w-44" />
              <button className="px-2 py-1 rounded-md hover-bg text-[10px]">บันทึก</button>
              {actor.name && (
                <button formAction={clearActor} className="px-2 py-1 rounded-md hover-bg text-[10px] t-dim">ล้าง</button>
              )}
            </form>
          </div>
          {!actor.name && (
            <div className="max-w-md mx-auto mt-2 text-[11px] t-dim text-center">
              ⓘ ใส่ชื่อด้านบนเพื่อให้ audit log จดบันทึกว่าเป็นใคร — เป็น optional
            </div>
          )}
        </header>
        <main className="flex-1 px-4 pb-12">{children}</main>
        <footer className="px-4 pb-6 pt-2 text-[10px] t-dim text-center">
          Open access · Confidential — Internal use only · See <code>spec/self-audit.md</code> for compliance trail
        </footer>
      </body>
    </html>
  );
}
