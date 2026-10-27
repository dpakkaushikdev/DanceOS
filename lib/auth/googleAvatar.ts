/** GOOGLE'S PROFILE PICTURE (27 Oct 2026, Google sign-in).
 *
 *  The twin of `fetchInstagramPicture` (lib/instagram/oauth.ts), and it exists
 *  for the same reason: the SERVER fetches this address, so a planted address
 *  would make the server fetch whatever it named. The guards are therefore the
 *  same ones, checked BEFORE anything is fetched — https, Google's own picture
 *  CDN, no credentials in the URL and no port — and a redirect is refused
 *  rather than followed, because a redirect can lead off the CDN.
 *
 *  ⚠ The two are deliberately NOT one function. Instagram's speaks about
 *  Instagram in its refusals ("connect Instagram again to get a fresh one"),
 *  which is the whole value of the message to the person reading it. What is
 *  shared is the STORING, in `repositories/avatars.ts`. */

export const GOOGLE_PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type GooglePictureType = (typeof GOOGLE_PICTURE_TYPES)[number];
const PICTURE_MAX_BYTES = 5 * 1024 * 1024;

/** IS THIS ADDRESS GOOGLE'S OWN PICTURE SERVER? Google serves avatars from
 *  `lh3.googleusercontent.com` and its siblings; the whole `googleusercontent`
 *  domain is user content, which is exactly where an avatar lives. */
export function isGooglePicture(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      /(^|\.)googleusercontent\.com$/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

/** ASK GOOGLE FOR A BIGGER ONE. An OIDC `picture` claim arrives sized for a
 *  menu — `=s96-c`, 96px square — and the app draws the face at 112px and the
 *  profile header far larger, so the stock one lands soft. The size is a path
 *  suffix on googleusercontent, so a bigger crop costs nothing but this edit.
 *  A URL in any other shape is handed back untouched. */
export function googlePictureAtSize(raw: string, size = 512): string {
  return raw.replace(/=s\d+(-c)?$/, `=s${size}$1`);
}

/** The picture's bytes, or an Error carrying a sentence a person can act on.
 *  Anything that is not a JPEG, PNG or WebP under 5 MB is refused, as is a
 *  redirect and anything slower than ten seconds. */
export async function fetchGooglePicture(
  raw: string
): Promise<{ bytes: Uint8Array; type: GooglePictureType }> {
  if (!isGooglePicture(raw)) throw new Error("That picture is not on Google");
  const res = await fetch(googlePictureAtSize(raw), {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (res.status !== 200) throw new Error("Google's picture could not be fetched");
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!(GOOGLE_PICTURE_TYPES as readonly string[]).includes(type)) {
    throw new Error("Google sent a picture this app cannot use");
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > PICTURE_MAX_BYTES) {
    throw new Error("That Google picture is too large to use");
  }
  return { bytes, type: type as GooglePictureType };
}
