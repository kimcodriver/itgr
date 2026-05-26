import { NextResponse } from "next/server";
import { rsc } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

export async function POST() {
  const sb = await rsc();
  const { data } = await sb.auth.getUser();
  await logEvent({
    action: "session.signout",
    actorId: data.user?.id, actorEmail: data.user?.email,
  });
  await sb.auth.signOut();
  return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4040"));
}
