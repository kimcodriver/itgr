import type { Metadata } from "next";
import "./globals.css";
import { getUser } from "@/lib/auth";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Autocorp ITGR Audit Tracker",
  description: "FY2026 audit tracking — Marubeni Group ITGR FY2025",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="th" data-theme="dark">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 p-4 backdrop-blur">
          <div className="glass rounded-2xl px-5 py-3 flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl grid place-items-center text-white font-black"
                   style={{ background: "radial-gradient(circle at 30% 30%, #818cf8, #4338ca 70%)" }}>IT</div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest t-dim">Marubeni ITGR FY2025</div>
                <div className="font-bold truncate">Autocorp ITGR Audit Tracker</div>
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
            <div className="text-xs t-muted">
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="marker" style={{ background: "#10b981" }} />
                  <span className="truncate max-w-[200px]">{user.email}</span>
                  <span className="px-2 py-0.5 rounded-md glass-soft text-[10px] uppercase">{user.role.replace("_", " ")}</span>
                  <form action="/auth/signout" method="post">
                    <button type="submit" className="px-2 py-1 rounded-md hover-bg text-[10px]">ออก</button>
                  </form>
                </div>
              ) : (
                <Link href="/sign-in" className="px-3 py-1.5 rounded-lg hover-bg">เข้าสู่ระบบ</Link>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 pb-12">{children}</main>
        <footer className="px-4 pb-6 pt-2 text-[10px] t-dim text-center">
          Internal use only · Confidential · See <code>spec/self-audit.md</code> for compliance trail
        </footer>
      </body>
    </html>
  );
}
