import { InstagramError, exchangeCode, instagramConfig, whoIs } from "@/lib/instagram/oauth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { connectInstagram } from "@/repositories/instagram";

/** WHAT THE CALLBACK DOES WITH INSTAGRAM'S CODE (18 Oct 2026): code → token →
 *  "which account is this" → recorded against the person who pressed the
 *  button. The token lives for the length of this function and no longer.
 *
 *  Resolves to the connected username, or throws an Error whose message is a
 *  sentence the person can act on — never a token, never a stack. */
export async function connectInstagramFromCode(input: { userId: string; code: string; redirectUri: string }): Promise<string> {
  const cfg = instagramConfig();
  if (!cfg) throw new Error("Instagram is not switched on yet");
  try {
    const token = await exchangeCode(cfg, input.redirectUri, input.code);
    const account = await whoIs(token);
    await connectInstagram(createSupabaseAdminClient(), { userId: input.userId, ...account });
    return account.username;
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
