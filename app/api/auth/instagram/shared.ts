import { NextResponse, type NextRequest } from "next/server";
import { INSTAGRAM_PICTURE_COOKIE, INSTAGRAM_PICTURE_COOKIE_OPTIONS } from "@/lib/instagram/oauth";
import { OPEN_COOKIE, OPEN_COOKIE_OPTIONS } from "@/lib/supabase/middleware";

export const INSTAGRAM_STATE_COOKIE = "dos_ig_state";

/** Back to Home with one word for its toast (`ig=connected` or `ig_error=…`).
 *
 *  ⚠ A DOCUMENT LOAD OF `/` GOES TO DISCOVER (the proxy, 18 Oct 2026) — and the
 *  return from Instagram IS a document load. So this spends the same one-shot
 *  marker onboarding's finish uses, or the person would land on Discover and
 *  never see their tick appear. */
export function homeWithWord(request: NextRequest, word: Record<string, string>, pictureUrl: string | null = null): NextResponse {
  const url = new URL("/", request.url);
  for (const [k, v] of Object.entries(word)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.set(OPEN_COOKIE, "1", OPEN_COOKIE_OPTIONS);
  res.cookies.set(INSTAGRAM_STATE_COOKIE, "", { path: "/api/auth/instagram", maxAge: 0 });
  /* the picture rides along only on a connect that worked; any other return
     clears one left from before */
  res.cookies.set(INSTAGRAM_PICTURE_COOKIE, pictureUrl ?? "", { ...INSTAGRAM_PICTURE_COOKIE_OPTIONS, secure: request.nextUrl.protocol === "https:", maxAge: pictureUrl ? INSTAGRAM_PICTURE_COOKIE_OPTIONS.maxAge : 0 });
  return res;
}
