/**
 * Middleware — refresh session cookie on every request.
 * Self-audit: C2-13 (access control consistent across pages).
 *
 * The (auth) public pages do not require sign-in; all other pages do.
 * Page-level requireUser() does the final redirect.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/api/auth"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res;

  const sb = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: Array<{ name: string; value: string; options: import("@supabase/ssr").CookieOptions }>) =>
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  });
  // Refresh the session cookie. Failures are ignored — page-level requireUser handles redirects.
  await sb.auth.getUser();

  // Redirect unauthenticated users away from protected pages
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"));
  if (!isPublic) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      const signin = req.nextUrl.clone();
      signin.pathname = "/sign-in";
      signin.searchParams.set("next", path + (req.nextUrl.search || ""));
      return NextResponse.redirect(signin);
    }
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
