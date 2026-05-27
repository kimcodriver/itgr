import { NextResponse, type NextRequest } from "next/server";
import { rsc } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const sb = await rsc();
  const { data } = await sb.auth.getUser();
  if (data.user) {
    await logEvent({
      action: "session.signout",
      actorId: data.user.id, actorEmail: data.user.email,
    });
  }
  await sb.auth.signOut();
  return NextResponse.redirect(new URL("/sign-in", req.url));
}
