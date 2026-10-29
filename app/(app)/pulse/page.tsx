import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PulseScreen } from "@/features/pulse/components/PulseScreen";
import { loadBoard, type BoardQuery } from "@/features/stats/server/loadBoard";
import { amIPlatformAdmin } from "@/repositories/admin";
import { resolveActingAs } from "@/repositories/actingAs";
import { findMyUpcomingDeck } from "@/repositories/home";
import { findPublicPerson } from "@/repositories/publicPerson";
import { findMyHistory } from "@/repositories/stats";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { kindOf } from "@/types/profile";

export const metadata: Metadata = { title: "Pulse — DanceOS" };

/** /pulse — THE SECOND TAB (29 Oct 2026, the user: "Make a new page and give it a
 *  brand new name in bottom navbar — it should consist of Todays schedule, stats,
 *  rankings for that person, search bar from discover … also give an option on
 *  this page with a button to look at overall rankings as well").
 *
 *  Your day and your numbers, then the board — the stats screen's own BROWSE THE
 *  BOARDS card (the user, later the same day: "where you stand should be browse
 *  the board"), your row marked — and Overall rankings opening `/rankings`.
 *
 *  ⚠ Every read is one the app already makes — no migration. A studio or a crew
 *  profile has no Pulse: the switcher's cookie sends it to its own page, the same
 *  rule Discover keeps (C185). */
export default async function PulsePage({ searchParams }: { searchParams: Promise<BoardQuery> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/pulse")}`);

  const sticky = (await cookies()).get("dos_profile")?.value ?? "";
  if (sticky && sticky !== "me") {
    const inside = (await resolveActingAs(supabase, sticky)) ?? (await resolveActingAs(supabase, `crew-${sticky}`));
    if (inside) redirect(inside.kind === "crew" ? `/crew/${inside.id}` : `/studio/${inside.id}`);
  }

  const person = await findPublicPerson(supabase, user.id);
  if (!person) redirect((await amIPlatformAdmin(supabase)) ? "/admin/verifications" : "/onboarding");

  const query = await searchParams;
  const kind = kindOf(person.isArtist);
  const city = person.profile.city;
  const nowIso = new Date().toISOString();

  /* ⚠ the record's own rows (29 Oct 2026, the user: "replace the numbers section
     with the whole record on pulse") — the stats screen's read, and its rule that
     a class with no faculty is left off the record */
  const [deck, history, board] = await Promise.all([
    findMyUpcomingDeck(supabase, user.id, nowIso),
    findMyHistory(supabase).then((rows) => rows.filter((r) => r.artistName)),
    loadBoard(supabase, query, person.isArtist ? "artist" : "dancer"),
  ]);

  return (
    <PulseScreen
      me={{ id: user.id, name: person.profile.fullName, photoPath: person.profile.avatarPath ?? null, city, kind, isArtist: person.isArtist }}
      deck={deck}
      history={history}
      board={board}
      nowIso={nowIso}
    />
  );
}
