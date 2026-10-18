"use client";

import Link from "next/link";
import { ToolActions, ToolCard, ToolChip, ToolHead, toolBtn } from "@/components/ui/ToolCard";
import { CrewInvites, TeamInvites } from "@/features/inbox/components/JoinInvites";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { VerifiedTick } from "@/features/settings/components/settings-kit";
import { CrewCard } from "@/features/crews/components/CrewsHub";
import { publicProfilePath } from "@/lib/routes/publicProfile";
import { MUTED, SUB } from "@/lib/design/tokens";
import type { OtherTeamsData } from "@/features/staff/otherTeams";
import type { RentVenue } from "@/types/payout";
import { money as rupees } from "@/features/payouts/components/earnings-kit";

const head: React.CSSProperties = { fontSize: 9.5, fontWeight: 900, letterSpacing: 1, color: MUTED, textTransform: "uppercase", margin: "6px 2px 8px" };

/** THE DOOR TO YOUR OWN WORK WITH ONE TEAM (19 Oct 2026, the user: "other team
 *  cards in team should also have a detail page which shows work done for that
 *  particular crew, artist and studio"). A button on the card's own bar, so the
 *  card's stretched link (the team's profile) keeps its name and its press. */
function DetailLink({ href, name, tint }: { href: string; name: string; tint: string }) {
  return (
    <Link href={href} data-testid="other-team-detail" aria-label={`Your work with ${name}`} style={toolBtn("tinted", tint)}>
      Detail ›
    </Link>
  );
}

/** THE OTHER TEAMS COLUMN (18 Oct 2026, the user: "crew team and studio team
 *  should all be managed within teams in artist teams column and should be
 *  removed from studio and crew sections for easier management of all kinds of
 *  teams within section should be called Other Teams. so basically artist studio
 *  and crew team managed from one column in teams sections").
 *
 *  Every team that is somebody ELSE's, in one column: the invitations first —
 *  a studio's, an artist's, a crew leader's, each answered with Join · Decline —
 *  then the studio teams, the artist teams and the crews you are already on. It
 *  replaced the Studios hub's Team column, the Crews hub's Member column and the
 *  Artist Teams column; the old addresses forward here (Rule 14). */
export function OtherTeams({ data, stayOn, rentVenues = [] }: { data: OtherTeamsData; stayOn: string; rentVenues?: RentVenue[] }) {
  const tint = DOS_TOOLS.team.c;
  const studioTint = DOS_TOOLS.studios.c;
  const { studioInvites, artistInvites, crewAsks, studioTeams, artistTeams, crews } = data;
  /* ⚠ A STUDIO YOU RENT FROM AND ARE ON THE TEAM OF IS ONE CARD — its studio-team
     card's Detail page carries the Rent column too, so it is not listed twice */
  const seatStudios = new Set(studioTeams.map((t) => t.business.id));
  const rentOnly = rentVenues.filter((v) => !seatStudios.has(v.venueBusinessId));
  const rentTint = DOS_TOOLS.rooms.c;
  const empty = studioInvites.length + artistInvites.length + crewAsks.length + studioTeams.length + artistTeams.length + crews.length + rentOnly.length === 0;
  return (
    <div data-testid="other-teams">
      <TeamInvites invites={studioInvites} stayOn={stayOn} heading="Invited to a studio's team" testId="team-invites" />
      <TeamInvites invites={artistInvites} stayOn={stayOn} heading="Invited to an artist's team" testId="artist-team-invites" />
      <CrewInvites asks={crewAsks} stayOn={stayOn} />

      {studioTeams.length > 0 ? (
        <div data-testid="studio-teams">
          <div style={head}>Studio teams you are on · {studioTeams.length}</div>
          {studioTeams.map((t) => (
            <div key={t.business.id} style={{ marginBottom: 10 }}>
              <ToolCard testId="studio-team" href={publicProfilePath(t.business)} hrefLabel={`${t.business.name} — open the profile`}>
                <ToolHead
                  tint={studioTint}
                  name={t.business.name}
                  photoPath={t.business.photoPath}
                  eyebrow="Studio · Team"
                  afterName={t.business.verifiedAt ? <VerifiedTick size={15} /> : null}
                  sub={[t.business.area, t.business.city].filter(Boolean).join(", ") || undefined}
                  right={<ToolChip word={t.seatWord} fg={t.seatColour} bg={`${t.seatColour}1f`} />}
                />
                <ToolActions>
                  <DetailLink href={`/team/other/business/${t.business.id}`} name={t.business.name} tint={studioTint} />
                </ToolActions>
              </ToolCard>
            </div>
          ))}
        </div>
      ) : null}

      {artistTeams.length > 0 ? (
        <div data-testid="artist-teams">
          <div style={head}>Artist teams you are on · {artistTeams.length}</div>
          {artistTeams.map((t) => (
            <div key={t.businessId} style={{ marginBottom: 10 }}>
              <ToolCard testId="artist-team" href={t.ownerId ? `/person/${t.ownerId}` : undefined} hrefLabel={`${t.name} — open the profile`}>
                <ToolHead
                  tint={tint}
                  name={t.name}
                  photoPath={t.photoPath}
                  eyebrow="Artist · Team"
                  sub={t.city ?? undefined}
                  right={<ToolChip word={t.seatWord} fg={t.seatColour} bg={`${t.seatColour}1f`} />}
                />
                <ToolActions>
                  <DetailLink href={`/team/other/business/${t.businessId}`} name={t.name} tint={tint} />
                </ToolActions>
              </ToolCard>
            </div>
          ))}
        </div>
      ) : null}

      {rentOnly.length > 0 ? (
        <div data-testid="rent-venues">
          <div style={head}>Studios you rent from · {rentOnly.length}</div>
          {rentOnly.map((v) => {
            const paid = v.payments.reduce((n, p) => n + (p.status === "done" ? p.amountInr : 0), 0);
            return (
              <div key={v.venueBusinessId} style={{ marginBottom: 10 }}>
                <ToolCard testId="rent-venue-card">
                  <ToolHead
                    tint={rentTint}
                    name={v.venueName}
                    photoPath={null}
                    eyebrow="Studio · You rent here"
                    sub={`${v.unpaid.length} ${v.unpaid.length === 1 ? "class" : "classes"} not paid for · ${rupees(paid)} paid`}
                  />
                  <ToolActions>
                    <DetailLink href={`/team/other/business/${v.venueBusinessId}?show=rent`} name={v.venueName} tint={rentTint} />
                  </ToolActions>
                </ToolCard>
              </div>
            );
          })}
        </div>
      ) : null}

      {crews.length > 0 ? (
        <div data-testid="member-crews">
          <div style={head}>Crews you are in · {crews.length}</div>
          {crews.map((c) => (
            <CrewCard key={c.id} crew={c} own={false} since={c.since} foundedByMe={c.foundedByMe} detailHref={`/team/other/crew/${c.id}`} />
          ))}
        </div>
      ) : null}

      {empty ? (
        <div data-testid="other-teams-empty" style={{ border: "1.5px dashed var(--el)", borderRadius: 18, padding: "22px 16px", textAlign: "center", fontSize: 13, color: SUB }}>
          No studio, artist or crew has asked you onto their team yet.
        </div>
      ) : null}
    </div>
  );
}
