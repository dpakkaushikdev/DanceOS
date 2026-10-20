import { z } from "zod";

/** INSTAGRAM LOGIN, THE THREE CALLS (18 Oct 2026).
 *
 *  The person taps the Instagram icon → `authorizeUrl` sends them to Instagram,
 *  which opens the Instagram app (or instagram.com) already signed in to the
 *  account on that phone → they press Allow → Instagram redirects to the
 *  callback with a one-time `code` → `exchangeCode` turns it into a short-lived
 *  token → `whoIs` asks Instagram which account that token belongs to. The
 *  token is never stored: the callback keeps the answer and drops the token.
 *
 *  ⚠ CREATOR AND BUSINESS ACCOUNTS ONLY. This is "Instagram API with Instagram
 *  Login"; the API that let any personal account sign in (Basic Display) was
 *  shut by Meta on 4 Dec 2024. A personal account reaches Instagram's own
 *  screen and is refused there — the callback turns that into a sentence.
 *
 *  ⚠ The Instagram APP ID is not the Meta app's ID: it is the one on the
 *  Instagram use case's "API setup with Instagram login" page, and so is the
 *  secret. The redirect URI must be listed, character for character, under
 *  Business login settings → OAuth redirect URIs on that same page. */

const GRAPH_VERSION = "v23.0";
const SCOPE = "instagram_business_basic";

export const INSTAGRAM_CALLBACK_PATH = "/api/auth/instagram/callback";

/** the picture Instagram reported at connect time, waiting for a yes or a no —
 *  httpOnly, set by the callback only, fifteen minutes (20 Oct 2026) */
export const INSTAGRAM_PICTURE_COOKIE = "dos_ig_pic";
export const INSTAGRAM_PICTURE_COOKIE_OPTIONS = { path: "/", maxAge: 900, httpOnly: true, sameSite: "lax" as const };

export interface InstagramConfig {
  appId: string;
  appSecret: string;
}

/** null when the keys are not set — the button is then not drawn at all.
 *  Server only: the secret must never reach a browser bundle. */
export function instagramConfig(): InstagramConfig | null {
  if (typeof window !== "undefined") throw new Error("instagramConfig must never run in the browser");
  const appId = process.env.INSTAGRAM_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  return appId && appSecret ? { appId, appSecret } : null;
}

export function authorizeUrl(cfg: InstagramConfig, redirectUri: string, state: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  /* straight to Instagram's own sign-in — never the "continue with Facebook" detour */
  url.searchParams.set("enable_fb_login", "0");
  return url.toString();
}

/* Instagram has answered in two shapes over the years — flat, and wrapped in
   `data: [...]` — so both are read */
const tokenFlat = z.object({ access_token: z.string().min(1), user_id: z.union([z.string(), z.number()]) });
const tokenWrapped = z.object({ data: z.array(tokenFlat).min(1) });
const errorShape = z.object({ error_message: z.string().optional(), error: z.object({ message: z.string() }).partial().optional() }).partial();

export class InstagramError extends Error {}

const failText = (raw: unknown, fallback: string) => {
  const e = errorShape.safeParse(raw);
  return (e.success && (e.data.error_message || e.data.error?.message)) || fallback;
};

export async function exchangeCode(cfg: InstagramConfig, redirectUri: string, code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    /* Instagram appends `#_` to the code it hands back; the fragment never
       reaches a server, but a code pasted by hand can carry it */
    code: code.replace(/#_$/, ""),
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body, signal: AbortSignal.timeout(10000), cache: "no-store" });
  const json: unknown = await res.json().catch(() => null);
  const flat = tokenFlat.safeParse(json);
  if (res.ok && flat.success) return flat.data.access_token;
  const wrapped = tokenWrapped.safeParse(json);
  if (res.ok && wrapped.success) return wrapped.data.data[0].access_token;
  throw new InstagramError(failText(json, `Instagram refused the sign-in (HTTP ${res.status})`));
}

const meShape = z.object({
  user_id: z.union([z.string(), z.number()]).transform(String),
  username: z.string().min(1),
  account_type: z.string().optional(),
  profile_picture_url: z.string().optional(),
});

export interface InstagramAccount {
  igUserId: string;
  username: string;
  accountType: string | null;
  /** Instagram's CDN address for the profile picture, when it sent one — offered,
   *  never taken without asking (`adoptInstagramPhotoAction`) */
  pictureUrl: string | null;
}

export async function whoIs(accessToken: string): Promise<InstagramAccount> {
  const url = new URL(`https://graph.instagram.com/${GRAPH_VERSION}/me`);
  url.searchParams.set("fields", "user_id,username,account_type,profile_picture_url");
  /* the token rides a header, not the address, so it is in no log line */
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000), cache: "no-store" });
  const json: unknown = await res.json().catch(() => null);
  const me = meShape.safeParse(json);
  if (res.ok && me.success) {
    const pic = me.data.profile_picture_url ?? null;
    return { igUserId: me.data.user_id, username: me.data.username, accountType: me.data.account_type ?? null, pictureUrl: pic && isInstagramPicture(pic) ? pic : null };
  }
  throw new InstagramError(failText(json, `Instagram did not say which account that was (HTTP ${res.status})`));
}

/** IS THIS ADDRESS INSTAGRAM'S OWN PICTURE SERVER (20 Oct 2026)? The picture is
 *  fetched by the SERVER, so the address is checked before anything is fetched:
 *  https, and a host under Instagram's or Facebook's CDN — never an address a
 *  page could have planted to make the server fetch something else. */
export function isInstagramPicture(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i.test(u.hostname);
  } catch {
    return false;
  }
}

const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type PictureType = (typeof PICTURE_TYPES)[number];
const PICTURE_MAX_BYTES = 5 * 1024 * 1024;

/** The profile picture's bytes, or an InstagramError with a sentence. A redirect
 *  is refused rather than followed (it could lead off the CDN), and so is
 *  anything that is not a JPEG, PNG or WebP under 5 MB. */
export async function fetchInstagramPicture(raw: string): Promise<{ bytes: Uint8Array; type: PictureType }> {
  if (!isInstagramPicture(raw)) throw new InstagramError("that picture is not on Instagram");
  const res = await fetch(raw, { redirect: "manual", signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (res.status !== 200) throw new InstagramError("Instagram's picture link has expired — connect Instagram again to get a fresh one");
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!(PICTURE_TYPES as readonly string[]).includes(type)) throw new InstagramError("Instagram sent a picture this app cannot use");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > PICTURE_MAX_BYTES) throw new InstagramError("That Instagram picture is too large to use");
  return { bytes, type: type as PictureType };
}
