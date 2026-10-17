"use client";

import { ToolCard, ToolChip, ToolHead } from "@/components/ui/ToolCard";
import { CrewInvites, TeamInvites } from "@/features/inbox/components/JoinInvites";
import { DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { VerifiedTick } from "@/features/settings/components/settings-kit";
import { CrewCard } from "@/features/crews/components/CrewsHub";
import { publicProfilePath } from "@/lib/routes/publicProfile";
import { MUTED, SUB } from "@/lib/design/tokens";
import type { OtherTeamsData } from "@/features/staff/otherTeams";

const head: React.CSSProperties = { fontSize: 9.5, fontWeight: 900, letterSpacing: 1, color: MUTED, textTransform: "uppercase", margin: "6px 2px 8px" };

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
export function OtherTeams({ data, stayOn }: { data: OtherTeamsData; stayOn: string }) {
  const tint = DOS_TOOLS.team.c;
  const studioTint = DOS_TOOLS.studios.c;
  const { studioInvites, artistInvites, crewAsks, studioTeams, artistTeams, crews } = data;
  const empty = studioInvites.length + artistInvites.length + crewAsks.length + studioTeams.length + artistTeams.length + crews.length === 0;
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
              </ToolCard>
            </div>
          ))}
        </div>
      ) : null}

      {crews.length > 0 ? (
        <div data-testid="member-crews">
          <div style={head}>Crews you are in · {crews.length}</div>
          {crews.map((c) => (
            <CrewCard key={c.id} crew={c} own={false} since={c.since} foundedByMe={c.foundedByMe} />
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
