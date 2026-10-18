import { notFound, redirect } from "next/navigation";
import { EnquiryDetail } from "@/features/enquiries/components/EnquiryDetail";
import { isCashfreeConfigured } from "@/lib/cashfree/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyLedCrews } from "@/repositories/crews";
import { findEnquiryById } from "@/repositories/enquiries";
import { findArtistPageOwners, findBusinessTeam, findMyMemberships, runsTheBusiness } from "@/repositories/businesses";
import { findEnquiryFiles, findEnquiryJob } from "@/repositories/enquiryTeam";
import { MEMBER_ROLE_WORD } from "@/types/staff";
import type { EnquiryJob } from "@/types/enquiry";

const stampNowIso = (): string => new Date().toISOString();

/** ONE ENQUIRY, AT EITHER OF ITS TWO ADDRESSES (18 Oct 2026).
 *  `/inbox/enquiries/{id}` — the sender's, an artist page's and a crew's; and
 *  `/business/{studio}/inbox/enquiries/{id}` — a studio's own, so the switcher
 *  stays on the studio. RLS admits the two ends only — the sender, and the
 *  business's members or the crew's leader — so anybody else gets "not found".
 *  `scope` is the studio address: there the enquiry must be that studio's and
 *  the viewer must run it, or it is not found (a URL is a request, never an
 *  authority). Without a scope, a studio's runner who is not the sender is sent
 *  to the studio's address, keeping `?show=` (and `?paid=`). */
export async function EnquiryDetailRoute({
  enquiryId,
  paid,
  show,
  scope = null,
}: {
  enquiryId: string;
  paid?: string;
  show?: string;
  scope?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [enquiry, seats, ledCrews] = await Promise.all([findEnquiryById(supabase, enquiryId), findMyMemberships(supabase), findMyLedCrews(supabase).catch(() => [])]);
  if (!enquiry) {
    notFound();
  }
  const seat = seats.find((m) => m.business.id === enquiry.businessId);
  const mine = enquiry.crewId ? ledCrews.some((c) => c.id === enquiry.crewId) : Boolean(seat);
  const canWork = enquiry.crewId ? mine : runsTheBusiness(seat?.memberRole);
  const studioSide = !enquiry.crewId && enquiry.businessType === "studio" && Boolean(enquiry.businessId) && canWork && enquiry.fromUserId !== user.id;

  if (scope) {
    if (enquiry.businessId !== scope || !studioSide) {
      notFound();
    }
  } else if (studioSide) {
    const q = new URLSearchParams();
    if (show) q.set("show", show);
    if (paid) q.set("paid", paid);
    const qs = q.toString();
    redirect(`/business/${enquiry.businessId}/inbox/enquiries/${enquiry.id}${qs ? `?${qs}` : ""}`);
  }

  /* ⚠ THE JOB (18 Oct 2026): its people and practices — read for BOTH ends since
     `20261026090000` lets the sender read them. Every read degrades — a failed
     read is an empty section, so the money half of the page never fails over it. */
  const noJob: EnquiryJob = { available: false, people: [], practices: [] };
  const noFiles = { available: false, files: [] };
  const artistPage = !enquiry.crewId && enquiry.businessType === "artist_page" && enquiry.businessId ? enquiry.businessId : null;
  const [job, team, files, owners] = await Promise.all([
    findEnquiryJob(supabase, enquiry.id).catch(() => noJob),
    mine && canWork && enquiry.businessId ? findBusinessTeam(supabase, enquiry.businessId).catch(() => []) : Promise.resolve([]),
    findEnquiryFiles(supabase, enquiry.id).catch(() => noFiles),
    artistPage ? findArtistPageOwners(supabase, [artistPage]).catch(() => ({}) as Awaited<ReturnType<typeof findArtistPageOwners>>) : Promise.resolve({} as Awaited<ReturnType<typeof findArtistPageOwners>>),
  ]);
  const teamPicks = team.map((t) => ({ userId: t.userId, name: t.name, photoPath: t.avatarPath, seat: MEMBER_ROLE_WORD[t.role] }));
  const initialTab = show === "team" || show === "practices" || show === "files" ? show : "payments";

  /* the faces are doors: the sender's person page; the asked side's own page —
     a studio's, a crew's, or an artist page's OWNER (an artist is their profile) */
  const toHref = enquiry.crewId
    ? `/crew/${enquiry.crewId}`
    : enquiry.businessType === "studio" && enquiry.businessId
      ? `/studio/${enquiry.businessId}`
      : artistPage && owners[artistPage]
        ? `/person/${owners[artistPage].userId}`
        : null;

  return (
    <EnquiryDetail
      enquiry={enquiry}
      mine={mine}
      canWork={canWork}
      nowIso={stampNowIso()}
      meId={user.id}
      /* online payment is a business's enquiry on a configured rail */
      payOnline={isCashfreeConfigured() && !enquiry.crewId}
      paidBack={paid === "booked" ? "paid" : paid === "processing" ? "processing" : paid === "refund_pending" ? "refunded" : paid ? "failed" : null}
      job={job}
      team={teamPicks}
      initialTab={initialTab}
      files={files}
      fromHref={`/person/${enquiry.fromUserId}`}
      toHref={toHref}
    />
  );
}
