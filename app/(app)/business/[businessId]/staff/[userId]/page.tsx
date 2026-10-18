import { notFound, redirect } from "next/navigation";
import { TeamMemberPage, parseEarnPeriod, type TeamMemberShow } from "@/features/staff/components/TeamMemberPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findBusinessPayLedger, findPersonPayHistory } from "@/repositories/payouts";
import { findClassesHeldByRenter, findRenters, findRentReceivedByPerson } from "@/repositories/rent";
import type { HeldClass } from "@/features/staff/components/RentReceivedList";
import { findDisputesFor, latestByTarget } from "@/repositories/disputes";
import type { RentPayment } from "@/types/payout";
import { findTeamMemberWork } from "@/repositories/teamMemberWork";
import { findMyMemberships, findBusinessTeam, runsTheBusiness } from "@/repositories/businesses";
import { findPrincipalOwner } from "@/repositories/invites";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ONE PERSON ON THIS TEAM — their payments, their stats and how their classes
 *  went here (29 Sep 2026 as the payment history; 3 Oct 2026 as the team
 *  member's own page, the user: *"should have payment details, artist stats and
 *  performance for that team"*). `?show=payments|stats|performance`.
 *
 *  ⚠ THE OWNER'S ALONE, and re-checked here rather than trusted from the card.
 *  `runsTheBusiness` lets a manager onto the Team desk (28 Sep 2026, R55/R56)
 *  and what somebody is PAID is the owner's. A URL is a request, never an
 *  authority. */
export default async function TeamMemberRoute({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string; userId: string }>;
  searchParams: Promise<{ show?: string; period?: string }>;
}) {
  const [{ businessId, userId }, { show: asked, period: askedPeriod }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(businessId) || !UUID_RE.test(userId)) {
    notFound();
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const seat = (await findMyMemberships(supabase)).find((m) => m.business.id === businessId);
  if (!seat || !runsTheBusiness(seat.memberRole) || seat.memberRole !== "owner") {
    redirect(`/business/${businessId}/staff`);
  }

  /* ⚠ THE PERSON COMES OFF THE TEAM, NOT OFF THE PAYMENTS — somebody paid
     nothing yet has no payout row to read a name from */
  const [team, history, principalOwnerId] = await Promise.all([
    findBusinessTeam(supabase, businessId),
    findPersonPayHistory(supabase, businessId, userId),
    /* the Manage pill's Remove on an owner (30 Sep 2026's rule, moved here with
       the sheet on 4 Oct 2026); fails soft — a null simply draws no Remove */
    findPrincipalOwner(supabase, businessId).catch(() => null),
  ]);
  const member = team.find((m) => m.userId === userId);
  if (!member) {
    notFound();
  }
  const now = new Date();
  const isStudio = seat.business.type === "studio";
  const [work, ledger, rentIn, renting] = await Promise.all([
    findTeamMemberWork(supabase, businessId, userId, now, {
      businessName: seat.business.name,
      memberName: member.name,
      memberPhoto: member.avatarPath,
    }),
    /* the To settle column — this person's row of the desk's own ledger, so the
       page and the card's Pay sheet list the same sessions; fails soft */
    findBusinessPayLedger(supabase, businessId, now.toISOString()).catch(() => null),
    /* RENT RECEIVED FROM THIS PERSON (19 Oct 2026) — rent their artist page paid
       this studio, recorded by them; a studio's alone */
    isStudio ? findRentReceivedByPerson(supabase, businessId).catch(() => []) : Promise.resolve([]),
    /* ⚠ THE RENT COLUMN IS DRAWN WHENEVER THEIR PAGE HOLDS CLASSES HERE (19 Oct
       2026, the user: "rent received for studio team section should be inside
       team detail for that specific person") — not only once a payment exists */
    isStudio ? findRenters(supabase, businessId).catch(() => []) : Promise.resolve([]),
  ]);
  const personLedger = ledger?.people.find((p) => p.userId === userId) ?? null;
  const pages = new Map<string, string>();
  for (const r of renting) if (r.ownerUserId === userId) pages.set(r.payerBusinessId, r.payerName);
  for (const p of rentIn) if (p.recordedBy === userId && !pages.has(p.payerBusinessId)) pages.set(p.payerBusinessId, p.payerName);
  const rent: Array<{ payerName: string; payments: RentPayment[]; classes: HeldClass[] }> = await Promise.all(
    [...pages.entries()].map(async ([payerId, payerName]) => ({
      payerName,
      payments: rentIn.filter((p) => p.payerBusinessId === payerId),
      classes: await findClassesHeldByRenter(supabase, businessId, payerId, now.toISOString()).catch(() => []),
    }))
  );
  const disputes = Object.fromEntries(
    latestByTarget(
      await findDisputesFor(supabase, {
        payoutIds: history.payouts.map((p) => p.id),
        rentPaymentIds: rent.flatMap((r) => r.payments.map((p) => p.id)),
      })
    )
  );

  /* ⚠ an old `?show=performance` lands on Stats, which holds it now, and an old
     `?show=payments` on Paid (whose key is still "earnings"), which holds the
     payments (4 Oct 2026); `?show=paid` is the column's new name */
  const show: TeamMemberShow =
    asked === "stats" || asked === "performance"
      ? "stats"
      : asked === "classes"
        ? "classes"
        : asked === "settle"
          ? "settle"
          : asked === "rent" && rent.length > 0
            ? "rent"
            : "earnings";
  return (
    <TeamMemberPage
      businessId={businessId}
      businessName={seat.business.name}
      businessType={seat.business.type}
      member={member}
      history={history}
      work={work}
      ledger={personLedger}
      rent={rent}
      show={show}
      period={parseEarnPeriod(askedPeriod)}
      meUserId={user.id}
      principalOwnerId={principalOwnerId}
      disputes={disputes}
    />
  );
}
