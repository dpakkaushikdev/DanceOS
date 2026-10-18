import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { PracticeBodyHead, PracticeDetail } from "@/features/crews/components/PracticeDetail";
import { DOS_TOOLS, DeskHero } from "@/features/businesses/components/biz-kit";
import { PracticeRegister, type RegisterRow } from "@/features/crews/components/PracticeRegister";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findEnquiryPracticeDetail } from "@/repositories/enquiryTeam";
import { ENQ_PART_WORD, ENQ_PERSON_WORD, enquiryTypeLabel } from "@/types/enquiry";

export const metadata: Metadata = { title: "Practice — DanceOS" };

const stampNowIso = (): string => new Date().toISOString();
/* a job practice wears the Enquiries tool's colour, as its card's kind chip does */
const TINT = DOS_TOOLS.enquiries.c;

/** AN ENQUIRY JOB'S PRACTICE, ON ITS OWN PAGE (18 Oct 2026, `20261025090000`).
 *
 *  Who sees what is the DATABASE's answer, read once: `my_enquiry_practices`
 *  says whether the reader RUNS the job (the business's owner or a manager), is
 *  on its TEAM, or is a confirmed PARTICIPANT — and somebody who is none of those
 *  gets no row, so the page is "not found". The runner gets the register (the
 *  job's confirmed people, Check in / ✓ In); everybody else reads the details and
 *  whether they are in. The check-in write re-checks the runner on every press.
 *
 *  ⚠ The enquiry itself is linked only for the runner and the team — a
 *  participant is not an end of the enquiry and RLS would refuse them its page. */
export default async function JobPracticePage({ params }: { params: Promise<{ practiceId: string }> }) {
  const { practiceId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const detail = await findEnquiryPracticeDetail(supabase, practiceId).catch(() => null);
  if (!detail) {
    notFound();
  }
  const { practice: p, people, checkedIn } = detail;
  const runs = p.myPart === "runs";
  const nowIso = stampNowIso();
  const now = new Date(nowIso).getTime();
  const rows: RegisterRow[] = people.map((m) => ({
    userId: m.userId,
    fullName: m.name,
    avatarPath: m.photoPath,
    sub: m.role ? `${ENQ_PERSON_WORD[m.kind]} · ${m.role}` : ENQ_PERSON_WORD[m.kind],
    subTint: m.kind === "team" ? "#4338CA" : "#B45309",
    present: checkedIn.includes(m.userId),
  }));
  const meIn = checkedIn.includes(user.id);

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
            doors={p.myPart !== "participant" ? [{ href: `/inbox/enquiries/${p.enquiryId}?show=practices`, word: "The enquiry", label: `Open the enquiry with ${p.hostName}`, sub: "Its team, practices and payments" }] : []}
          />
        </div>
      </DeskTop>
      <DeskBody>
        {runs ? (
          <>
            <PracticeBodyHead>REGISTER</PracticeBodyHead>
            <PracticeRegister rows={rows} target={{ kind: "enquiry", practiceId: p.id, enquiryId: p.enquiryId }} tint={TINT} locked={p.status === "cancelled"} />
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
