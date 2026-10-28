import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyMemberships } from "@/repositories/businesses";
import { findProfileById } from "@/repositories/profiles";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { DeskHero, DOS_TOOLS, HueHead } from "@/features/businesses/components/biz-kit";
import { findMyArtistPlan } from "@/repositories/plans";
import { InviteHeadButtons } from "@/features/inbox/components/JoinInvites";
import { OtherTeams } from "@/features/staff/components/OtherTeams";
import { loadOtherTeams } from "@/features/staff/server/loadOtherTeams";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";

/** /team — the Team tile for everybody (11 Oct 2026, the user's answer "Team tile
 *  for everyone"). Somebody with an artist page of their own has a team, so they
 *  land on that page's desk on its Other Teams column; everybody else gets the
 *  Other Teams column alone (18 Oct 2026): the studios, artists and crews asking
 *  them on, and the teams they are already on. The Studios hub's Team column and
 *  the Crews hub's Member column forward here. */
export default async function TeamPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [profile, memberships] = await Promise.all([findProfileById(supabase, user.id), findMyMemberships(supabase)]);
  if (!profile) redirect("/onboarding");
  const ownPage = memberships.find((m) => m.memberRole === "owner" && m.business.type === "artist_page");
  if (ownPage) redirect(`/business/${ownPage.business.id}/staff?show=other`);

  /* ⚠ NO "PAID TO YOU" ON THIS LIST (19 Oct 2026, the user: "for users paid to
     you section should be inside the team you are a part of … payments should
     not be visible outside") — each team's Detail page has a Paid column */
  /* A plain user runs no team, so this page is only the teams they are ON — it
     reads "Teams I'm on" (28 Oct 2026). An artist whose page is not provisioned
     yet keeps "Team"; a failed plan read is read as a plain user. */
  const [data, plan] = await Promise.all([loadOtherTeams(supabase, user.id), findMyArtistPlan(supabase).catch(() => null)]);
  const isArtist = Boolean(plan?.active);
  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "0 var(--dos-gutter) 40px", boxSizing: "border-box" }}>
      <DeskTop style={{ paddingBottom: 4 }}>
        <div style={{ position: "relative", margin: "0 0 12px" }}>
          {isArtist ? <DeskHero tool="team" as="h1" margin="0" toggle={false} /> : <HueHead title="Teams I'm on" color={DOS_TOOLS.team.c} as="h1" />}
          <InviteHeadButtons
            answered={data.answered}
            answeredTestId="other-team-answered"
            answeredListTestId="other-team-answered-list"
            answeredLabel="Answered team invitations"
            settings={{ testId: "other-teams-settings", kinds: ["team", "crew"], off: data.inboxOff, title: "Team and crew invitations" }}
          />
        </div>
      </DeskTop>
      <DeskBody style={{ paddingBottom: 4 }}>
        <OtherTeams data={data} stayOn="/team" />
      </DeskBody>
    </div>
  );
}
