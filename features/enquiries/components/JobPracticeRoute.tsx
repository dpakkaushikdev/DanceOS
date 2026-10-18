import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { PracticeBodyHead, PracticeDetail } from "@/features/crews/components/PracticeDetail";
import { DOS_TOOLS, DeskHero } from "@/features/businesses/components/biz-kit";
import { PracticeRegister, type RegisterRow } from "@/features/crews/components/PracticeRegister";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyMemberships, runsTheBusiness } from "@/repositories/businesses";
import { findEnquiryPracticeDetail } from "@/repositories/enquiryTeam";
import { ENQ_PART_WORD, ENQ_PERSON_WORD, enquiryTypeLabel } from "@/types/enquiry";

const stampNowIso = (): string => new Date().toISOString();
/* a job practice wears the Enquiries tool's colour, as its card's kind chip does */
const TINT = DOS_TOOLS.enquiries.c;
const SENDER_TINT = "#0E7490";

/** AN ENQUIRY JOB'S PRACTICE, ON ITS OWN PAGE — AT EITHER OF TWO ADDRESSES
 *  (18 Oct 2026). `/practice/job/{id}` is a person's; `/business/{studio}/practice/job/{id}`
 *  is a studio's own, so opening a studio's practice never moves the profile
 *  switcher off the studio (the user: "profile should not switch when going from
 *  practice or enquiry in any way. should only happen from profile switcher").
 *  `scope` is the studio: there the reader must run it and the practice's enquiry
 *  must be that studio's, or it is not found — a URL is a request, never an
 *  authority.
 *
 *  Who sees what is the DATABASE's answer, read once: `my_enquiry_practices` says
 *  whether the reader RUNS the job, is on its TEAM, is a confirmed PARTICIPANT, or
 *  SENT the enquiry (`20261027090000`). The runner gets the register — the team,
 *  the participants AND the sender (the user: "job practice should show register
 *  with both team and participants and the person who created enquiry should also
 *  be there"); the sender reads the same register with nothing to press; a team
 *  member or a participant reads whether they are in. The check-in write
 *  re-checks the runner on every press.
 *
 *  The enquiry itself is a round button on the hero's top right (the user: "the
 *  enquiry button should be on top right as a button with icon on the first
 *  section"), for the runner and the sender — a participant or a team member is
 *  not an end of the enquiry and RLS would refuse them its page. */
export async function JobPracticeRoute({ practiceId, scope = null }: { practiceId: string; scope?: string | null }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const [detail, seats] = await Promise.all([findEnquiryPracticeDetail(supabase, practiceId).catch(() => null), scope ? findMyMemberships(supabase).catch(() => []) : Promise.resolve([])]);
  if (!detail) {
    notFound();
  }
  const { practice: p, people, checkedIn, sender } = detail;
  if (scope) {
    const seat = seats.find((m) => m.business.id === scope);
    if (!seat || !runsTheBusiness(seat.memberRole) || p.myPart !== "runs") {
      notFound();
    }
    const { data: enq } = await supabase.from("enquiries").select("business_id").eq("id", p.enquiryId).maybeSingle();
    if ((enq as { business_id: string | null } | null)?.business_id !== scope) {
      notFound();
    }
  }
  const runs = p.myPart === "runs";
  const isSender = p.myPart === "sender";
  const nowIso = stampNowIso();
  const now = new Date(nowIso).getTime();
  const rows: RegisterRow[] = [
    ...people
      .slice()
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "team" ? -1 : 1))
      .map((m) => ({
        userId: m.userId,
        fullName: m.name,
        avatarPath: m.photoPath,
        sub: m.role ? `${ENQ_PERSON_WORD[m.kind]} · ${m.role}` : ENQ_PERSON_WORD[m.kind],
        subTint: m.kind === "team" ? "#4338CA" : "#B45309",
        present: checkedIn.includes(m.userId),
      })),
    ...(sender ? [{ userId: sender.userId, fullName: sender.name, avatarPath: sender.photoPath, sub: "Sent the enquiry", subTint: SENDER_TINT, present: checkedIn.includes(sender.userId) }] : []),
  ];
  const meIn = checkedIn.includes(user.id);
  const enquiryHref = scope ? `/business/${scope}/inbox/enquiries/${p.enquiryId}?show=practices` : `/inbox/enquiries/${p.enquiryId}?show=practices`;
  const corner =
    runs || isSender ? (
      <Link
        href={enquiryHref}
        aria-label={`Open the enquiry with ${p.hostName}`}
        data-testid="practice-enquiry-door"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", borderRadius: 17, background: TINT, color: "#fff", textDecoration: "none", fontSize: 11.5, fontWeight: 900 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5h16v11H8l-4 4z" />
          <path d="M8 9h8M8 12h5" />
        </svg>
        Enquiry
      </Link>
    ) : null;

  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, padding: "0 var(--dos-gutter)", boxSizing: "border-box", paddingBottom: "var(--dos-foot)" }}>
      <DeskTop>
        <DeskHero tool="practice" as="h1" margin="0 0 12px" />
        <div data-testid="practice-detail" data-kind="enquiry" data-part={p.myPart}>
          <PracticeDetail
            kind="job"
            name={p.hostName}
            photoPath={p.hostPhotoPath}
            label={enquiryTypeLabel(p.typeKey)}
            role={ENQ_PART_WORD[p.myPart].sub}
            startsAt={p.startsAt}
            endsAt={p.endsAt}
            place={p.place}
            note={p.note}
            cancelled={p.status === "cancelled"}
            now={now}
            doors={[]}
            corner={corner}
          />
        </div>
      </DeskTop>
      <DeskBody>
        {runs || isSender ? (
          <>
            <PracticeBodyHead>REGISTER</PracticeBodyHead>
            <PracticeRegister rows={rows} target={{ kind: "enquiry", practiceId: p.id, enquiryId: p.enquiryId }} tint={TINT} locked={!runs || p.status === "cancelled"} />
          </>
        ) : (
          <>
            <PracticeBodyHead>YOU</PracticeBodyHead>
            <div data-testid="practice-you" style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--card)", border: `1.5px solid ${meIn ? TINT : "var(--el)"}`, borderRadius: 18, padding: "13px 14px" }}>
              <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 19, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 17, fontWeight: 900, background: meIn ? TINT : "var(--el)", color: meIn ? "#fff" : "var(--muted)" }}>
                {meIn ? "✓" : "·"}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 900 }}>{ENQ_PART_WORD[p.myPart].sub}</div>
                <div data-testid="practice-you-in" data-in={meIn ? "1" : "0"} style={{ fontSize: 11.5, color: meIn ? TINT : "var(--sub)", fontWeight: 800, marginTop: 2 }}>
                  {p.status === "cancelled" ? "Called off" : meIn ? "You are checked in" : "Not checked in yet — the host marks you in at the door"}
                </div>
              </div>
            </div>
          </>
        )}
      </DeskBody>
    </div>
  );
}
