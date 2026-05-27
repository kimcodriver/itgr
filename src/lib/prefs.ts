/**
 * User preferences — language + theme, persisted via cookies (server-readable)
 * and mirrored to localStorage by the client toggle component.
 *
 * Theme = stored preference (light | dark | system).
 * Effective theme = resolved to (light | dark) for the `data-theme` attribute.
 * "system" defers to prefers-color-scheme, resolved at boot by an inline script.
 */
import { cookies } from "next/headers";

export type Lang = "th" | "en";
export type ThemePref = "light" | "dark" | "system";
export type Prefs = { lang: Lang; theme: ThemePref };

const LANG_COOKIE = "itgr_lang";
const THEME_COOKIE = "itgr_theme";

export async function getPrefs(): Promise<Prefs> {
  const store = await cookies();
  const lang = store.get(LANG_COOKIE)?.value === "en" ? "en" : "th";
  const themeRaw = store.get(THEME_COOKIE)?.value;
  const theme: ThemePref =
    themeRaw === "light" || themeRaw === "dark" || themeRaw === "system" ? themeRaw : "system";
  return { lang, theme };
}

export const PREFS_COOKIE_NAMES = { lang: LANG_COOKIE, theme: THEME_COOKIE };
