/**
 * OAuth callback — exchange code for session, enforce domain, log sign-in.
 * Self-audit: C2-13 (access permission control), C5-59 (2FA via Google).
 */
import { NextResponse, type NextRequest } from "next/server";
import { rsc } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (!code) return NextResponse.redirect(`${origin}/sign-in?error=missing-code`);

  const sb = await rsc();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error?.message || "exchange-failed")}`);

  const domain = (data.user.email || "").split("@")[1]?.toLowerCase();
  const allowed = (process.env.ALLOWED_EMAIL_DOMAIN || "autocorp.co.th").toLowerCase();
  if (domain !== allowed) {
    await sb.auth.signOut();
    return NextResponse.redirect(`${origin}/sign-in?error=domain-not-allowed`);
  }

  await logEvent({
    action: "session.signin",
    actorId: data.user.id, actorEmail: data.user.email,
    targetKind: "auth", targetId: data.user.id,
  });

  // Update last_sign_in_at (for control C2-20)
  await sb.from("profiles").update({ last_sign_in_at: new Date().toISOString() }).eq("id", data.user.id);

  return NextResponse.redirect(`${origin}${next}`);
}
