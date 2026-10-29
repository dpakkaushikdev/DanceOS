import type { SupabaseClient } from "@supabase/supabase-js";
import { findDiscoverCities } from "@/repositories/cities";
import { findChart, findPinnedChartRows, withChartPhotos } from "@/repositories/stats";
import { parseChartMetric, type ChartMetric, type ChartRow, type ChartSegment } from "@/types/stats";

/** The board's own state off an address — `seg`, `city`, `metric` — and the board
 *  it names (29 Oct 2026). Pulse and `/rankings` read it the way the stats page
 *  does, so the three boards cannot disagree about what an address means. */

const SEGMENTS: ChartSegment[] = ["dancer", "artist", "studio"];

export type BoardQuery = { seg?: string; city?: string; metric?: string };

export async function loadBoard(
  supabase: SupabaseClient,
  query: BoardQuery,
  fallback: ChartSegment,
  style: string | null = null,
  /** ids whose own row is pinned under the board when they are not on it (Pulse: you) */
  pins: string[] = [],
): Promise<{ chart: ChartRow[]; pinned: ChartRow[]; segment: ChartSegment; metric: ChartMetric; city: string | null; cities: string[] }> {
  const segment = SEGMENTS.includes((query.seg ?? "") as ChartSegment) ? (query.seg as ChartSegment) : fallback;
  const cityList = await findDiscoverCities(supabase);
  const city = cityList.some((c) => c.city === query.city) ? (query.city as string) : null;
  const metric = parseChartMetric(query.metric);
  const chart = await findChart(supabase, { segment, city, style })
    .then((rows) => withChartPhotos(supabase, rows))
    .catch(() => [] as ChartRow[]);
  /* a style's board is narrowed by style; `entity_chart_row` is not, so nothing is pinned there */
  const pinned = pins.length && !style ? await findPinnedChartRows(supabase, { segment, city, ids: pins, onBoard: chart }).catch(() => [] as ChartRow[]) : [];
  return { chart, pinned, segment, metric, city, cities: cityList.map((c) => c.city) };
}
