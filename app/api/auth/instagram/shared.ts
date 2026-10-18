import { NextResponse, type NextRequest } from "next/server";
import { OPEN_COOKIE, OPEN_COOKIE_OPTIONS } from "@/lib/supabase/middleware";

export const INSTAGRAM_STATE_COOKIE = "dos_ig_state";

/** Back to Home with one word for its toast (`ig=connected` or `ig_error=…`).
 *
 *  ⚠ A DOCUMENT LOAD OF `/` GOES TO DISCOVER (the proxy, 18 Oct 2026) — and the
 *  return from Instagram IS a document load. So this spends the same one-shot
 *  marker onboarding's finish uses, or the person would land on Discover and
 *  never see their tick appear. */
export function homeWithWord(request: NextRequest, word: Record<string, string>): NextResponse {
  const url = new URL("/", request.url);
  for (const [k, v] of Object.entries(word)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.set(OPEN_COOKIE, "1", OPEN_COOKIE_OPTIONS);
  res.cookies.set(INSTAGRAM_STATE_COOKIE, "", { path: "/api/auth/instagram", maxAge: 0 });
  return res;
}
