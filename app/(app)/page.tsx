import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { BROWSE_COOKIE } from "@/lib/auth/browseFirst";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findProfileById } from "@/repositories/profiles";
import { amIPlatformAdmin } from "@/repositories/admin";

/** `/` IS AN ADDRESS NOW, NOT A PAGE (28 Oct 2026).
 *
 *  The user: *"home and public profile are exactly the same so can combine these
 *  pages with edit only visible to the person who owns the page."* Home's content
 *  is the owner's version of `/person/{you}` (`OwnHome`), so this address forwards
 *  there — Rule 14: the installed app's start URL, onboarding's landing and every
 *  old link still land.
 *
 *  ⚠ The doors it always had are kept in the same order: signed out → Discover if
 *  the welcome screen's Skip was pressed, else sign-in; no profile yet → the
 *  admin's queue or onboarding (a person with no row has no page to go to).
 *  ⚠ Instagram's return (`?ig=` / `?ig_error=`) rides along — the Connect flow
 *  lands on `/` and the sheet that answers it is on the profile page.
 *  ⚠ The proxy still sends a FRESH open of `/` to Discover before this runs. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ ig?: string; ig_error?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect((await cookies()).get(BROWSE_COOKIE)?.value === "1" ? "/discover" : "/login");
  }
  const profile = await findProfileById(supabase, user.id);
  if (!profile) {
    redirect((await amIPlatformAdmin(supabase)) ? "/admin/verifications" : "/onboarding");
  }
  const word = await searchParams;
  const q = new URLSearchParams();
  if (word.ig) q.set("ig", word.ig);
  if (word.ig_error) q.set("ig_error", word.ig_error);
  redirect(`/person/${user.id}${q.size > 0 ? `?${q.toString()}` : ""}`);
}
