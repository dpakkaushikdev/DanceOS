import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CrewHome } from "@/features/crews/components/CrewHome";
import { CrewPublicPage } from "@/features/crews/components/CrewPublicPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findCrewById, findCrewMembers } from "@/repositories/crews";
import { findCrewFollowerCount, isFollowingCrew } from "@/repositories/follows";
import { findCrewHeaderPhotos } from "@/repositories/headerPhotos";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const loadCrew = cache(async (crewId: string) => {
  const supabase = await createSupabaseServerClient();
  return findCrewById(supabase, crewId);
});

export async function generateMetadata({ params }: { params: Promise<{ crewId: string }> }): Promise<Metadata> {
  const { crewId } = await params;
  if (!UUID_RE.test(crewId)) return { title: "Crew — DanceOS" };
  const crew = await loadCrew(crewId);
  return crew ? { title: `${crew.name} — Crew · DanceOS`, description: `${crew.style} crew in ${crew.city}, on DanceOS.` } : { title: "Crew — DanceOS" };
}

/** A crew's public page, for anybody — a stranger, a member, or its leader.
 *  Works signed out: RLS shows the crew, its CONFIRMED roster and its header
 *  pictures to everyone. Since 19 Sep 2026 it also reads whether the viewer
 *  follows the crew (and who the viewer is — an organization follows nothing). */
export default async function CrewPage({ params, searchParams }: { params: Promise<{ crewId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { crewId } = await params;
  if (!UUID_RE.test(crewId)) {
    notFound();
  }
  const crew = await loadCrew(crewId);
  if (!crew) {
    notFound();
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  /* ⚠ THE VIEWER'S OWN PROFILE IS NO LONGER READ (20 Sep 2026). It was fetched
     for one reason — "an organization does not follow" — and an organization
     follows since `20260920180000_an_organization_follows`. */
  /* ⚠ THE BATTLE RECORD WENT WITH EVENTS (29 Sep 2026): `findCrewEntries` read
     the events this crew had been entered into, and a crew enters nothing now. */
  /* ⚠ A CREW'S FOLLOWING IS ITS TEAM since 2 Oct 2026 (the user), so the
     confirmed roster read below is the whole of it — no second read */
  const [members, header, following, followers] = await Promise.all([
    findCrewMembers(supabase, crewId),
    findCrewHeaderPhotos(supabase, crewId),
    user ? isFollowingCrew(supabase, crewId) : Promise.resolve(false),
    /* the count on the Follow button (19 Sep 2026, later) */
    findCrewFollowerCount(supabase, crewId),
  ]);
  /* ⚠ ONE ADDRESS FOR THE CREW (28 Oct 2026, the user: "home and public profile
     are exactly the same so can combine these pages with edit only visible to the
     person who owns the page"). The LEADER gets the crew's own page — the pencil,
     the pictures' editors, the asked rows — and everybody else the public page.
     `/crews/{id}/manage` forwards here. `?edit=1` only asks; the leader test is
     the authority. */
  if (user && crew.leaderId === user.id) {
    return <CrewHome crew={crew} members={members} header={header} followers={followers ?? 0} editOpen={(await searchParams).edit === "1"} />;
  }
  /* the public page prints the confirmed; the leader's own asked rows are the desk's business */
  const confirmed = members.filter((m) => m.status === "confirmed");
  const viewer = user ? (crew.leaderId === user.id ? "leader" : confirmed.some((m) => m.userId === user.id) ? "member" : "other") : "other";
  return (
    <CrewPublicPage
      crew={crew}
      members={confirmed}
      header={header}
      viewer={viewer}
      following={following}
      followers={followers}
      signedIn={Boolean(user)}
    />
  );
}
