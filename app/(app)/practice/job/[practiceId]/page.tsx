import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { toolBtn } from "@/components/ui/ToolCard";
import { DOS_TOOLS, DeskHero } from "@/features/businesses/components/biz-kit";
import { PracticeRegister, type RegisterRow } from "@/features/crews/components/PracticeRegister";
import { EnquiryPracticeCard } from "@/features/enquiries/components/EnquiryPracticeCard";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findEnquiryPracticeDetail } from "@/repositories/enquiryTeam";
import { ENQ_PART_WORD, ENQ_PERSON_WORD } from "@/types/enquiry";

export const metadata: Metadata = { title: "Practice — DanceOS" };

const stampNowIso = (): string => new Date().toISOString();
const TINT = DOS_TOOLS.practice.c;

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
          <EnquiryPracticeCard
            practice={p}
            now={now}
            linked={false}
            actions={
              p.myPart !== "participant" ? (
                <Link href={`/inbox/enquiries/${p.enquiryId}?show=practices`} aria-label={`Open the enquiry with ${p.hostName}`} style={toolBtn("secondary", TINT)}>
                  The enquiry ›
                </Link>
              ) : null
            }
          />
        </div>
      </DeskTop>
      <DeskBody>
        {runs ? (
          <>
            <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.9, color: "var(--muted)", margin: "2px 0 8px" }}>REGISTER</div>
            <PracticeRegister rows={rows} target={{ kind: "enquiry", practiceId: p.id, enquiryId: p.enquiryId }} tint={TINT} locked={p.status === "cancelled"} />
          </>
        ) : (
          <div data-testid="practice-you" style={{ background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 16, padding: "14px 14px" }}>
            <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 0.9, color: "var(--muted)" }}>YOU</div>
            <div style={{ fontSize: 13, fontWeight: 900, marginTop: 4 }}>{ENQ_PART_WORD[p.myPart].sub}</div>
            <div data-testid="practice-you-in" data-in={meIn ? "1" : "0"} style={{ fontSize: 11.5, color: meIn ? TINT : "var(--sub)", fontWeight: 800, marginTop: 3 }}>
              {p.status === "cancelled" ? "This practice was called off" : meIn ? "✓ You are checked in" : "Not checked in yet — the person running it marks the register"}
            </div>
          </div>
        )}
      </DeskBody>
    </div>
  );
}
