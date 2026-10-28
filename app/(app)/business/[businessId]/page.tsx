import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyMemberships, runsTheBusiness } from "@/repositories/businesses";

/** /business/{businessId} — AN ADDRESS NOW, NOT A PAGE (28 Oct 2026).
 *
 *  It was ONE STUDIO'S HOME (14 Sep 2026). The user: *"home and public profile are
 *  exactly the same so can combine these pages with edit only visible to the
 *  person who owns the page"* — so the studio's own page is `/studio/{id}` for
 *  the people who run it, and this forwards there (Rule 14: every notification,
 *  bookmark and desk link that names it still lands). `?edit=1` rides along.
 *  The desks under `/business/{id}/…` are unchanged.
 *
 *  ⚠ The two other doors it always had are kept: an artist page's register is
 *  the Manage segment of Your classes, and a seat that does not run the place
 *  (faculty, an assistant — R55) goes back to the hub. */
export default async function StudioHomeAddress({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { businessId } = await params;
  const edit = (await searchParams).edit === "1";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const memberships = await findMyMemberships(supabase);
  const membership = memberships.find((m) => m.business.id === businessId);
  if (!membership || !runsTheBusiness(membership.memberRole)) {
    redirect("/business");
  }
  if (membership.business.type !== "studio") {
    redirect("/my-classes?show=manage");
  }
  redirect(`/studio/${businessId}${edit ? "?edit=1" : ""}`);
}
