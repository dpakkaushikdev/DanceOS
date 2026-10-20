import type { SupabaseClient } from "@supabase/supabase-js";
import { InstagramError, exchangeCode, fetchInstagramPicture, instagramConfig, whoIs } from "@/lib/instagram/oauth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { connectInstagram, storeInstagramPictureAsAvatar } from "@/repositories/instagram";

/** WHAT THE CALLBACK DOES WITH INSTAGRAM'S CODE (18 Oct 2026): code → token →
 *  "which account is this" → recorded against the person who pressed the
 *  button. The token lives for the length of this function and no longer.
 *
 *  Resolves to the connected username and Instagram's picture address (null if
 *  it sent none), or throws an Error whose message is a sentence the person can
 *  act on — never a token, never a stack. */
export async function connectInstagramFromCode(input: { userId: string; code: string; redirectUri: string }): Promise<{ username: string; pictureUrl: string | null }> {
  const cfg = instagramConfig();
  if (!cfg) throw new Error("Instagram is not switched on yet");
  try {
    const token = await exchangeCode(cfg, input.redirectUri, input.code);
    const account = await whoIs(token);
    await connectInstagram(createSupabaseAdminClient(), { userId: input.userId, igUserId: account.igUserId, username: account.username, accountType: account.accountType });
    return { username: account.username, pictureUrl: account.pictureUrl };
  } catch (error: unknown) {
    if (error instanceof InstagramError) {
      /* the refusals a real person meets, in their words rather than Meta's */
      if (/authorization code|code has been used|expired/i.test(error.message)) throw new Error("That Instagram sign-in expired — tap the Instagram icon again");
      if (/redirect_uri/i.test(error.message)) throw new Error("Instagram is not set up for this address yet — tell DanceOS support");
      throw new Error(`Instagram said: ${error.message}`);
    }
    throw error instanceof Error ? error : new Error("Instagram could not be connected — try again");
  }
}

/** "USE YOUR INSTAGRAM PHOTO" (20 Oct 2026): the picture Instagram reported at
 *  connect time, fetched by the server from Instagram's CDN and stored as the
 *  person's profile photo through their own session. */
export async function adoptInstagramPicture(supabase: SupabaseClient, input: { userId: string; pictureUrl: string }): Promise<string> {
  try {
    const pic = await fetchInstagramPicture(input.pictureUrl);
    return await storeInstagramPictureAsAvatar(supabase, { userId: input.userId, ...pic });
  } catch (error: unknown) {
    throw error instanceof Error ? error : new Error("Could not use the Instagram picture — try again");
  }
}
