import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/features/auth/components/OnboardingForm";
import { googleAvatarUrl, googleFullName } from "@/lib/auth/googleIdentity";
import { ONBOARDING_COOKIE } from "@/lib/auth/onboarding";
import { NAME_MAX } from "@/lib/constants/names";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HERE_COOKIE, nearestCity, parsePoint } from "@/lib/geo/here";
import { amIPlatformAdmin } from "@/repositories/admin";
import { findDiscoverCities } from "@/repositories/cities";
import { findProfileById } from "@/repositories/profiles";

/** Onboarding — four screens for a person, five for an organization since R16
 *  added the photos (prototype 3781-3943). A person with a profile is
 *  sent to Home UNLESS they are still in the door: the first screen creates the
 *  row (the photo, styles and links are written onto it), and every server
 *  action after that refetches this route — so "a row exists" alone would end
 *  the flow at the photo. The cookie says the flow is still running, and the
 *  form resumes from whatever the row already holds. */
export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  const profile = await findProfileById(supabase, user.id);
  const inFlight = (await cookies()).get(ONBOARDING_COOKIE)?.value === "1";
  if (profile && !inFlight) {
    redirect("/");
  }
  /* a platform admin is ADMIN ONLY (9 Sep 2026): it never onboards as a person
     or an organization — the verification queue is its whole app */
  if (!profile && (await amIPlatformAdmin(supabase))) {
    redirect("/admin/verifications");
  }
  /* an organization is asked for no photos during onboarding any more (11 Sep
     2026) — the 5-10 photos belong to a STUDIO and are shown for one on the
     hub, after it exists. The read that fetched them went with the screen. */
  /* WHAT GOOGLE ALREADY TOLD US (27 Oct 2026). A sign-in that asks for nothing
     can still arrive knowing the person's name and face, so the form opens with
     both rather than with two empty fields — the name editable, the picture
     replaceable by the ＋ as always. The picture is NOT stored yet: it cannot
     be, because `set_my_profile_photo` refuses a person with no row, and the
     row is made by the first Continue. The form adopts it on that press. */
  const suggestedName = googleFullName(user)?.slice(0, NAME_MAX) ?? null;
  const googlePhotoUrl = googleAvatarUrl(user);
  /* WHERE THE PHONE SAID IT WAS (28 Oct 2026): the installed app asks for the
     location before sign-up, so the city can arrive filled in — the nearest
     city DanceOS serves, editable like everything else on the screen. Read only
     when the row has no city yet; nothing to look up otherwise. */
  const here = profile?.city ? null : parsePoint((await cookies()).get(HERE_COOKIE)?.value);
  const suggestedCity = here ? nearestCity(await findDiscoverCities(supabase), here) : null;

  return (
    <OnboardingForm
      userId={user.id}
      existing={profile}
      suggestedName={suggestedName}
      googlePhotoUrl={googlePhotoUrl}
      suggestedCity={suggestedCity}
    />
  );
}
