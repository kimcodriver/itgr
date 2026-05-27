"use client";
/**
 * Client toggle for language + theme.
 * - Theme: instant DOM update (set data-theme on <html>) + cookie persist.
 * - Language: cookie + router.refresh() so server components re-render.
 *
 * On mount, syncs localStorage → cookie in case a different device has
 * already chosen prefs that the server doesn't know yet.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Lang, ThemePref } from "@/lib/prefs";

const LANG_COOKIE = "itgr_lang";
const THEME_COOKIE = "itgr_theme";
const YEAR = 60 * 60 * 24 * 365;

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${YEAR};SameSite=Lax`;
}

function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export default function PrefsToggle({ lang, theme }: { lang: Lang; theme: ThemePref }) {
  const router = useRouter();

  useEffect(() => {
    // Pull from localStorage if it differs from cookie. localStorage wins.
    const lsLang = localStorage.getItem(LANG_COOKIE);
    const lsTheme = localStorage.getItem(THEME_COOKIE);
    let needRefresh = false;
    if ((lsLang === "th" || lsLang === "en") && lsLang !== lang) {
      setCookie(LANG_COOKIE, lsLang);
      needRefresh = true;
    }
    if ((lsTheme === "light" || lsTheme === "dark" || lsTheme === "system") && lsTheme !== theme) {
      setCookie(THEME_COOKIE, lsTheme);
      applyTheme(lsTheme);
      needRefresh = true;
    }
    // Track system color-scheme changes when in "system" mode
    const effective = lsTheme ?? theme;
    if (effective === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => applyTheme("system");
      mq.addEventListener?.("change", onChange);
      return () => mq.removeEventListener?.("change", onChange);
    }
    if (needRefresh) router.refresh();
  }, [lang, theme, router]);

  function changeLang(v: Lang) {
    localStorage.setItem(LANG_COOKIE, v);
    setCookie(LANG_COOKIE, v);
    router.refresh();
  }
  function changeTheme(v: ThemePref) {
    localStorage.setItem(THEME_COOKIE, v);
    setCookie(THEME_COOKIE, v);
    applyTheme(v);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="glass-soft rounded-xl p-1 flex gap-0.5" title="ธีม / Theme">
        {([
          ["light", "☀"], ["dark", "☾"], ["system", "⌘"],
        ] as [ThemePref, string][]).map(([v, ic]) => (
          <button key={v} onClick={() => changeTheme(v)}
            className={`px-2 py-1 text-xs rounded-lg ${theme === v ? "ring-1 ring-white/20" : "hover-bg t-muted"}`}
            style={theme === v ? { background: "var(--hover-bg)" } : undefined}
            aria-label={`theme ${v}`}>{ic}</button>
        ))}
      </div>
      <div className="glass-soft rounded-xl p-1 flex gap-0.5" title="ภาษา / Language">
        {(["en", "th"] as Lang[]).map(L => (
          <button key={L} onClick={() => changeLang(L)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${lang === L ? "ring-1 ring-white/20" : "hover-bg t-muted"}`}
            style={lang === L ? { background: "var(--hover-bg)" } : undefined}>
            {L.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
