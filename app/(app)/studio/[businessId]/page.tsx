import { OwnStudioHome } from "@/features/businesses/components/OwnStudioHome";
import { PublicBusinessPage } from "@/features/profiles/components/PublicBusinessPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyMemberships, runsTheBusiness } from "@/repositories/businesses";

/** A STUDIO'S PAGE — ONE ADDRESS FOR EVERYBODY (28 Oct 2026, the user: "home and
 *  public profile are exactly the same so can combine these pages with edit only
 *  visible to the person who owns the page"). The people who RUN the studio (an
 *  owner or a manager — R55) get its own page with the pencil and the pictures'
 *  editors; everybody else, a stranger included, gets the public page.
 *  ⚠ The membership read is the caller's own seats (`user_id = auth.uid()`), so
 *  a stranger costs nothing extra. */
export default async function Page({ params, searchParams }: { params: Promise<{ businessId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { businessId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const memberships = await findMyMemberships(supabase).catch(() => []);
    const membership = memberships.find((m) => m.business.id === businessId);
    if (membership && runsTheBusiness(membership.memberRole) && membership.business.type === "studio") {
      /* `?edit=1` — Settings' "Edit studio" lands here with it (22 Sep 2026); the
         sheet is drawn only when the owner-only read came back */
      const editOpen = (await searchParams).edit === "1";
      return <OwnStudioHome userId={user.id} membership={membership} editOpen={editOpen} />;
    }
  }
  return <PublicBusinessPage businessId={businessId} expect="studio" />;
}
