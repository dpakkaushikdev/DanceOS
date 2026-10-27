import type { User } from "@supabase/supabase-js";

/** WHAT GOOGLE KNOWS ABOUT THE PERSON WHO JUST SIGNED IN (27 Oct 2026).
 *
 *  Read in two places — the onboarding page, which prefills the form, and
 *  `adoptGooglePictureAction`, which fetches the picture — so the rule for
 *  WHERE to look lives here once.
 *
 *  ⚠ IT IS IN TWO PLACES, AND WHICH ONE DEPENDS ON HOW THE ACCOUNT WAS MADE.
 *  `user_metadata` carries it for an account whose FIRST identity was Google.
 *  When Google is LINKED to an account that already existed — which is every
 *  account on this project predating 27 Oct 2026, all of them email and
 *  password — Supabase leaves the original `user_metadata` alone and the name
 *  and picture live only on the google identity's own `identity_data`. Reading
 *  one and not the other works perfectly in testing with a fresh account and
 *  then does nothing for every real user. Both are read, identity first. */

function googleIdentityData(user: User): Record<string, unknown> | null {
  const google = user.identities?.find((i) => i.provider === "google");
  return (google?.identity_data as Record<string, unknown> | undefined) ?? null;
}

/** the first of the candidates that is a non-empty string, trimmed */
function firstString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}

/** Google's picture for this person, or null. Still only a CLAIM at this point:
 *  `fetchGooglePicture` re-checks that the address is on Google's own CDN
 *  before the server fetches a byte of it. */
export function googleAvatarUrl(user: User): string | null {
  const id = googleIdentityData(user);
  return firstString(id?.avatar_url, id?.picture, user.user_metadata?.avatar_url, user.user_metadata?.picture);
}

/** The name on the Google account. This is what onboarding puts in the name
 *  field before the person types — the one thing a sign-in that asks for
 *  nothing can still offer. The caller trims it to `NAME_MAX`. */
export function googleFullName(user: User): string | null {
  const id = googleIdentityData(user);
  return firstString(id?.full_name, id?.name, user.user_metadata?.full_name, user.user_metadata?.name);
}

/** DID THIS PERSON COME IN THROUGH GOOGLE AT ALL? Onboarding asks, because a
 *  Google account's picture stands in for the one it would otherwise demand. */
export function hasGoogleIdentity(user: User): boolean {
  return Boolean(user.identities?.some((i) => i.provider === "google"));
}
