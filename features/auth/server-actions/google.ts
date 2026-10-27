"use server";

import { fetchGooglePicture } from "@/lib/auth/googleAvatar";
import { googleAvatarUrl } from "@/lib/auth/googleIdentity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { storeRemoteAvatar } from "@/repositories/avatars";

/** "USE YOUR GOOGLE PHOTO" (27 Oct 2026) — the twin of `adoptInstagramPicture`
 *  (services/instagramConnect.ts), for the picture Google puts on the identity
 *  when somebody signs in with it.
 *
 *  ⚠ THE ADDRESS IS READ FROM THE SESSION, NEVER FROM THE CALLER. The browser
 *  does not get to say which picture to fetch: a URL in a form field would turn
 *  this into a request-forgery tool pointed at whatever the page named (Rule 9
 *  — never trust the frontend). Supabase wrote the address onto the identity
 *  when it verified Google's token, so that is the only one trusted here, and
 *  `fetchGooglePicture` still checks it is on Google's own CDN before fetching.
 *
 *  ⚠ CALLED AFTER ONBOARDING'S FIRST CONTINUE, never before:
 *  `set_my_profile_photo` refuses a person who has no `profiles` row yet.
 *
 *  A failure is NOT fatal to onboarding — the person can always pick their own
 *  picture — so this answers a sentence rather than throwing, and the caller
 *  leaves them on the screen with the ＋ still there. */
export async function adoptGooglePictureAction(): Promise<{ path: string | null; error: string | null }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { path: null, error: "Sign in first" };

  const raw = googleAvatarUrl(user);
  if (!raw) return { path: null, error: "Google sent no picture — add your own" };

  try {
    const pic = await fetchGooglePicture(raw);
    const path = await storeRemoteAvatar(supabase, { userId: user.id, ...pic });
    return { path, error: null };
  } catch (error: unknown) {
    return {
      path: null,
      error: error instanceof Error ? error.message : "Could not use your Google picture — add your own",
    };
  }
}
