"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { disconnectInstagram } from "@/repositories/instagram";

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
