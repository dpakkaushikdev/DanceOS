import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { TopPanel } from "@/components/ui/TopPanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findProfileById } from "@/repositories/profiles";
import { ensureArtistPage, findMyMemberships } from "@/repositories/businesses";
import { findMyArtistPlan } from "@/repositories/plans";
import { findMyFollowedCrews, findMyFollowedPeople, findMyFollowing, findMyPersonFollowers, findTeamFollows, withTeamFollows } from "@/repositories/follows";
import { findPersonHeaderPhotos } from "@/repositories/headerPhotos";
import { findInstagramUsernames } from "@/repositories/instagram";
import { INSTAGRAM_PICTURE_COOKIE, instagramConfig, isInstagramPicture } from "@/lib/instagram/oauth";
import { findPublicStudioTeam } from "@/repositories/publicProfile";
import { PersonBody } from "@/features/profiles/components/PersonBody";
import { ProfileLink, ProfileShare } from "@/features/profiles/components/ProfileShare";
import { StatsChip } from "@/features/profiles/components/StatsChip";
import { headerMaxFor, photoUrl } from "@/lib/media/photo";
import { CARD, DOS_UI, GOLD, INK, LILAC, SUB } from "@/lib/design/tokens";
import { HomeBand } from "@/features/profiles/components/HomeBand";
import { HeaderEditButton, PicturesButton } from "@/features/profiles/components/PicturesSheet";
import type { HeroShot } from "@/features/profiles/components/HeroRail";
import { ROLE_RING, ScheduleBar } from "@/features/profiles/components/profile-kit";
import { ActionRow, CallButton, MailButton, MessageButton, whatsappHrefOf } from "@/features/profiles/components/ContactButtons";
import { ContactEditButton } from "@/features/profiles/components/ContactEditor";
import { EditModeButton, EditModeProvider } from "@/features/profiles/components/EditMode";
import { RecordListsProvider } from "@/features/profiles/components/RecordLists";
import { PersonDetailsEdit } from "@/features/profiles/components/EditProfileSheet";
import { EnquiryButton } from "@/features/enquiries/components/EnquirySheet";
import { HeroId, HeroPersonMeta, IdentityHero } from "@/features/profiles/components/hero-kit";
import type { PublicPerson } from "@/repositories/publicPerson";
import { KIND_WORD, heroMetaWords, kindOf, memberNoWords } from "@/types/profile";

/** YOUR OWN PAGE — WHAT USED TO BE HOME (28 Oct 2026).
 *
 *  The user: *"home and public profile are exactly the same so can combine these
 *  pages with edit only visible to the person who owns the page."* Since 12 Oct
 *  Home had drawn the profile page's own body, so the two were one screen at two
 *  addresses. `/person/{you}` renders this for its owner and the public page for
 *  everybody else; `/` is a redirect here (Rule 14), and the switcher's own row
 *  and the bar's Home point here.
 *
 *  ⚠ TODAY'S SCHEDULE IS GONE FROM IT, KEPT SAFE (the user: "remove todays
 *  schedule from home and keep it safe will use the whole part later"):
 *  `TodayShelf`, `PassDeck`, `CheckedInReveal` and `findMyDeck` stay in the repo
 *  with no caller. Putting it back is one read and one line.
 *
 *  ⚠ The corner's eye ("Public view") went: this IS the public page, and an eye
 *  opening the page it is on is C37's loop in its smallest form. The pencil stays,
 *  and every editor on the page is drawn only while it is pressed. */
export async function OwnHome({ userId, person, searchParams }: { userId: string; person: PublicPerson; searchParams: { ig?: string; ig_error?: string } }) {
  const supabase = await createSupabaseServerClient();

  const followersP = findMyPersonFollowers(supabase).catch(() => []);
  const followingPeopleP = findMyFollowedPeople(supabase).catch(() => []);
  const followedBusinessesP = findMyFollowing(supabase).catch(() => []);
  const followedCrewsP = findMyFollowedCrews(supabase).catch(() => []);
  /* a member follows their own teams, derived rather than stored (2 Oct 2026) */
  const teamsP = findTeamFollows(supabase, userId).catch(() => ({ businesses: [], crews: [] }));

  /* `withPhone`: the Call button and the contact ⊕ need the number (6 Oct 2026) */
  const [profile, memberships, plan] = await Promise.all([
    findProfileById(supabase, userId, { withPhone: true }),
    findMyMemberships(supabase),
    findMyArtistPlan(supabase),
  ]);
  if (!profile) notFound();

  const isArtist = Boolean(plan?.active);
  const kind = kindOf(isArtist);
  const headerMax = headerMaxFor(kind);
  const publicHref = `/person/${profile.id}`;

  const businessesOn = memberships.map((m) => m.business);
  const schedBiz = businessesOn.find((t) => t.type === "artist_page") ?? businessesOn[0] ?? null;
  const scheduleHref = schedBiz ? `/${schedBiz.type === "studio" ? "studio" : "artist"}/${schedBiz.id}/schedule` : null;
  const ownArtistPage = memberships.find((m) => m.business.type === "artist_page" && m.memberRole === "owner")?.business.id ?? null;
  const [header, pageId, followers, followingPeople, followedBusinesses, followedCrews, teams, artistTeam, igUsernames] = await Promise.all([
    findPersonHeaderPhotos(supabase, userId, headerMax),
    !isArtist ? Promise.resolve(null) : ensureArtistPage(supabase, profile, memberships),
    followersP,
    followingPeopleP,
    followedBusinessesP,
    followedCrewsP,
    teamsP,
    /* ⚠ NO NEXT SESSIONS ON YOUR OWN PAGE (12 Oct 2026, the user: "remove next
       sessions from home page only") — kept through the merge */
    ownArtistPage ? findPublicStudioTeam(supabase, ownArtistPage).catch(() => []) : Promise.resolve([]),
    /* CONNECT INSTAGRAM (18 Oct 2026) */
    findInstagramUsernames(supabase, [userId]),
  ]);
  const word = searchParams;
  const igConnected = igUsernames.get(userId) ?? null;
  const igReturned =
    word.ig && /^[A-Za-z0-9._]{1,30}$/.test(word.ig)
      ? { username: word.ig }
      : word.ig_error
        ? { error: word.ig_error.slice(0, 200) }
        : null;
  /* "USE YOUR INSTAGRAM PHOTO?" (20 Oct 2026) — asked once, on the return from a connect */
  const offered = igReturned && "username" in igReturned ? ((await cookies()).get(INSTAGRAM_PICTURE_COOKIE)?.value ?? "") : "";
  const photoOffer = isInstagramPicture(offered) ? offered : null;
  const instagram = instagramConfig() || igConnected ? { connected: igConnected, returned: igReturned, photoOffer } : null;
  const { businesses: followingBusinesses, crews: followingCrews } = withTeamFollows({ businesses: followedBusinesses, crews: followedCrews }, teams);

  const ring = ROLE_RING[kind];
  const face = photoUrl(profile.avatarPath);
  const place = profile.city ?? "";
  const metaLine = heroMetaWords(profile.age, place);
  /* an artist's asks go to the `artist_page` row behind them (R24); a plain user
     has none, so their row carries no Enquiry at all */
  const asksGoHere = isArtist ? pageId : null;
  const isPlainUser = !isArtist;
  const shots: HeroShot[] = header
    .filter((g) => g.url)
    .map((g, i) => ({ key: g.id, src: g.url as string, alt: `Header picture ${i + 1} of ${profile.fullName}` }));

  return (
    <EditModeProvider>
    <RecordListsProvider styles={profile.styles} socials={profile.socials}>
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, boxSizing: "border-box" }}>
      <div style={{ padding: "0 var(--dos-gutter)" }}>
        <TopPanel style={{ marginTop: 12 }}>
        <IdentityHero
          bare
          /* the old Profile tab's id — this page is that tab and Home at once (28 Oct 2026) */
          testId="my-hero"
          name={profile.fullName}
          grad={ring}
          eyebrow={KIND_WORD[kind]}
          eyebrowSub={profile.memberNo != null ? <HeroId>{memberNoWords(profile.memberNo)}</HeroId> : null}
          verified={Boolean(profile.verifiedAt)}
          meta={metaLine ? <HeroPersonMeta age={profile.age} city={place} /> : null}
          avatar={face}
          avatarAlt={profile.fullName}
          /* the disc opens both picture sections (19 Sep 2026) */
          avatarSlot={<PicturesButton profile={profile} grad={ring} avatar={face} />}
          shots={shots}
          headerEdit={headerMax > 0 ? <HeaderEditButton profile={profile} header={header} headerMax={headerMax} /> : null}
          /* the pencil alone — it toggles every editor on the page (26 Sep 2026) */
          corner={<EditModeButton />}
          detailsEdit={<PersonDetailsEdit profile={profile} />}
        >
          <HomeBand
            profile={profile}
            chips={
              <>
                <StatsChip href={`${publicHref}/stats`} />
                {/* your own code still watches for a check-in (2 Oct 2026) */}
                <ProfileShare path={publicHref} name={profile.fullName} watchCheckIn />
                <ProfileLink path={publicHref} name={profile.fullName} />
              </>
            }
            followers={followers}
            followingPeople={followingPeople}
            followingBusinesses={followingBusinesses}
            followingCrews={followingCrews}
            instagram={instagram}
          />
        </IdentityHero>
        <ActionRow marginTop={12}>
          {asksGoHere ? (
            <EnquiryButton
              businessId={asksGoHere}
              businessName={profile.fullName}
              businessType="artist_page"
              signedIn
              accent={ring[1]}
              cannotAsk="This is your own page — enquiries come to you here"
            />
          ) : null}
          {profile.phone && isArtist && profile.phonePublic ? <CallButton phone={profile.phone} /> : null}
          {!isPlainUser && profile.contactEmail ? <MailButton email={profile.contactEmail} /> : null}
          {!isPlainUser && whatsappHrefOf(profile.socials) ? <MessageButton href={whatsappHrefOf(profile.socials) as string} /> : null}
        </ActionRow>
        <ContactEditButton target={{ kind: "person", profile, isArtist }} />
        {scheduleHref ? <ScheduleBar href={scheduleHref} /> : null}
        </TopPanel>
        <PersonBody person={person} isMe signedIn memberships={[]} artistTeam={artistTeam} accent={ring[1]} />

        {/* THE ARTIST TOOLS COULD NOT BE MADE (18 Sep 2026) — said once, never a failed page */}
        {isArtist && !pageId ? (
          <div style={{ padding: "12px 0 0" }}>
            <div role="status" style={{ background: CARD, border: `1.5px solid ${GOLD}66`, borderLeft: `3px solid ${GOLD}`, borderRadius: 16, padding: "12px 14px", marginBottom: 10 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 900, color: INK }}>Your artist tools are still being set up</span>
              <span style={{ display: "block", fontSize: 11, color: SUB, marginTop: 3, lineHeight: 1.5 }}>
                Team, Students and Earnings open once they are ready. It could not be finished just now — open this page again in a moment, and if this stays, message DanceOS from Settings.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
    </RecordListsProvider>
    </EditModeProvider>
  );
}
