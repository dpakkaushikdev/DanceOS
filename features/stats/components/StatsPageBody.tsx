import { StatsScreen } from "@/features/stats/components/StatsScreen";
import { findDiscoverCities } from "@/repositories/cities";
import { findMyMembershipRole, runsTheBusiness } from "@/repositories/businesses";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { photoUrl } from "@/lib/media/photo";
import { findChart, findEntityChartRow, findPinnedChartRows, findMyHistory, findMyPlace, findMyStats, findPersonHistory, findStudioHistory, withChartPhotos } from "@/repositories/stats";
import { EMPTY_STATS, parseChartMetric, type ChartSegment, type DanceStats, type Standing } from "@/types/stats";

/* ⚠ "history" went on 2 Oct 2026 (the user: "remove history from stats for all
   profiles") — an old `?tab=history` link falls through to Record */
const TABS = ["record", "charts"] as const;
/* ⚠ NO CREW BOARD (18 Oct 2026, the user: "crew rankings to be removed for
   now"). `dance_chart` still answers for crews; nothing here asks it. */
const SEGMENTS: ChartSegment[] = ["dancer", "artist", "studio"];

export type StatsQuery = { tab?: string; seg?: string; city?: string; metric?: string; style?: string };

export interface StatsSubject {
  kind: "person" | "studio" | "crew";
  id: string;
  name: string;
  /** the profile's own picture (5 Oct 2026) — the hero wears it where it wore
   *  initials; a path in the public media bucket, or null */
  photoPath?: string | null;
  /** the kind's word over the name — Dancer · Artist · Studio · Crew */
  eyebrow: string;
  accent: string;
  /** the page this record belongs to */
  backHref: string;
  /** the board this subject stands on — NOT the board being browsed */
  segment: ChartSegment;
  city: string | null;
  isArtist: boolean;
  /** a person's figures, already read by the page: their own, or
   *  `person_dance_stats` for somebody else. Null for a studio and a crew,
   *  whose record is their board row. */
  stats?: DanceStats | null;
}

/** ONE STATS SCREEN, THREE COLUMNS, EVERY PROFILE (29 Sep 2026).
 *
 *  The user: *"you messed up with the stats page — it was supposed to be the one
 *  with the graphs and number grid, history and rankings in 3 columns for all
 *  profiles."* They are right, and this undoes C86: that day the two stats
 *  screens were collapsed the WRONG WAY ROUND — `StatsScreen`, the three-column
 *  one, was deleted and the thin `EntityStatsPage` kept, so the record's graphs,
 *  the number grid and the whole History library went with it. What the ask
 *  wanted was the rich screen made universal, not the poor one.
 *
 *  This is the gatherer for it, and it is a component rather than a route for
 *  the reason `OwnStatsScreen` was (C40, 22 Sep): seven of these reads are
 *  scoped to `auth.uid()` INSIDE the database, so they cannot be pointed at a
 *  subject from a redirect.
 *
 *  ⚠⚠ WHAT EACH COLUMN CAN HONESTLY ANSWER, AND WHY, because it is not uniform:
 *  · **Rankings** works for every profile and every reader — `entity_chart_row`
 *    answers for a public artist, a listed studio and a live crew even signed
 *    out, and `dance_chart` gives any signed-in reader the boards.
 *  · **Record** works for every profile: a person's three sides come from
 *    `person_dance_stats` (the same arithmetic as `my_dance_stats`, keyed on a
 *    person), a studio's and a crew's from their own board row.
 *  · **History, the graphs and the number grid's LISTS are the caller's own** —
 *    `my_session_history` has no `p_user_id` by Step 25's design, and there is
 *    no per-studio or per-crew equivalent at all. The columns are still drawn
 *    and say which read is missing, because an empty shelf would read as a
 *    measured zero. The migration that closes it is held for the user's word. */
export async function StatsPageBody({ subject, query, basePath }: { subject: StatsSubject; query: StatsQuery; basePath: string }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isMe = subject.kind === "person" && user?.id === subject.id;
  /** ⚠ `dance_chart` is granted to `authenticated` only (Step 25: "a person's
   *  activity is not public data"), so a signed-out reader gets the standings —
   *  which ARE public for a public entity — and is told where the boards are. */
  const canBrowseBoards = Boolean(user);

  const tab = (TABS as readonly string[]).includes(query.tab ?? "") ? (query.tab as (typeof TABS)[number]) : "record";
  /** the board being BROWSED. It opens on the subject's own, which is what
   *  somebody pressing Rankings on a profile came to see. */
  const segment: ChartSegment = SEGMENTS.includes((query.seg ?? "") as ChartSegment)
    ? (query.seg as ChartSegment)
    : SEGMENTS.includes(subject.segment)
      ? subject.segment
      : "dancer";
  const isCrew = subject.kind === "crew";
  const cityList = await findDiscoverCities(supabase);
  const city = cityList.some((c) => c.city === query.city) ? (query.city as string) : null;
  const metric = parseChartMetric(query.metric);

  /* the server's clock, once: the record's buckets are cut against it */
  const nowIso = new Date().toISOString();

  /* ⚠ the History column's UPCOMING read (`findMyCalendar`) went with it (2 Oct
     2026). The past sessions (`findMyHistory`) stay: Record's graphs and number
     grid are counted off them */
  const [ownStats, history, chart, myPlace, boardPlace, everywhere, inCity] = await Promise.all([
    isMe ? findMyStats(supabase) : Promise.resolve(null),
    /* somebody else's PUBLIC sessions (11 Oct 2026) — a signed-in reader, a person */
    isMe
      ? findMyHistory(supabase)
      : subject.kind === "studio"
        ? findStudioHistory(supabase, subject.id, { name: subject.name, city: subject.city }, nowIso)
        : user && subject.kind === "person"
          ? findPersonHistory(supabase, subject.id)
          : Promise.resolve([]),
    tab === "charts" && canBrowseBoards && !isCrew ? findChart(supabase, { segment, city, style: null }).then((rows) => withChartPhotos(supabase, rows)) : Promise.resolve([]),
    isMe ? findMyPlace(supabase, "dancer", null) : Promise.resolve(null),
    /* where YOU stand on THIS board — a people board only, and only when it is
       your own record (the prototype pins a "you" row on Dancers and Artists) */
    isMe && tab === "charts" && (segment === "dancer" || segment === "artist") ? findMyPlace(supabase, segment, city) : Promise.resolve(null),
    findEntityChartRow(supabase, { segment: subject.segment, id: subject.id }),
    subject.city && !isCrew ? findEntityChartRow(supabase, { segment: subject.segment, id: subject.id, city: subject.city }) : Promise.resolve(null),
  ]);

  /* ⚠ YOU AND THE PROFILE YOU ARE LOOKING AT, BOTH MARKED (30 Oct 2026, the user:
     "when checking someone elses stats and going in rankings should show your
     highlight the same way and the person you are looking at in different color
     highlight") — and each pinned under the list when the top 20 does not reach them */
  const peopleBoard = segment === "dancer" || segment === "artist";
  /* ⚠ A STUDIO LOOKING AT ITS OWN RANKING (30 Oct 2026, the user: "when studio
     viewing its own ranking its shows viewing and shows owners highlight as well
     should only show highlight for its studio"): somebody who RUNS the studio is
     not a visitor — the studio's row is THEIRS (YOU, emerald), and the owner's
     own person row is not marked, because the profile in view is the studio */
  const ownsSubject =
    Boolean(user) && subject.kind === "studio" && runsTheBusiness(await findMyMembershipRole(supabase, subject.id).catch(() => null));
  const youId = user && peopleBoard && !ownsSubject ? user.id : null;
  const ownId = ownsSubject && segment === "studio" ? subject.id : null;
  const subjectOnBoard = !isMe && !isCrew && !ownsSubject && (subject.kind === "studio" ? segment === "studio" : peopleBoard) ? subject.id : null;
  const pinned =
    tab === "charts" && canBrowseBoards && !isCrew && metric === "overall"
      ? await findPinnedChartRows(supabase, { segment, city, ids: [youId ?? "", subjectOnBoard ?? "", ownId ?? ""], onBoard: chart }).catch(() => [])
      : [];

  /* a crew keeps its board row (its record is counted from it) and no standings */
  const standings: Standing[] = isCrew ? [] : [{ scope: "Everywhere", row: everywhere }, ...(subject.city ? [{ scope: `In ${subject.city}`, row: inCity }] : [])];


  return (
    <StatsScreen
      name={subject.name}
      photo={photoUrl(subject.photoPath ?? null)}
      eyebrow={subject.eyebrow}
      accent={subject.accent}
      backHref={subject.backHref}
      subjectKind={subject.kind}
      isMe={isMe}
      sessionsRead={isMe || subject.kind === "studio" || (Boolean(user) && subject.kind === "person")}
      canBrowseBoards={canBrowseBoards}
      standings={standings}
      boardRow={everywhere}
      isArtist={subject.isArtist}
      stats={ownStats ?? subject.stats ?? EMPTY_STATS}
      history={history}
      chart={chart}
      segment={segment}
      metric={metric}
      city={city}
      cities={cityList.map((c) => c.city)}
      myPlace={myPlace}
      boardPlace={boardPlace}
      boardYouId={youId}
      boardOwnId={ownId}
      boardSubjectId={subjectOnBoard}
      boardPinned={pinned}
      tab={tab}
      nowIso={nowIso}
      basePath={basePath}
    />
  );
}
