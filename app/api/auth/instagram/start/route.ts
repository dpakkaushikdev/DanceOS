import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { INSTAGRAM_CALLBACK_PATH, authorizeUrl, instagramConfig } from "@/lib/instagram/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { INSTAGRAM_STATE_COOKIE, homeWithWord } from "../shared";

/** THE INSTAGRAM ICON'S DOOR (18 Oct 2026). A plain link, so the phone can hand
 *  the next hop — instagram.com/oauth/authorize — to the Instagram app when it
 *  is installed, which is what makes it "the account on this phone".
 *
 *  ⚠ Rule 9 (auth): the `state` is a random value kept in an httpOnly cookie
 *  together with WHO asked, so the callback only ever connects the account to
 *  the person who pressed the button, in this browser, in the last ten minutes. */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const cfg = instagramConfig();
  if (!cfg) return homeWithWord(request, { ig_error: "Instagram is not switched on yet" });

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL(INSTAGRAM_CALLBACK_PATH, request.nextUrl.origin).toString();
  const res = NextResponse.redirect(authorizeUrl(cfg, redirectUri, state));
  res.cookies.set(INSTAGRAM_STATE_COOKIE, `${state}:${user.id}`, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    /* lax, not strict: the callback arrives as a top-level navigation FROM
       instagram.com, which a strict cookie would not ride */
    sameSite: "lax",
    path: "/api/auth/instagram",
    maxAge: 600,
  });
  return res;
}
