import { StudioHome } from "@/features/businesses/components/StudioHome";
import { photoUrl } from "@/lib/media/photo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findPublishedStylesByBusiness } from "@/repositories/classes";
import { findFollowerCounts } from "@/repositories/follows";
import { findPublicStudioTeam, findPublicBusiness } from "@/repositories/publicProfile";
import { studioTeamRows } from "@/features/profiles/teamFollowing";
import { countRoomsByBusinesses, findRoomsByBusiness } from "@/repositories/rooms";
import { findStudioProofPhotos } from "@/repositories/studioVerification";
import type { MyMembership } from "@/repositories/businesses";
import { findMembershipsOnSale } from "@/repositories/memberships";
import { fullAddressOf } from "@/lib/geo/fullAddress";
import { StudioPublicBody } from "@/features/profiles/components/StudioPublicBody";
import { PROFILE_RING } from "@/features/profiles/components/profile-kit";

/** A STUDIO'S OWN PAGE, AS THE PEOPLE WHO RUN IT SEE IT (28 Oct 2026).
 *
 *  What was `/business/{id}` (the studio's home, 14 Sep 2026). The user: *"home
 *  and public profile are exactly the same so can combine these pages with edit
 *  only visible to the person who owns the page."* `/studio/{id}` renders this
 *  for an owner or a manager and the public page for everybody else;
 *  `/business/{id}` forwards here (Rule 14), and its desks stay where they are.
 *
 *  ⚠ TODAY'S SCHEDULE IS GONE FROM IT, KEPT SAFE (`findStudioDeck`, `TodayShelf`
 *  stay in the repo with no caller), the user's "keep it safe will use the whole
 *  part later". */
export async function OwnStudioHome({ userId, membership, editOpen }: { userId: string; membership: MyMembership; editOpen: boolean }) {
  const supabase = await createSupabaseServerClient();
  const { business, memberRole } = membership;
  const businessId = business.id;
  const isOwner = memberRole === "owner";
  /* the pair that may change the studio's picture — the same pair the storage
     policy and set_business_profile_photo admit (20260829230000) */
  const canEditPhoto = isOwner || memberRole === "trainer";
  const place = [business.area, business.city].filter(Boolean).join(", ");
  const [photos, roomCounts, stylesByBusiness, editable, followerCounts, team, onSale, rooms] = await Promise.all([
    findStudioProofPhotos(supabase, businessId),
    countRoomsByBusinesses(supabase, [businessId]),
    findPublishedStylesByBusiness(supabase, [businessId]).catch(() => new Map<string, string[]>()),
    /* the studio as its Edit sheet reads it (About, Since, the pin…) — the owner's */
    isOwner ? findPublicBusiness(supabase, businessId).catch(() => null) : Promise.resolve(null),
    findFollowerCounts(supabase, [businessId]).catch(() => new Map<string, number>()),
    /* a studio's Following is its team (2 Oct 2026) */
    findPublicStudioTeam(supabase, businessId).catch(() => []),
    findMembershipsOnSale(supabase, businessId).catch(() => []),
    /* ⚠ NO NEXT SESSIONS on the people who run it's own view (12 Oct 2026) */
    findRoomsByBusiness(supabase, businessId).catch(() => []),
  ]);
  const address = editable
    ? await fullAddressOf({ lat: editable.lat ?? null, lng: editable.lng ?? null, locationSetAt: editable.locationSetAt ?? null }, place).catch(() => place)
    : place;

  return (
    <StudioHome
      business={business}
      photo={photoUrl(business.photoPath)}
      canEditPhoto={canEditPhoto}
      header={photos}
      ownerId={isOwner ? userId : null}
      editable={editable}
      editOpen={editOpen}
      roomCount={roomCounts[businessId] ?? 0}
      styles={business.styles.length ? business.styles : (stylesByBusiness.get(businessId) ?? [])}
      followers={followerCounts.get(businessId) ?? 0}
      followingRows={studioTeamRows(team)}
      body={
        <StudioPublicBody
          businessName={business.name}
          isStudio
          accent={PROFILE_RING.studio[1]}
          address={address}
          rooms={rooms}
          memberships={onSale}
          signedIn
          canBuy={false}
          nextSessions={[]}
          team={team}
        />
      }
    />
  );
}
