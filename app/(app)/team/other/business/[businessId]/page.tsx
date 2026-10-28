import { notFound, redirect } from "next/navigation";
import { OtherBusinessDetail, type OtherBusinessSeat, type OtherBusinessShow } from "@/features/staff/components/OtherTeamDetail";
import { RentToPay } from "@/features/payouts/components/RentPanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findArtistPageOwners, findMyMemberships } from "@/repositories/businesses";
import { findProfileById } from "@/repositories/profiles";
import { findTeamMemberWork } from "@/repositories/teamMemberWork";
import { findMyEarnings } from "@/repositories/payouts";
import { findMyEnquiryJobs } from "@/repositories/enquiryTeam";
import { findRentVenues } from "@/repositories/rent";
import { findDisputesFor, latestByTarget } from "@/repositories/disputes";
import { teamSeatOf } from "@/features/inbox/inviteRows";
import { publicProfilePath } from "@/lib/routes/publicProfile";
import type { MyEarnings } from "@/types/payout";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* the clock, stamped once outside render (react-hooks/purity) */
const stampNow = (): Date => new Date();

/** YOUR WORK WITH A STUDIO'S OR AN ARTIST'S TEAM (19 Oct 2026, the user: "other
 *  team cards in team should also have a detail page which shows work done for
 *  that particular crew, artist and studio"). `?show=classes|paid|stats|rent`.
 *
 *  ⚠ THE SEAT (or the rent) IS RE-CHECKED HERE — a URL is a request, never an
 *  authority. A seat on this team that is not the owner's, or a studio this
 *  person's artist page holds classes in; neither → back to Other Teams. No
 *  `loading.tsx`: a redirect inside a streamed boundary goes out as a 200. */
export default async function OtherBusinessRoute({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ show?: string; pay?: string }>;
}) {
  const [{ businessId }, { show: asked, pay }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(businessId)) {
    notFound();
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const memberships = await findMyMemberships(supabase).catch(() => []);
  const seatRow = memberships.find((m) => m.business.id === businessId && m.memberRole !== "owner" && (m.business.type === "studio" || m.business.type === "artist_page")) ?? null;
  /* an artist page you own is never "somebody else's team" */
  const owners = seatRow?.business.type === "artist_page" ? await findArtistPageOwners(supabase, [businessId]).catch(() => ({}) as Awaited<ReturnType<typeof findArtistPageOwners>>) : {};
  const owner = owners[businessId] ?? null;
  const seated = seatRow && !(owner && owner.userId === user.id) ? seatRow : null;

  /* RENT (19 Oct 2026): the studio your own artist page holds classes in */
  const myPage = memberships.find((m) => m.memberRole === "owner" && m.business.type === "artist_page")?.business ?? null;
  const venues = myPage ? await findRentVenues(supabase, myPage.id).catch(() => []) : [];
  const venue = venues.find((v) => v.venueBusinessId === businessId) ?? null;

  if (!seated && !venue) {
    redirect("/team?show=other");
  }

  const now = stampNow();
  const me = await findProfileById(supabase, user.id).catch(() => null);
  const meName = me?.fullName ?? "";

  let seat: OtherBusinessSeat | null = null;
  let name = venue?.venueName ?? "A studio";
  let photoPath: string | null = null;
  let place: string | null = null;
  let kind: "studio" | "artist_page" = "studio";
  let profileHref: string | null = `/studio/${businessId}`;

  if (seated) {
    const b = seated.business;
    kind = b.type === "artist_page" ? "artist_page" : "studio";
    name = kind === "artist_page" ? (owner?.name ?? b.name) : b.name;
    photoPath = kind === "artist_page" ? (owner?.photoPath ?? b.photoPath ?? null) : (b.photoPath ?? null);
    place = [b.area, b.city].filter(Boolean).join(", ") || null;
    profileHref = kind === "artist_page" ? (owner ? `/person/${owner.userId}` : null) : publicProfilePath(b);
    const word = teamSeatOf(seated.memberRole);
    const [work, allEarnings, jobs] = await Promise.all([
      findTeamMemberWork(supabase, businessId, user.id, now, { businessName: b.name, memberName: meName, memberPhoto: me?.avatarPath ?? null }),
      findMyEarnings(supabase, user.id, now.toISOString()).catch(() => null),
      findMyEnquiryJobs(supabase).catch(() => []),
    ]);
    /* what THIS business paid you — `PaidToYou`'s own shape, narrowed, the totals
       recounted from what is left so the column says one business's figures */
    const studios = (allEarnings?.studios ?? []).filter((s) => s.businessId === businessId);
    const earnings: MyEarnings = {
      studios,
      payouts: (allEarnings?.payouts ?? []).filter((p) => p.businessId === businessId),
      paidTotal: studios.reduce((n, s) => n + s.paidInr + s.otherPaidInr, 0),
      unsettledTotal: studios.reduce((n, s) => n + s.unsettled, 0),
    };
    const disputes = Object.fromEntries(latestByTarget(await findDisputesFor(supabase, { payoutIds: earnings.payouts.map((p) => p.id) })));
    seat = {
      seatWord: word.word,
      seatColour: word.colour,
      work,
      earnings,
      disputes,
      /* ⚠ `my_enquiry_jobs` names its host by NAME only, so a job is matched on
         the business's name — two businesses with one name would share a list */
      jobs: jobs.filter((j) => j.hostName === b.name),
    };
  }

  /* the rent side: you PAID it, so you answer a dispute the studio raises */
  const rentDisputes = venue
    ? Object.fromEntries(latestByTarget(await findDisputesFor(supabase, { rentPaymentIds: venue.payments.map((p) => p.id) })))
    : {};

  const wants = (asked ?? "") as OtherBusinessShow;
  const show: OtherBusinessShow = ["classes", "paid", "stats", "rent"].includes(wants) ? wants : seat ? "classes" : "rent";

  return (
    <OtherBusinessDetail
      businessId={businessId}
      kind={kind}
      name={name}
      photoPath={photoPath}
      profileHref={profileHref}
      place={place}
      meName={meName}
      seat={seat}
      rent={venue && myPage ? <RentToPay payerBusinessId={myPage.id} venues={[venue]} disputes={rentDisputes} openOnLoad={show === "rent" && pay === "1"} /> : undefined}
      show={show}
    />
  );
}
