import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PulseScreen } from "@/features/pulse/components/PulseScreen";
import { amIPlatformAdmin } from "@/repositories/admin";
import { resolveActingAs } from "@/repositories/actingAs";
import { findMyDeck } from "@/repositories/home";
import { findPublicPerson } from "@/repositories/publicPerson";
import { findChart, findEntityChartRow, findMyStats, withChartPhotos } from "@/repositories/stats";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { kindOf } from "@/types/profile";
import type { ChartRow, ChartSegment } from "@/types/stats";

export const metadata: Metadata = { title: "Pulse — DanceOS" };

/** /pulse — THE SECOND TAB (29 Oct 2026, the user: "Make a new page and give it a
 *  brand new name in bottom navbar — it should consist of Todays schedule, stats,
 *  rankings for that person, search bar from discover … also give an option on
 *  this page with a button to look at overall rankings as well").
 *
 *  Your day, your numbers and where you stand, on one screen: the search box
 *  (Discover's own, shared), Today's schedule (the deck put away on 28 Oct, C182),
 *  your record's figures, your standing nationally and in your city with the top
 *  of your board, and Overall rankings opening the full boards.
 *
 *  ⚠ Every read is one the app already makes — no migration. A studio or a crew
 *  profile has no Pulse: the switcher's cookie sends it to its own page, the same
 *  rule Discover keeps (C185). */
export default async function PulsePage() {
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

  const kind = kindOf(person.isArtist);
  const segment: ChartSegment = person.isArtist ? "artist" : "dancer";
  const city = person.profile.city;
  const nowIso = new Date().toISOString();

  const [deck, stats, everywhere, inCity, top] = await Promise.all([
    findMyDeck(supabase, user.id, nowIso),
    findMyStats(supabase),
    findEntityChartRow(supabase, { segment, id: user.id }),
    city ? findEntityChartRow(supabase, { segment, id: user.id, city }) : Promise.resolve(null),
    findChart(supabase, { segment, city: null, style: null, limit: 3 })
      .then((rows) => withChartPhotos(supabase, rows))
      .catch(() => [] as ChartRow[]),
  ]);

  return (
    <PulseScreen
      me={{ id: user.id, name: person.profile.fullName, photoPath: person.profile.avatarPath ?? null, city, kind }}
      segment={segment}
      deck={deck}
      stats={stats}
      standings={[
        { scope: "Everywhere", row: everywhere },
        ...(city ? [{ scope: `In ${city}`, row: inCity }] : []),
      ]}
      top={top}
      nowIso={nowIso}
    />
  );
}
