import type { SupabaseClient } from "@supabase/supabase-js";
import { findMyAnsweredInvites, findMyPendingInvites } from "@/repositories/invites";
import { findArtistPageOwners, findBusinessPhotoPaths, findMyMemberships } from "@/repositories/businesses";
import { findMyAnsweredCrewAsks, findMyMemberCrews, findMyPendingCrewAsks } from "@/repositories/crews";
import { findMyInboxOff } from "@/repositories/askSettings";
import { crewAnsweredRow, isArtistTeam, teamAnsweredRow, teamSeatOf } from "@/features/inbox/inviteRows";
import type { AskKind } from "@/repositories/askSettings";
import type { OtherTeamsData } from "@/features/staff/otherTeams";

/** WHAT THE OTHER TEAMS COLUMN READS (18 Oct 2026, the user: "crew team and
 *  studio team should all be managed within teams in artist teams column and
 *  should be removed from studio and crew sections … should be called Other
 *  Teams"). Everything about belonging to somebody ELSE's team, in one place:
 *  the studios, artists and crews asking you on, and the teams you are already
 *  on. It replaced the Studios hub's Team column, the Crews hub's Member column
 *  and the Artist Teams column. Read for an artist's own Team desk and for a
 *  plain user's `/team` alike, so the two cannot disagree. Every read answers
 *  empty rather than throwing: a Team page must not break over the column a
 *  person may never open. */
export async function loadOtherTeams(supabase: SupabaseClient, userId: string): Promise<OtherTeamsData> {
  const [pending, answeredAll, memberships, inboxOff, crews, asks, answeredCrew] = await Promise.all([
    findMyPendingInvites(supabase).catch(() => []),
    findMyAnsweredInvites(supabase).catch(() => []),
    findMyMemberships(supabase).catch(() => []),
    findMyInboxOff(supabase, userId).catch(() => [] as AskKind[]),
    findMyMemberCrews(supabase).catch(() => []),
    findMyPendingCrewAsks(supabase, ["asked"]).catch(() => []),
    findMyAnsweredCrewAsks(supabase).catch(() => []),
  ]);
  /* the artist teams this person is ON — never their own page */
  const artistSeats = memberships.filter((m) => m.business.type === "artist_page" && m.memberRole !== "owner");
  const studioSeats = memberships.filter((m) => m.business.type === "studio" && m.memberRole !== "owner");
  const [owners, photos] = await Promise.all([
    findArtistPageOwners(supabase, artistSeats.map((m) => m.business.id)).catch(() => ({}) as Awaited<ReturnType<typeof findArtistPageOwners>>),
    findBusinessPhotoPaths(supabase, [...new Set([...pending.map((i) => i.businessId), ...answeredAll.map((i) => i.businessId)])]).catch(() => ({}) as Record<string, string | null>),
  ]);
  const face = (i: (typeof pending)[number]) => ({ ...i, photoPath: i.businessPhotoPath ?? photos[i.businessId] ?? null });
  const answered = [
    ...answeredAll.map((i) => teamAnsweredRow(i, photos[i.businessId] ?? null)),
    ...answeredCrew.map((a) => crewAnsweredRow(a, "receiver")),
  ].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  return {
    studioInvites: pending.filter((i) => !isArtistTeam(i.businessType)).map(face),
    artistInvites: pending.filter((i) => isArtistTeam(i.businessType)).map(face),
    crewAsks: asks.map((a) => ({ id: a.id, crewId: a.crewId, crewName: a.crewName, crewCity: a.crewCity, leaderName: a.leaderName, crewPhoto: a.crewPhoto ?? null })),
    studioTeams: studioSeats.map((m) => {
      const seat = teamSeatOf(m.memberRole);
      return { business: m.business, seatWord: seat.word, seatColour: seat.colour };
    }),
    artistTeams: artistSeats
      .filter((m) => owners[m.business.id]?.userId !== userId)
      .map((m) => {
        const o = owners[m.business.id];
        const seat = teamSeatOf(m.memberRole);
        return {
          businessId: m.business.id,
          name: o?.name ?? m.business.name,
          photoPath: o?.photoPath ?? m.business.photoPath ?? null,
          ownerId: o?.userId ?? null,
          city: m.business.city ?? null,
          seatWord: seat.word,
          seatColour: seat.colour,
        };
      }),
    crews,
    answered,
    inboxOff,
  };
}

export type { OtherTeamsData };
