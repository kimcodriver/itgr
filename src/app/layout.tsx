import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { getPrefs } from "@/lib/prefs";
import { useT } from "@/lib/i18n";
import PrefsToggle from "./prefs-toggle";

export const metadata: Metadata = {
  title: "ITGR Audit Tracker",
  description: "FY2026 audit tracking — Marubeni Group ITGR FY2025",
};

// Inline script that runs before React hydration. Resolves "system" theme
// from prefers-color-scheme so the first paint matches user's OS.
const themeBootScript = `
(function() {
  try {
    var m = document.cookie.match(/(?:^|;\\s*)itgr_theme=([^;]+)/);
    var pref = m ? m[1] : 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  const prefs = await getPrefs();
  const t = useT(prefs.lang);

  // Server-side initial guess for data-theme; client boot script + PrefsToggle
  // will refine if cookie says 'system' and user OS prefers light.
  const initialTheme = prefs.theme === "system" ? "dark" : prefs.theme;

  return (
    <html lang={prefs.lang} data-theme={initialTheme}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
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
            {user && (
              <nav className="flex gap-1 text-sm flex-wrap">
                {[
                  ["/", t("nav.dashboard")],
                  ["/controls", t("nav.checklist")],
                  ["/mindmap", t("nav.mindmap")],
                  ["/audit-log", t("nav.auditlog")],
                  ...(user.role === "admin" ? [["/admin", t("nav.admin")]] : []),
                ].map(([href, label]) => (
                  <Link key={href} href={href} className="px-3 py-1.5 rounded-lg hover-bg t-muted">{label}</Link>
                ))}
              </nav>
            )}
            <div className="text-xs ml-auto flex items-center gap-2 flex-wrap">
              <PrefsToggle lang={prefs.lang} theme={prefs.theme} />
              {user ? (
                <>
                  <span className="marker" style={{ background: "#10b981" }} />
                  <div className="text-right leading-tight">
                    <div className="font-medium">{user.displayName || user.email}</div>
                    <div className="t-dim text-[10px]">
                      {user.email}
                      <span className="ml-2 px-1.5 py-0.5 rounded glass-soft uppercase tracking-widest text-[9px]"
                        style={{ color: user.role === "admin" ? "#f59e0b" : "var(--text-dim)" }}>{user.role}</span>
                    </div>
                  </div>
                  <form action="/api/auth/signout" method="post">
                    <button type="submit" className="px-2 py-1.5 rounded-md hover-bg text-xs">{t("nav.signout")}</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="px-3 py-1.5 rounded-lg hover-bg">{t("nav.signin")}</Link>
                  <Link href="/sign-up" className="px-3 py-1.5 rounded-lg" style={{ background: "#818cf8", color: "#fff" }}>{t("nav.signup")}</Link>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 pb-12">{children}</main>
        <footer className="px-4 pb-6 pt-2 text-[10px] t-dim text-center">{t("footer")}</footer>
      </body>
    </html>
  );
}
