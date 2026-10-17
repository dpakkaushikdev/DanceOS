import type { MyMembership } from "@/repositories/businesses";
import type { AnsweredInviteRow } from "@/features/inbox/inviteRows";
import type { CrewInviteRow, TeamInviteRow } from "@/features/inbox/components/JoinInvites";
import type { AskKind } from "@/repositories/askSettings";
import type { CrewSummary } from "@/types/crew";

/** The Other Teams column's shapes and its two counts — a plain module, because
 *  the server page and the client desk both read them (a function exported from
 *  a "use client" file is a client reference on the server — 11 Oct 2026). */

/** an artist's team this person holds a seat on — drawn as the ARTIST, because
 *  an artist page has no face of its own (R24) */
export interface ArtistTeamRow {
  businessId: string;
  /** the artist's own name, else the page's */
  name: string;
  photoPath: string | null;
  /** the artist's person id — the card is a door to their profile */
  ownerId: string | null;
  city: string | null;
  seatWord: string;
  seatColour: string;
}

/** a studio's team this person holds a seat on (a trainer's, an assistant's, or
 *  the Visiting Faculty seat accepting a class gives — R19) */
export interface StudioTeamRow {
  business: MyMembership["business"];
  seatWord: string;
  seatColour: string;
}

export interface OtherTeamsData {
  studioInvites: TeamInviteRow[];
  artistInvites: TeamInviteRow[];
  crewAsks: CrewInviteRow[];
  studioTeams: StudioTeamRow[];
  artistTeams: ArtistTeamRow[];
  crews: Array<CrewSummary & { since: string; foundedByMe: boolean }>;
  /** every invitation already answered — studio, artist and crew — one sheet */
  answered: AnsweredInviteRow[];
  inboxOff: AskKind[];
}

/** how many things are in the column — the pill's count */
export const otherTeamsCount = (d: OtherTeamsData) =>
  d.studioInvites.length + d.artistInvites.length + d.crewAsks.length + d.studioTeams.length + d.artistTeams.length + d.crews.length;
/** how many wait on an answer — the pill's attention dot, and which column opens */
export const otherTeamsWaiting = (d: OtherTeamsData) => d.studioInvites.length + d.artistInvites.length + d.crewAsks.length;
