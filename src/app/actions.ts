"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTOR_COOKIE } from "@/lib/actor";

export async function setActor(formData: FormData) {
  const name = String(formData.get("name") || "").trim().slice(0, 80);
  const store = await cookies();
  if (!name) {
    store.delete(ACTOR_COOKIE);
  } else {
    store.set(ACTOR_COOKIE, name, {
      httpOnly: false, // readable in JS too for client niceties
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }
  revalidatePath("/", "layout");
}

export async function clearActor() {
  const store = await cookies();
  store.delete(ACTOR_COOKIE);
  revalidatePath("/", "layout");
}
