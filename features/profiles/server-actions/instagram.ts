"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { INSTAGRAM_PICTURE_COOKIE, isInstagramPicture } from "@/lib/instagram/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { disconnectInstagram } from "@/repositories/instagram";
import { adoptInstagramPicture } from "@/services/instagramConnect";

/** DISCONNECT INSTAGRAM (18 Oct 2026). No input to validate: the RPC acts on
 *  the caller's own connection and nobody else's. Connecting has no action —
 *  it is a link to /api/auth/instagram/start, so the phone can hand it to the
 *  Instagram app. */
export async function disconnectInstagramAction(): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  try {
    await disconnectInstagram(supabase);
    revalidatePath("/");
    revalidatePath(`/person/${user.id}`);
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not disconnect Instagram" };
  }
}

/** "USE THIS PHOTO" (20 Oct 2026). Takes NO input: the picture is the one the
 *  callback stored in an httpOnly cookie from Instagram's own answer, so the
 *  page cannot point the server at an address of its choosing — and the address
 *  is checked against Instagram's CDN again before anything is fetched. */
export async function adoptInstagramPhotoAction(): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const jar = await cookies();
  const pictureUrl = jar.get(INSTAGRAM_PICTURE_COOKIE)?.value ?? "";
  if (!isInstagramPicture(pictureUrl)) return { error: "That Instagram picture is no longer on offer — connect Instagram again" };
  try {
    await adoptInstagramPicture(supabase, { userId: user.id, pictureUrl });
    jar.delete(INSTAGRAM_PICTURE_COOKIE);
    revalidatePath("/");
    revalidatePath(`/person/${user.id}`);
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not use the Instagram picture" };
  }
}

/** "NOT NOW" — the offer is dropped and not asked again on this return */
export async function dismissInstagramPhotoAction(): Promise<{ error: string | null }> {
  (await cookies()).delete(INSTAGRAM_PICTURE_COOKIE);
  return { error: null };
}
