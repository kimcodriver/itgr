/**
 * Email confirmation / password reset callback.
 * Handles links from Supabase Auth email templates.
 *
 * Flow:
 *   /api/auth/callback?token_hash=...&type=signup|recovery&next=/...
 */
import { NextResponse, type NextRequest } from "next/server";
import { rsc } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "signup" | "recovery" | "email_change" | "invite" | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  const sb = await rsc();

  // Newer Supabase flow (PKCE) uses ?code=
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`);
    const { data } = await sb.auth.getUser();
    if (data.user) {
      await logEvent({
        action: type === "recovery" ? "session.signin" : "session.signup",
        actorId: data.user.id, actorEmail: data.user.email,
      });
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Legacy flow uses ?token_hash= + ?type=
  if (tokenHash && type) {
    const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`);
    const { data } = await sb.auth.getUser();
    if (data.user) {
      await logEvent({
        action: type === "recovery" ? "session.signin" : "session.signup",
        actorId: data.user.id, actorEmail: data.user.email,
      });
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent("ลิงก์ไม่ถูกต้องหรือหมดอายุ")}`);
}
