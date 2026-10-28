import type { CSSProperties, ReactNode } from "react";

import { DOS_TOOLS, HueHead } from "@/features/businesses/components/biz-kit";
import { SegmentedPanels } from "@/features/shell/components/SegmentedNav";
import { ToolCard, ToolChip, ToolFacts, ToolHead } from "@/components/ui/ToolCard";
import { FigureHead } from "@/components/ui/FigureHead";
import { TeamClassesPanel } from "./TeamClassesPanel";
import { PaidToYou } from "./PaidToYou";
import { PracticeCard, splitPractices, PRACTICE_HEAD } from "@/features/crews/components/practice-card";
import { CrewI } from "@/features/crews/components/crew-kit";
import { DOS_UI, GREEN, INK, LILAC, MUTED, SUB } from "@/lib/design/tokens";
import { enquiryTypeOf, type EnquiryJobAsk } from "@/types/enquiry";
import { CREW_ROLE_WORD, CREW_TINT, type CrewRole, type CrewSummary } from "@/types/crew";
import type { MyEarnings } from "@/types/payout";
import type { TeamMemberWork } from "@/repositories/teamMemberWork";
import type { PaymentDispute } from "@/repositories/disputes";
import type { CrewPractice } from "@/types/crewPractice";

/** YOUR OWN WORK WITH A TEAM SOMEBODY ELSE RUNS (19 Oct 2026, the user: "other
 *  team cards in team should also have a detail page which shows work done for
 *  that particular crew, artist and studio", then "handle team detail pages better
 *  with everything inside that … everything will be managed from there under right
 *  columns", and "make sure things aren't repeated in this section").
 *
 *  The owner's Member Detail page turned round: the team's card on top — WHO it is
 *  and your seat, no figures, because every figure lives in exactly one column —
 *  then a column per part of the relationship.
 *
 *  ⚠ WHAT IT CAN AND CANNOT SAY, SAID ON THE PAGE. A member reads the business's
 *  classes, sessions and their own payouts; it reads the business's attendance
 *  only where it runs that class's register, and its takings not at all (R79). So
 *  "checked in" is counted where readable and said so, and there is no revenue. */

const panel: CSSProperties = { background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 18, padding: "13px 14px", marginBottom: 12 };
const head: CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 1, color: MUTED };
const page: CSSProperties = { background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "14px var(--dos-gutter) 40px", boxSizing: "border-box" };

const dateWords = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
const monthWords = (iso: string) => new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
const hoursWords = (min: number) => {
  const h = min / 60;
  return h === 0 ? "0" : h < 10 ? (Math.round(h * 10) / 10).toString() : String(Math.round(h));
};

function Section({ title, figure, testId, children }: { title: string; figure?: ReactNode; testId?: string; children: ReactNode }) {
  return (
    <div style={panel} data-testid={testId}>
      <FigureHead margin="0 0 10px" title={<span style={head}>{title}</span>} figure={figure == null ? undefined : <span style={{ ...head, fontVariantNumeric: "tabular-nums" }}>{figure}</span>} />
      {children}
    </div>
  );
}

/* ── A STUDIO'S OR AN ARTIST'S TEAM ─────────────────────────────────────── */

export type OtherBusinessShow = "classes" | "paid" | "stats" | "rent";

/** the seat half — absent when the only relationship is rent */
export interface OtherBusinessSeat {
  seatWord: string;
  seatColour: string;
  work: TeamMemberWork;
  /** `findMyEarnings`, narrowed to this business — `PaidToYou`'s own shape */
  earnings: MyEarnings;
  /** the enquiry jobs this business put you on */
  jobs: EnquiryJobAsk[];
  /** the latest dispute per entry on these payments (19 Oct 2026) */
  disputes: Record<string, PaymentDispute>;
}

export function OtherBusinessDetail({
  businessId,
  kind,
  name,
  photoPath,
  profileHref,
  place,
  meName,
  seat,
  rent,
  show,
}: {
  businessId: string;
  kind: "studio" | "artist_page";
  /** the studio's name, or the artist's own */
  name: string;
  photoPath: string | null;
  profileHref: string | null;
  place: string | null;
  meName: string;
  seat: OtherBusinessSeat | null;
  /** the rent your artist page owes or paid this studio — drawn as the Rent
   *  column, and only when there is rent between you */
  rent?: ReactNode;
  show: OtherBusinessShow;
}) {
  const tint = kind === "studio" ? DOS_TOOLS.studios.c : DOS_TOOLS.team.c;
  const base = `/team/other/business/${businessId}`;

  const top = (
    <>
      {/* headed by the team's own name (28 Oct 2026, the one heading standard) */}
      <HueHead title={name} color={tint} bottom="12px" />
      <ToolCard testId="other-detail-team">
        <ToolHead
          tint={tint}
          name={name}
          photoPath={photoPath}
          href={profileHref ?? undefined}
          hrefLabel={profileHref ? `${name} — their profile page` : undefined}
          eyebrow={kind === "studio" ? (seat ? "Studio · Your work" : "Studio · You rent here") : "Artist · Your work"}
          sub={place ?? undefined}
          size={64}
          right={seat ? <ToolChip word={seat.seatWord} fg={seat.seatColour} bg={`${seat.seatColour}1f`} /> : undefined}
        />
      </ToolCard>
    </>
  );

  const segments: Array<{ key: OtherBusinessShow; href: string; label: string; aria: string }> = [];
  const panels: Array<{ key: OtherBusinessShow; node: ReactNode }> = [];

  if (seat) {
    const { work, earnings, jobs } = seat;
    const confirmedJobs = jobs.filter((j) => j.status === "confirmed");
    segments.push(
      { key: "classes", href: `${base}?show=classes`, label: "Classes", aria: `Your classes with ${name}` },
      { key: "paid", href: `${base}?show=paid`, label: "Paid", aria: `What ${name} has paid you` },
      { key: "stats", href: `${base}?show=stats`, label: "Stats", aria: `Your stats with ${name}` },
    );
    panels.push(
      {
        key: "classes",
        node: (
          <div data-testid="other-detail-classes">
            <TeamClassesPanel classes={work.classes} tint={tint} memberName={meName || "you"} businessName={name} isStudio={kind === "studio"} />
            {jobs.length > 0 ? (
              <Section title="ENQUIRIES YOU WORK ON" figure={confirmedJobs.length} testId="other-detail-enquiries">
                {jobs.map((j) => {
                  const label = (j.typeKey ? enquiryTypeOf(j.typeKey)?.label : null) ?? "Enquiry";
                  return (
                    <div key={j.id} data-testid="other-detail-enquiry" style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1.5px solid var(--el)" }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 900 }}>{label}</span>
                        <span style={{ display: "block", fontSize: 10.5, color: SUB, marginTop: 1 }}>
                          {[j.kind === "team" ? "Team" : "Participant", j.role, j.firstDate ? dateWords(`${j.firstDate}T00:00:00+05:30`) : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <ToolChip word={j.status === "asked" ? "ASKED" : "ON IT"} fg={j.status === "asked" ? "#B45309" : GREEN} bg={j.status === "asked" ? "#F59E0B22" : "#22C55E22"} />
                    </div>
                  );
                })}
              </Section>
            ) : null}
          </div>
        ),
      },
      {
        key: "paid",
        node: (
          <div data-testid="other-detail-paid">
            {earnings.studios.length === 0 && earnings.payouts.length === 0 ? (
              <div style={{ ...panel, fontSize: 12, color: SUB }}>{name} has not recorded a payment to you yet.</div>
            ) : (
              <PaidToYou data={earnings} disputes={seat.disputes} />
            )}
          </div>
        ),
      },
      {
        key: "stats",
        node: (
          <div data-testid="other-detail-stats">
            {/* ⚠ No money here — what was paid and what is not settled are the Paid
                column's, and this column does not say them a second time */}
            <div style={panel}>
              {/* ⚠ FOUR TILES, NOT SEVEN (28 Oct 2026, the design pass) — the
                  dates and what is still to come are one quiet line under them */}
              <ToolFacts
                tint={tint}
                items={[
                  { label: "Took", value: work.taught },
                  { label: "Assisted", value: work.assisted },
                  { label: "Hours", value: hoursWords(work.minutes) },
                  { label: "Checked in", value: work.dancers, testId: "other-detail-checked-in" },
                ]}
              />
              <div style={{ fontSize: 10.5, color: SUB, marginTop: 8, lineHeight: 1.45 }}>
                {[work.firstAt ? `First class ${dateWords(work.firstAt)}` : null, work.lastAt ? `last ${dateWords(work.lastAt)}` : null, work.upcoming ? `${work.upcoming} to come` : null].filter(Boolean).join(" · ") || "No classes yet."}
              </div>
              <div style={{ fontSize: 10.5, color: MUTED, marginTop: 8, lineHeight: 1.45 }}>Checked in counts only the classes whose register you can open.</div>
              {!work.complete ? <div style={{ fontSize: 10.5, color: "#F59E0B", marginTop: 4 }}>Counting the latest rows only — the figures may be short.</div> : null}
            </div>
            {work.styles.length > 0 ? (
              <Section title="WHAT YOU TEACH HERE" figure={work.styles.length}>
                {work.styles.map((s) => (
                  <div key={s.style} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "4px 0" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.style}</span>
                    <span style={{ flexShrink: 0, fontSize: 11, color: SUB, fontVariantNumeric: "tabular-nums" }}>
                      {s.n} {s.n === 1 ? "session" : "sessions"}
                    </span>
                  </div>
                ))}
              </Section>
            ) : null}
          </div>
        ),
      },
    );
  }

  if (rent) {
    segments.push({ key: "rent", href: `${base}?show=rent`, label: "Rent", aria: `Rent with ${name}` });
    panels.push({ key: "rent", node: <div data-testid="other-detail-rent">{rent}</div> });
  }

  const initial = segments.some((s) => s.key === show) ? show : (segments[0]?.key ?? "classes");

  return (
    <div style={page} data-testid="other-detail" data-kind={kind}>
      <SegmentedPanels key={initial} initial={initial} label="Show" sections top={top} segments={segments} panels={panels} />
    </div>
  );
}

/* ── A CREW YOU ARE IN ──────────────────────────────────────────────────── */

export type OtherCrewShow = "practices" | "stats";

export function OtherCrewDetail({
  crew,
  role,
  since,
  practices,
  checkedIn,
  now,
  show,
}: {
  crew: CrewSummary;
  role: CrewRole;
  since: string;
  practices: CrewPractice[];
  /** the practices you were checked in to */
  checkedIn: Set<string> | string[];
  now: number;
  show: OtherCrewShow;
}) {
  const tint = CREW_TINT;
  const base = `/team/other/crew/${crew.id}`;
  const inSet = checkedIn instanceof Set ? checkedIn : new Set(checkedIn);
  const { coming, over } = splitPractices(practices, now);
  const held = over.filter((p) => p.status !== "cancelled");
  const attended = held.filter((p) => inSet.has(p.id)).length;
  const foot = (id: string) => (
    <div style={{ padding: "0 14px 12px", fontSize: 11, fontWeight: 900, color: inSet.has(id) ? GREEN : SUB }} data-testid="other-detail-practice-in">
      {inSet.has(id) ? "✓ You were checked in" : "Not checked in"}
    </div>
  );

  const top = (
    <>
      <HueHead title={crew.name} color={tint} bottom="12px" />
      <ToolCard testId="other-detail-team" href={`/crew/${crew.id}`} hrefLabel={`${crew.name} — their profile page`}>
        <ToolHead
          tint={tint}
          name={crew.name}
          photoPath={crew.photo}
          icon={<CrewI size={24} color="#fff" />}
          eyebrow="Crew · Your work"
          sub={[crew.city, `In since ${monthWords(since)}`].filter(Boolean).join(" · ")}
          size={64}
          right={<ToolChip word={CREW_ROLE_WORD[role].toUpperCase()} fg={SUB} bg="var(--el)" />}
        />
      </ToolCard>
    </>
  );

  return (
    <div style={page} data-testid="other-detail" data-kind="crew">
      <SegmentedPanels
        key={show}
        initial={show}
        label="Show"
        sections
        top={top}
        segments={[
          { key: "practices", href: `${base}?show=practices`, label: "Practices", aria: `Practices with ${crew.name}` },
          { key: "stats", href: `${base}?show=stats`, label: "Stats", aria: `Your stats with ${crew.name}` },
        ]}
        panels={[
          {
            key: "practices",
            node: (
              <div data-testid="other-detail-practices">
                <div style={PRACTICE_HEAD}>Coming up · {coming.length}</div>
                {coming.length === 0 ? <div style={{ fontSize: 11.5, color: SUB, padding: "0 2px 6px" }}>Nothing arranged yet.</div> : coming.map((p) => <PracticeCard key={p.id} practice={p} now={now} />)}
                <div style={PRACTICE_HEAD}>Over · {over.length}</div>
                {over.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: SUB, padding: "0 2px 6px" }}>No practice has happened yet.</div>
                ) : (
                  over.map((p) => <PracticeCard key={p.id} practice={p} now={now} foot={p.status === "cancelled" ? null : foot(p.id)} />)
                )}
              </div>
            ),
          },
          {
            key: "stats",
            node: (
              <div data-testid="other-detail-stats" style={panel}>
                <ToolFacts
                  tint={tint}
                  items={[
                    { label: "Held", value: held.length },
                    { label: "You came", value: attended, testId: "other-detail-attended" },
                    { label: "Turn-up", value: held.length ? `${Math.round((attended / held.length) * 100)}%` : "—" },
                  ]}
                />
                <div style={{ fontSize: 10.5, color: MUTED, marginTop: 8, lineHeight: 1.45 }}>A practice called off is not counted.</div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
