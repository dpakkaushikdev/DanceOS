import { redirect } from "next/navigation";
import { StaffDesk } from "@/features/staff/components/StaffDesk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findSentInvites } from "@/repositories/invites";
import { findProfilePhotoPaths } from "@/repositories/profiles";
import { sentTeamAnsweredRow } from "@/features/inbox/inviteRows";
import { findBusinessPayLedger, findMyEarnings } from "@/repositories/payouts";
import { findMyMemberships, findBusinessTeam, runsTheBusiness } from "@/repositories/businesses";
import { findTeamClassCounts } from "@/repositories/teamMemberWork";
import { findRentReceivedByPerson, findRentVenues } from "@/repositories/rent";
import type { RenterSummary } from "@/features/staff/components/RentReceivedSummary";
import { loadOtherTeams } from "@/features/staff/server/loadOtherTeams";
import { otherTeamsWaiting } from "@/features/staff/otherTeams";

/* the clock, stamped once outside render (react-hooks/purity) */
const stampNowIso = (): string => new Date().toISOString();

export default async function BusinessStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { businessId } = await params;
  const asked = (await searchParams).show;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  /* ⚠ THE SEAT HAS TO RUN THE BUSINESS (28 Sep 2026). This was membership-only,
     so a visiting teacher who had accepted one class read the whole roster —
     every colleague's name and seat, every invite the studio had sent, and the
     ledger of what it had paid each of them. `MEMBER_POWER_NOTE` never claimed
     that, which is what makes it a gate rather than a new rule. ⚠ The role rides
     the guard's own query now, so the separate `findMyMembershipRole` is gone. */
  const seat = (await findMyMemberships(supabase)).find((m) => m.business.id === businessId);
  if (!seat || !runsTheBusiness(seat.memberRole)) {
    redirect("/business");
  }
  const business = seat.business;
  const myRole = seat.memberRole;

  /* ⚠ WHO MAY REMOVE ANOTHER OWNER is read by the Member Detail page now
     (4 Oct 2026): the Manage sheet moved there, so this desk no longer asks */
  /* ⚠ EVERY INVITE THE DESK HAS SENT (11 Oct 2026): the pending ones are the
     WAITING rows, the answered ones the head's Answered sheet, as on Classes */
  const [team, sent, ledger] = await Promise.all([
    findBusinessTeam(supabase, businessId),
    findSentInvites(supabase, businessId),
    /* WHAT THIS BUSINESS HAS PAID ITS PEOPLE (19 Sep 2026, the user: "able to pay
       them, track payment history"). One read for the whole desk — every row
       carries its `userId`, so a person's history is that list filtered, rather
       than a query per person opened. It fails soft: a Team desk must not break
       over a money read. */
    findBusinessPayLedger(supabase, businessId, stampNowIso()).catch(() => null),
  ]);
  /* each member's Classes figure (4 Oct 2026, the user: "Paid Payments and Classes
     for - Team Member Cards") — the Member Detail page's own rule, one batch for
     the desk; a failed read draws no figure rather than a wrong one */
  /* the person asked wears their own picture (12 Oct 2026) — one read for every
     invite the desk sent; an address-only invite has no person and keeps initials */
  const faces = await findProfilePhotoPaths(supabase, sent.map((i) => i.userId ?? "")).catch(() => ({}) as Record<string, string | null>);
  const faceOf = (i: (typeof sent)[number]) => (i.userId ? (faces[i.userId] ?? null) : null);
  const invites = sent.filter((i) => i.status === "pending").map((i) => ({ ...i, photoPath: faceOf(i) }));
  const answered = sent.flatMap((i) => {
    const row = sentTeamAnsweredRow(i, faceOf(i));
    return row ? [row] : [];
  });
  /* ⚠ MY TEAM · ARTIST TEAMS (11 Oct 2026, the user: "Team section to have two
     columns My Team … and Artist Teams which manages team invites from artist").
     Only on the viewer's OWN artist page — a studio's desk is its team alone,
     and a studio's invitations are answered on the Studios hub. */
  const ownArtistPage = business.type === "artist_page" && myRole === "owner";
  /* WHAT STUDIOS PAY YOU sits on this column too (18 Oct 2026, moved here from
     Earnings) — what OTHER businesses paid this artist, their own left out */
  const owned = ownArtistPage
    ? (await findMyMemberships(supabase).catch(() => [])).filter((m) => m.memberRole === "owner").map((m) => m.business.id)
    : [];
  const [classCounts, artistData, paidToYou, rentVenues, rentReceived] = await Promise.all([
    findTeamClassCounts(supabase, businessId, team.map((m) => m.userId)).catch(() => null),
    ownArtistPage ? loadOtherTeams(supabase, user.id) : Promise.resolve(null),
    ownArtistPage ? findMyEarnings(supabase, user.id, stampNowIso(), owned).catch(() => null) : Promise.resolve(null),
    /* RENT (18 Oct 2026): an artist pays the studios that hold its classes from
       Other Teams; a studio reads the rent it was paid on its own Team desk */
    ownArtistPage ? findRentVenues(supabase, businessId).catch(() => []) : Promise.resolve([]),
    business.type === "studio" && myRole === "owner" ? findRentReceivedByPerson(supabase, businessId).catch(() => []) : Promise.resolve([]),
  ]);
  /* ⚠ RENT RECEIVED, ONE LINE PER RENTER (19 Oct 2026, the user: "rent received
     in studio should also be handled inside the person whom it is received
     from"). The payments live on that person's page — their Member Detail Rent
     column when they are on this team, the renter page when not. */
  const onTeam = new Set(team.map((m) => m.userId));
  const renterMap = new Map<string, RenterSummary>();
  for (const p of rentReceived) {
    const person = p.recordedBy && onTeam.has(p.recordedBy) ? p.recordedBy : null;
    let r = renterMap.get(p.payerBusinessId);
    if (!r) {
      r = {
        payerBusinessId: p.payerBusinessId,
        payerName: p.payerName,
        count: 0,
        paidInr: 0,
        href: person ? `/business/${businessId}/staff/${person}?show=rent` : `/business/${businessId}/renters/${p.payerBusinessId}`,
      };
      renterMap.set(p.payerBusinessId, r);
    }
    r.count += 1;
    if (p.status === "done") r.paidInr += p.amountInr;
  }
  const renters = [...renterMap.values()].sort((a, b) => b.paidInr - a.paidInr || a.payerName.localeCompare(b.payerName));
  /* `?show=artists` is the column's name before 18 Oct 2026 — Rule 14 */
  const wantsOther = asked === "other" || asked === "artists";

  return (
    <StaffDesk
      businessId={businessId}
      businessName={business.name}
      businessType={business.type}
      team={team}
      invites={invites}
      answered={answered}
      payments={ledger?.payouts ?? []}
      payLedger={myRole === "owner" ? ledger : null}
      paidToYou={paidToYou}
      rentVenues={rentVenues}
      renters={renters}
      classCounts={classCounts ? Object.fromEntries(classCounts) : null}
      // asking and removing are the owner's alone (§10.9); everyone else reads
      isOwner={myRole === "owner"}
      meUserId={user.id}
      otherTeams={artistData ? { data: artistData, stayOn: `/business/${businessId}/staff?show=other` } : null}
      initialColumn={wantsOther || (asked === undefined && artistData && otherTeamsWaiting(artistData) > 0) ? "other" : "mine"}
    />
  );
}
