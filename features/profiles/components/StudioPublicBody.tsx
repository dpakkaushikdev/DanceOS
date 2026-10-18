import { InvertedPanel } from "@/components/ui/InvertedPanel";
import { MembershipsOnSale } from "@/features/memberships/components/MembershipsOnSale";
import { photoUrl } from "@/lib/media/photo";
import type { MembershipOnSale as MembershipOnSaleRow } from "@/repositories/memberships";
import type { CalendarEntry } from "@/types/calendar";
import type { PublicTeamMember } from "@/types/publicProfile";
import type { Room } from "@/types/room";
import { NextSessions, type NextSessionsBooking } from "./NextSessions";
import { Connections, PeopleGrid, PersonChip } from "./profile-kit";
import { StudioPlace } from "./StudioPlace";

/** EVERYTHING UNDER A STUDIO'S TOP PANEL — the place (address, rooms, what it
 *  sells), the next sessions and the team by role.
 *
 *  ⚠ ONE COMPONENT FOR TWO SCREENS (12 Oct 2026, the user: "since home is now
 *  empty can show all elements from public profile page here as well"): the
 *  studio's public page and its own home draw this, so the two cannot drift —
 *  the lesson `PersonBody` was extracted for on 20 Sep. */
export function StudioPublicBody({
  businessName,
  isStudio,
  accent,
  address,
  rooms,
  memberships,
  signedIn,
  canBuy,
  nextSessions,
  booking,
  team,
}: {
  businessName: string;
  isStudio: boolean;
  accent: string;
  address: string;
  rooms: Room[];
  memberships: MembershipOnSaleRow[];
  signedIn: boolean;
  /** a member of the studio is not offered a pass of their own studio */
  canBuy: boolean;
  nextSessions: CalendarEntry[];
  booking?: NextSessionsBooking;
  team: PublicTeamMember[];
}) {
  /* the seats a studio's page names (19 Sep 2026) and the assistants (20 Sep);
     a `staff` seat is never named — a front-desk job is not a public association */
  const owners = team.filter((m) => m.role === "owner");
  const faculty = team.filter((m) => m.role === "trainer");
  const visiting = team.filter((m) => m.role === "visiting_faculty");
  const assistants = team.filter((m) => m.role === "assistant");
  const chip = (m: PublicTeamMember, word: string) => (
    <PersonChip key={m.userId} href={`/person/${m.userId}`} name={m.name} role={word} roleColour={accent} photo={photoUrl(m.photoPath)} />
  );
  const people = [
    ...owners.map((m) => chip(m, m.isOrg ? "Organization" : "Owner")),
    ...faculty.map((m) => chip(m, "Faculty")),
    ...visiting.map((m) => chip(m, "Visiting faculty")),
    ...assistants.map((m) => chip(m, "Assistant")),
  ];
  const onSale =<MembershipsOnSale memberships={memberships} businessName={businessName} accent={accent} signedIn={signedIn} canBuy={canBuy} />;
  return (
    <>
      {/* ⚠ THE PLACE AND WHAT IT SELLS ARE TWO SECTIONS (18 Oct 2026, the user:
          "membership and at the studio seprator should be at studio profiles") */}
      {isStudio ? <StudioPlace address={address} rooms={rooms} tint={accent} /> : null}
      {isStudio && memberships.length > 0 ? (
        <InvertedPanel ground="page" testId="studio-memberships">
          <MembershipsOnSale memberships={memberships} businessName={businessName} accent={accent} signedIn={signedIn} canBuy={canBuy} section />
        </InvertedPanel>
      ) : null}
      {nextSessions.length > 0 || (!isStudio && memberships.length > 0) ? (
        <InvertedPanel ground="page">
          <NextSessions entries={nextSessions} booking={booking} />
          {isStudio ? null : onSale}
        </InvertedPanel>
      ) : null}
      {/* ⚠ CONNECTIONS, ONE GRID (18 Oct 2026, the user: "remove sub heading for
          only crew and studio profiles as it is getting repeated") — the role is
          on every chip, so a heading per role said it twice. Owners first, then
          faculty, visiting faculty and assistants, as the groups were ordered. */}
      {people.length ? (
        <Connections n={people.length}>
          <PeopleGrid>{people}</PeopleGrid>
        </Connections>
      ) : null}
    </>
  );
}
