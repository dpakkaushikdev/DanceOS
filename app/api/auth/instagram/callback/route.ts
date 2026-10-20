import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { INSTAGRAM_CALLBACK_PATH } from "@/lib/instagram/oauth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { connectInstagramFromCode } from "@/services/instagramConnect";
import { INSTAGRAM_STATE_COOKIE, homeWithWord } from "../shared";

/** WHERE INSTAGRAM SENDS THE PERSON BACK (18 Oct 2026). Must be listed exactly
 *  under the Instagram app's Business login settings → OAuth redirect URIs.
 *
 *  ⚠ Rule 9 (auth): nothing is connected unless the `state` Instagram returns
 *  matches the one this browser was given by /start AND the signed-in person is
 *  the one who asked for it — a link crafted elsewhere, or opened by somebody
 *  else, connects nothing. */
const params = z.object({
  code: z.string().min(1).max(2000).optional(),
  state: z.string().regex(/^[0-9a-f]{48}$/).optional(),
  error: z.string().max(200).optional(),
  error_reason: z.string().max(200).optional(),
});

export async function GET(request: NextRequest) {
  const parsed = params.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return homeWithWord(request, { ig_error: "Instagram sent back something this app cannot read — try again" });
  const { code, state, error, error_reason } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const [wantState, wantUser] = (request.cookies.get(INSTAGRAM_STATE_COOKIE)?.value ?? "").split(":");
  if (!state || !wantState || state !== wantState || wantUser !== user.id) {
    return homeWithWord(request, { ig_error: "That Instagram sign-in was not started here — tap the Instagram icon again" });
  }

  /* the person pressed Cancel, or Instagram turned the account away (a personal
     account cannot use Instagram Login) */
  if (error || !code) {
    return homeWithWord(request, {
      ig_error: error_reason === "user_denied" ? "Instagram was not connected" : "Instagram did not connect — it works with Creator and Business accounts",
    });
  }

  try {
    const { username, pictureUrl } = await connectInstagramFromCode({
      userId: user.id,
      code,
      redirectUri: new URL(INSTAGRAM_CALLBACK_PATH, request.nextUrl.origin).toString(),
    });
    revalidatePath("/");
    revalidatePath(`/person/${user.id}`);
    /* a picture longer than a cookie can hold is simply not offered */
    return homeWithWord(request, { ig: username }, pictureUrl && pictureUrl.length <= 3000 ? pictureUrl : null);
  } catch (e: unknown) {
    return homeWithWord(request, { ig_error: e instanceof Error ? e.message : "Instagram could not be connected — try again" });
  }
}
