import Link from "next/link";
import { DOS_UI, INK, LILAC, SUB, TAB_TITLE } from "@/lib/design/tokens";
import { BeatText } from "@/components/ui/BeatText";
import { CREW_TINT, type CrewSummary } from "@/types/crew";
import { DeskAddButton } from "@/features/settings/components/settings-kit";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { ToolActions, ToolBody, ToolCard, ToolChip, ToolFacts, ToolHead, toolBtn } from "@/components/ui/ToolCard";
import { CrewI } from "./crew-kit";
import { ReclaimCrewButton } from "./ReclaimCrewButton";

/** The Crews hub — prototype S_bizhub with kind="crews" (2585-2691): TWO LISTS,
 *  BECAUSE THERE ARE TWO RELATIONSHIPS. "A crew you lead and a crew you dance in
 *  are not the same object with a flag on it: one has a roster … to keep, and
 *  the other has a page you read." The ones you run come first (Manage ›), the
 *  dashed Create crew door under them, and below, under their own heading, the
 *  crews you are simply IN (Profile ›). Where a row goes decides what pressing
 *  it does. */

const sinceWords = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "short", year: "numeric" }).format(new Date(iso));

/** A CREW CARD (3 Oct 2026, the user: *"better and bigger cards … each has a
 *  profile linked to it … visible with profile pic and name and big"*). The
 *  profile IS the crew: its picture and its name lead, then the figures a crew is
 *  read by — how many dance in it, what it dances, since when — then the doors.
 *
 *  ⚠ THE WHOLE CARD STILL OPENS WHERE THE ROW DID — the desk for a crew you lead,
 *  its page for one you are in — through the stretched link, under the same
 *  accessible name the hub has always given it. The buttons are the two doors
 *  said out loud, on their own bar. */
export function CrewCard({ crew, own, since, foundedByMe = false }: { crew: CrewSummary; own: boolean; since: string; foundedByMe?: boolean }) {
  const tint = CREW_TINT;
  return (
    <ToolCard href={own ? `/crews/${crew.id}/manage` : `/crew/${crew.id}`} hrefLabel={`${crew.name} — ${own ? "manage the crew" : "open the profile"}`}>
      {/* ⚠ THE FACE AND THE NAME ARE THE DOOR TO THE CREW'S PROFILE (4 Oct 2026,
          the user: "profile pic of crew and name should take to profile page of
          that crew") — so the Public page and Open profile buttons went. On a
          crew you lead the rest of the card still opens its desk; on one you
          dance in the whole card already IS that door, so the head adds none.
          ⚠ The label avoids "open the profile", which the card's own stretched
          link carries — Playwright matches a name by substring. And the eyebrow
          no longer says "you lead it / you dance in it" (the same message) — the
          LEADER / MEMBER chip says it once. */}
      <ToolHead
        tint={tint}
        name={crew.name}
        photoPath={crew.photo}
        icon={<CrewI size={24} color="#fff" />}
        /* no profile door on the face (12 Oct 2026) — the card opens the crew */
        eyebrow={foundedByMe ? "Crew · you started it" : "Crew"}
        sub={crew.city}
        right={<ToolChip word={own ? "LEADER" : "MEMBER"} fg={own ? tint : SUB} bg={own ? `${tint}18` : "var(--el)"} />}
      />
      <ToolBody>
        {/* ⚠ NO "DANCES" TILE (3 Oct 2026, the user: "can remove dances from crew
            cards") — the crew's styles are its own page's business; the card is
            read by how many dance in it and since when */}
        <ToolFacts
          tint={tint}
          items={[
            { label: crew.members === 1 ? "Member" : "Members", value: crew.members },
            { label: own ? "Since" : "Joined", value: sinceWords(since) },
          ]}
        />
        {foundedByMe ? <div style={{ fontSize: 11, color: SUB, marginTop: 9, lineHeight: 1.45 }}>You started this crew and handed it over.</div> : null}
      </ToolBody>
      {/* ⚠ "Manage Crew", capital C, in the tinted paint Open profile wore (4 Oct
          2026, the user). A crew you dance in has no button left — unless you
          founded it and handed it over, where "Take {crew} back" still lives. */}
      {own ? (
        <ToolActions>
          <Link href={`/crews/${crew.id}/manage`} style={toolBtn("tinted", tint)}>
            Manage Crew
          </Link>
        </ToolActions>
      ) : foundedByMe ? (
        <ToolActions>
          {/* ⚠ THE FOUNDER'S DOOR BACK (30 Sep 2026), still named "Take {crew} back" */}
          <ReclaimCrewButton crewId={crew.id} crewName={crew.name} wrapStyle={{ flex: "1 1 0", minWidth: 0 }} buttonStyle={{ ...toolBtn("secondary", tint), width: "100%", color: tint }} />
        </ToolActions>
      ) : null}
    </ToolCard>
  );
}

/** THE CREWS YOU RUN — and the door that makes one. */
function LedColumn({ led }: { led: CrewSummary[] }) {
  return (
    <>
      {/* ⚠ ADD CREW LEFT THIS COLUMN FOR THE TOP SQUIRCLE (11 Oct 2026, the user:
          "add crew … below the heading above the column") — it is drawn under
          the hero in `CrewsHub`, so it is there whichever column is open */}
      {led.length ? (
        led.map((c) => <CrewCard key={c.id} crew={c} own since={c.createdAt} />)
      ) : (
        <div style={{ fontSize: 11.5, color: SUB, padding: "0 2px 10px" }}>You have not created a crew yet.</div>
      )}
    </>
  );
}

export function CrewsHub({ led }: { led: CrewSummary[] }) {
  /** ⚠⚠ ONE COLUMN — THE CREWS YOU LEAD (18 Oct 2026, the user: "crew team and
   *  studio team should all be managed within teams … should be removed from
   *  studio and crew sections"). The Member column (the crews you dance in, and
   *  the asks to join one) moved to Teams' Other Teams column with the studio and
   *  artist teams; `?show=in` forwards there (Rule 14). This hub is what you RUN. */
  const accent = CREW_TINT;
  /* the heading — the same paint, and the same word, as the tile you pressed */
  const hero = (
    <div data-testid="desk-hero" style={{ margin: "-14px -14px 0", padding: "16px 16px 6px", borderRadius: "21px 21px 0 0", position: "relative", color: INK, background: `linear-gradient(180deg, ${accent}8c 0%, ${accent}38 60%, transparent 100%)` }}>
      {/* the page's own `<h1>` — the chrome no longer prints a drill page's name (28 Sep 2026) */}
      <h1 style={{ ...TAB_TITLE, color: INK, position: "relative" }}><BeatText text="Crews" /></h1>
    </div>
  );
  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ padding: "14px var(--dos-gutter) 0" }}>
        <DeskTop style={{ margin: "0 0 12px" }}>
          {hero}
          {/* ＋ Add Crew under the heading (11 Oct 2026); opens over this hub (22 Sep 2026) */}
          <DeskAddButton label="Add Crew" href="?new=1" inTop />
        </DeskTop>
        <DeskBody style={{ margin: "0" }}>
          <LedColumn led={led} />
          {/* ⚠ NO POINTER TO OTHER TEAMS (18 Oct 2026, the user: "no. crews you are
              in and crew invites in crew tab") — the Crews tab is the crews you
              lead and nothing else; Team › Other Teams holds the rest. */}
        </DeskBody>
      </div>
    </div>
  );
}