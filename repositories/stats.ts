import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_STATS, type ChartRow, type ChartSegment, type DanceStats, type HistoryRow, type Side } from "@/types/stats";

/** Step 25's reads. All four are database functions, because a figure and the
 *  list behind it must be the same number (prototype 9950) and a leaderboard has
 *  to see across people RLS rightly hides from each other. Nothing is added up
 *  in TypeScript. */

interface StatsRow {
  sessions_conducted: number;
  sessions_assisted: number;
  sessions_attended: number;
  hours_conducted: number;
  hours_assisted: number;
  hours_attended: number;
  points: number;
  styles: number;
  studios: number;
  artists: number;
  first_session: string | null;
  last_session: string | null;
}

interface HistRow {
  session_id: string;
  side: Side;
  class_id: string;
  share_slug: string | null;
  title: string;
  style: string;
  room: string | null;
  city: string | null;
  business_id: string | null;
  business_name: string | null;
  artist_name: string | null;
  starts_at: string;
  ends_at: string;
  minutes: number;
}

interface ChartRawRow {
  place: number;
  kind: ChartSegment;
  id: string;
  name: string;
  city: string | null;
  style: string | null;
  conducted: number;
  assisted: number;
  attended: number;
  hours: number;
  extra: number;
  points: number;
  population: number;
}

/* ⚠ EVERY READ BELOW HAS A CALLER AGAIN — 29 Sep 2026.
 *
 *  For one day these four were marked NO CALLER: `StatsScreen` had been deleted
 *  when the two stats screens were collapsed into the thin one, and the History
 *  library and the four leaderboards went with it. The note said "a board or a
 *  history screen is a SCREEN away rather than a rebuild" and kept them — which
 *  is exactly what it cost to put the three-column screen back the next day
 *  (`StatsPageBody`). The 28 Sep sweep's own finding, paid off: "an export
 *  nothing calls is sometimes a feature nobody can reach."
 *
 *  ⚠ All four are the CALLER'S OWN by construction — `my_dance_stats`,
 *  `my_session_history` and `my_chart_place` are scoped to `auth.uid()` inside
 *  the database and take no `p_user_id`, by Step 25's design. That is why the
 *  stats screen's History column and its graphs are drawn for the caller alone
 *  and say so on anybody else's record. `findChart` is a BOARD, not a person, so
 *  it answers any signed-in reader; `findEntityChartRow` answers for one
 *  entity and is what every profile's Rankings column stands on. */

/** The signed-in person's record. */
export async function findMyStats(supabase: SupabaseClient): Promise<DanceStats> {
  const { data, error } = await supabase.rpc("my_dance_stats");
  if (error) {
    throw new Error(`stats.mine failed: ${error.message}`);
  }
  const row = (Array.isArray(data) ? data[0] : data) as StatsRow | undefined;
  if (!row) {
    return EMPTY_STATS;
  }
  return {
    sessionsConducted: Number(row.sessions_conducted ?? 0),
    sessionsAssisted: Number(row.sessions_assisted ?? 0),
    sessionsAttended: Number(row.sessions_attended ?? 0),
    hoursConducted: Number(row.hours_conducted ?? 0),
    hoursAssisted: Number(row.hours_assisted ?? 0),
    hoursAttended: Number(row.hours_attended ?? 0),
    points: Number(row.points ?? 0),
    styles: Number(row.styles ?? 0),
    studios: Number(row.studios ?? 0),
    artists: Number(row.artists ?? 0),
    firstSession: row.first_session,
    lastSession: row.last_session,
  };
}

/** The library the figures open into — one row per side of every past session. */
export async function findMyHistory(supabase: SupabaseClient, limit = 200): Promise<HistoryRow[]> {
  const { data, error } = await supabase.rpc("my_session_history", { p_limit: limit });
  if (error) {
    throw new Error(`stats.history failed: ${error.message}`);
  }
  return ((data ?? []) as HistRow[]).map(histRowOf);
}

/** SOMEBODY ELSE'S SESSIONS (11 Oct 2026, the user: "full stats page should be
 *  visible when looking at someone's profile. right now only top section
 *  visible"). `person_session_history` — the same shape as the caller's own,
 *  keyed on a person, and ⚠ PUBLIC CLASSES ONLY: a session counts here only on a
 *  published (or completed) class of a LISTED, live business, so nothing a
 *  private studio runs is published by it. Signed-in readers only.
 *
 *  ⚠ It degrades to an empty list rather than throwing, and that is deliberate:
 *  until `20261011090000` is applied the function does not exist (PostgREST
 *  answers PGRST202), and somebody's stats page must not 500 over the graphs
 *  below its figures. Empty is what the screen drew before. */
export async function findPersonHistory(supabase: SupabaseClient, userId: string, limit = 200): Promise<HistoryRow[]> {
  const { data, error } = await supabase.rpc("person_session_history", { p_user_id: userId, p_limit: limit });
  if (error) {
    return [];
  }
  return ((data ?? []) as HistRow[]).map(histRowOf);
}

/** ⚠ A STUDIO'S HELD SESSIONS (18 Oct 2026, the user: "studio records should be
 *  better and similar to a persons record page"). The sessions of its own
 *  PUBLISHED classes that have ENDED — rows a stranger already reads (a listed
 *  studio's published classes and their sessions are public since Step 3), so
 *  nothing is widened. Every row is `conducted`: a studio's side of the floor is
 *  the class it HELD. The teacher's name comes off the confirmed artist row,
 *  which Step 11 also makes public on a published class. No attendance is read —
 *  who came is not a stranger's to count. */
export async function findStudioHistory(
  supabase: SupabaseClient,
  businessId: string,
  business: { name: string; city: string | null },
  nowIso: string,
  limit = 300
): Promise<HistoryRow[]> {
  const { data, error } = await supabase
    .from("class_sessions")
    .select("id, starts_at, ends_at, class_id, classes!inner (id, title, style, room, share_slug, status, deleted_at)")
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .is("classes.deleted_at", null)
    .in("classes.status", ["published", "completed"])
    .lt("ends_at", nowIso)
    .order("starts_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return studioRowsOf(supabase, data as unknown as StudioSessionRow[], businessId, business);
}

interface StudioSessionRow {
  id: string;
  starts_at: string;
  ends_at: string;
  class_id: string;
  classes: { id: string; title: string; style: string; room: string | null; share_slug: string | null; status: string; deleted_at: string | null } | null;
}

async function studioRowsOf(
  supabase: SupabaseClient,
  rows: StudioSessionRow[],
  businessId: string,
  business: { name: string; city: string | null }
): Promise<HistoryRow[]> {
  const live = rows.filter((r) => r.classes && !r.classes.deleted_at && (r.classes.status === "published" || r.classes.status === "completed"));
  const classIds = [...new Set(live.map((r) => r.class_id))];
  const artists = new Map<string, string>();
  if (classIds.length) {
    const { data } = await supabase
      .from("class_people")
      .select("class_id, profiles (full_name)")
      .in("class_id", classIds)
      .eq("kind", "artist")
      .eq("status", "confirmed")
      .is("deleted_at", null);
    for (const a of (data ?? []) as unknown as Array<{ class_id: string; profiles: { full_name: string | null } | null }>) {
      if (a.profiles?.full_name) artists.set(a.class_id, a.profiles.full_name);
    }
  }
  return live.map((r) => ({
    sessionId: r.id,
    side: "conducted" as Side,
    classId: r.class_id,
    shareSlug: r.classes!.share_slug,
    title: r.classes!.title,
    style: r.classes!.style,
    room: r.classes!.room,
    city: business.city,
    businessId,
    businessName: business.name,
    artistName: artists.get(r.class_id) ?? null,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    minutes: Math.max(0, Math.round((Date.parse(r.ends_at) - Date.parse(r.starts_at)) / 60000)),
  }));
}

function histRowOf(r: HistRow): HistoryRow {
  return {
    sessionId: r.session_id,
    side: r.side,
    classId: r.class_id,
    shareSlug: r.share_slug,
    /* the database's own words: my_session_history returns classes.title and no
       level to derive from here. That column is "{style} · {level}" for every
       class the app has saved since 17 Sep 2026, and migration 20260917150000
       renames the rows from before it the same way. */
    title: r.title,
    style: r.style,
    room: r.room,
    city: r.city,
    businessId: r.business_id,
    businessName: r.business_name,
    artistName: r.artist_name,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    minutes: Number(r.minutes ?? 0),
  };
}

/** One board. Every row carries the population it was ranked out of. */
export async function findChart(
  supabase: SupabaseClient,
  input: { segment: ChartSegment; city?: string | null; style?: string | null; limit?: number }
): Promise<ChartRow[]> {
  const { data, error } = await supabase.rpc("dance_chart", {
    p_segment: input.segment,
    p_city: input.city ?? null,
    p_style: input.style ?? null,
    p_limit: input.limit ?? 20,
  });
  if (error) {
    throw new Error(`stats.chart failed: ${error.message}`);
  }
  return ((data ?? []) as ChartRawRow[]).map((r) => ({
    place: Number(r.place),
    kind: r.kind,
    id: r.id,
    name: r.name,
    city: r.city,
    style: r.style,
    conducted: Number(r.conducted ?? 0),
    assisted: Number(r.assisted ?? 0),
    attended: Number(r.attended ?? 0),
    hours: Number(r.hours ?? 0),
    extra: Number(r.extra ?? 0),
    points: Number(r.points ?? 0),
    population: Number(r.population ?? 0),
  }));
}

/** ONE BOARD ROW FOR ONE ENTITY (push 2, 19 Sep 2026, the user: "stats page on
 *  any profile should show all stats for that particular profile and rankings
 *  as well"): its figures, its place and the population it is ranked out of —
 *  nationally when `city` is null, in that city otherwise. Signed in, anybody's;
 *  signed out, a public artist's, a listed studio's or a live crew's, and null
 *  for a plain user — `entity_chart_row`'s own gate. Null also when the entity
 *  has nothing on that board yet, which is the honest answer rather than "#0". */
export async function findEntityChartRow(
  supabase: SupabaseClient,
  input: { segment: ChartSegment; id: string; city?: string | null }
): Promise<ChartRow | null> {
  const { data, error } = await supabase.rpc("entity_chart_row", { p_segment: input.segment, p_id: input.id, p_city: input.city ?? null });
  if (error) {
    return null;
  }
  const r = (Array.isArray(data) ? data[0] : data) as ChartRawRow | undefined;
  if (!r) return null;
  return {
    place: Number(r.place),
    kind: r.kind,
    id: r.id,
    name: r.name,
    city: r.city,
    style: r.style,
    conducted: Number(r.conducted ?? 0),
    assisted: Number(r.assisted ?? 0),
    attended: Number(r.attended ?? 0),
    hours: Number(r.hours ?? 0),
    extra: Number(r.extra ?? 0),
    points: Number(r.points ?? 0),
    population: Number(r.population ?? 0),
  };
}

/** Where the caller stands on a people board — null when they are not on it yet,
 *  which is the honest answer rather than "#0". */
export async function findMyPlace(
  supabase: SupabaseClient,
  segment: "dancer" | "artist",
  city?: string | null
): Promise<{ place: number; population: number; points: number } | null> {
  const { data, error } = await supabase.rpc("my_chart_place", { p_segment: segment, p_city: city ?? null });
  if (error) {
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { place: number; population: number; points: number } | undefined;
  return row ? { place: Number(row.place), population: Number(row.population), points: Number(row.points) } : null;
}
