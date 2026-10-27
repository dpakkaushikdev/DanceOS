import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/safeNext";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findProfileById } from "@/repositories/profiles";

/** WHERE GOOGLE COMES BACK TO (27 Oct 2026).
 *
 *  Google returns to Supabase (`{project}.supabase.co/auth/v1/callback`), which
 *  mints a PKCE `code` and forwards it here. This exchanges that code for a
 *  session and then makes the same fork every other way in makes: a person with
 *  no `profiles` row has not finished onboarding, and Home is not usable
 *  without one.
 *
 *  WHY THIS IS NOT `/auth/confirm`, WHICH ALREADY EXCHANGES A CODE. That route
 *  lands EMAILED links, and every sentence it can answer with is written for
 *  one — "That reset link could not be opened here", "ask for a new one". After
 *  a Google round trip those are nonsense, and the advice in them is wrong. The
 *  exchange is four lines; the messages are the reason for a second door.
 *
 *  THE EXCHANGE NEEDS THE `code_verifier` COOKIE that the browser set when the
 *  button was pressed, so it only completes in the browser that started the
 *  flow. Somebody who pastes this URL into another browser gets the refusal
 *  below rather than somebody else's session.
 *
 *  ⚠ `next` is a REQUEST, not an authority (Rule 9): `safeNext` keeps it to an
 *  in-app path, so this cannot be bent into an open redirect. Onboarding still
 *  comes first for an account that has none. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  /* Google's own refusals arrive this way — the commonest by far is the person
     pressing Cancel on the account chooser, which is not an error to shout
     about. `access_denied` is therefore answered with a quiet sentence. */
  const providerError = searchParams.get("error");
  const providerText = searchParams.get("error_description");
  if (providerError) {
    return bounce(
      request,
      providerError === "access_denied"
        ? "You cancelled that Google sign-in — tap Continue with Google to try again."
        : providerText ?? "Google could not sign you in — try again."
    );
  }

  if (!code) {
    return bounce(request, "Google did not finish that sign-in — tap Continue with Google to try again.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return bounce(
      request,
      "That sign-in could not be completed here — open DanceOS in the browser you started in, and tap Continue with Google again."
    );
  }

  const profile = await findProfileById(supabase, data.user.id);
  return NextResponse.redirect(
    new URL(profile ? (next ?? "/discover") : "/onboarding", request.url),
    /* 303: the browser arrived on a GET, and so must the landing — and the
       address bar must not keep a spent `code` to be re-opened later */
    { status: 303 }
  );
}

/** Back to the one screen that can start the whole thing again, carrying a
 *  sentence that says what to do. Built with the URL's own API rather than a
 *  hand-encoded string, so an em-dash and a space survive being read back. */
function bounce(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, { status: 303 });
}
