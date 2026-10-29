import Link from "next/link";
import { notFound } from "next/navigation";
import { StyleArt } from "@/features/styles/components/StyleArt";
import { BoardsBrowser } from "@/features/stats/components/BoardsBrowser";
import { loadBoard } from "@/features/stats/server/loadBoard";
import { SegmentedPanels } from "@/features/shell/components/SegmentedNav";
import { SectionCard } from "@/components/ui/SectionCard";
import { dosStyleColor } from "@/lib/constants/styles";
import { styleFromSlug, styleInfo } from "@/lib/constants/styleInfo";
import { countryCodes, flagSrc, isGlobal } from "@/lib/constants/countryFlags";
import { DOS_UI, INK, SUB, TAB_TITLE } from "@/lib/design/tokens";
import { BeatText } from "@/components/ui/BeatText";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClassTile } from "@/features/classes/components/ClassTile";
import { EnrollButton } from "@/features/classBookings/components/EnrollButton";
import { findPublishedClasses } from "@/repositories/classes";
import { findClassArtists, findClassIdsIRun, findClassesWithArtist } from "@/repositories/classPeople";
import { countEnrolledBySession, findMyEnrolledSessionIds } from "@/repositories/classBookings";
import type { ClassArtist } from "@/types/classPerson";
import type { ClassBookingStatus } from "@/types/classBooking";
import type { PublicClassListing } from "@/types/class";
import { resolveActingAs } from "@/repositories/actingAs";
import { canBookClass, noBookingWords } from "@/types/profile";
import { findNotablePeople } from "@/lib/styles/notablePhotos";
import Image from "next/image";

/** THE STATE (or the city, where a style comes from one) each style is FROM —
 *  only a place's name, never the sentence about it. A style that belongs to a
 *  whole country or to everywhere has none, and prints its country alone. */
const STYLE_STATE: Record<string, string> = {
  Bharatanatyam: "Tamil Nadu",
  Kathak: "Uttar Pradesh",
  Kathakali: "Kerala",
  Kuchipudi: "Andhra Pradesh",
  Manipuri: "Manipur",
  Mohiniyattam: "Kerala",
  Odissi: "Odisha",
  Sattriya: "Assam",
  Bhangra: "Punjab",
  Garba: "Gujarat",
  "Dandiya Raas": "Gujarat",
  Ghoomar: "Rajasthan",
  Kalbelia: "Rajasthan",
  Lavani: "Maharashtra",
  Bihu: "Assam",
  Giddha: "Punjab",
  "Sufi Whirling": "Konya",
  Bollywood: "Maharashtra",
  "Hip-Hop": "New York",
  Breaking: "New York",
  Popping: "California",
  Locking: "California",
  House: "Illinois",
  Waacking: "California",
  Krump: "California",
  Dancehall: "Kingston",
  Salsa: "New York",
  Samba: "Rio de Janeiro",
  Tango: "Buenos Aires",
  Flamenco: "Andalusia",
  "K-pop": "Seoul",
  Bachata: "Santo Domingo",
  Reggaeton: "San Juan",
  Zumba: "Cali",
};

/** The first year-like figure in an era sentence, as a year: a decade stays a
 *  decade ("Early 1970s" → "1970s"), a century becomes its first hundred
 *  ("19th century" → "1800s"), a bare year stays itself. "since 2010" is when a
 *  form was recognised, not when it began, so it is not read as one. */
function yearOfEra(era: string): string | null {
  const text = era.replace(/since \d{4}/gi, "");
  const m = text.match(/(\d{1,2})(?:st|nd|rd|th)\s*(?:[–-]\s*(?:(?:early|late|mid)\s+)?\d{1,2}(?:st|nd|rd|th)\s*)?centur/i) ?? null;
  const d = text.match(/(?<![\d,])(\d{3,4})(s?)(?!\d)/);
  const centuryAt = m ? (m.index ?? 0) : Infinity;
  const decadeAt = d ? (d.index ?? 0) : Infinity;
  if (m && centuryAt <= decadeAt) return `${Number(m[1]) - 1}00s`;
  if (d) return `${d[1]}${d[2]}`;
  return null;
}

/** A DANCE STYLE'S OWN PAGE (2 Oct 2026, the user: "page opens dance style —
 *  column 1: Photos, info, History, country, and Notable names — max 5 names,
 *  column 2 rankings for that particular dance style").
 *
 *  Lifted from the prototype's `StylePage` (9432-9544): the style's colour as
 *  the room, then TWO PARTS you choose between — "what IS Kathak" and "who is
 *  best at it" have nothing to do with each other, and pouring them down one
 *  scroll meant scrolling past the history every time you wanted the table
 *  (its own words, 9481-9486). Here they are Details and Rankings, the app's own
 *  segmented control, both rendered in one server pass.
 *
 *  ⚠ CLASSES IS THE FIRST COLUMN (10 Oct 2026, the user: "remove find classes
 *  button from below and add a column called classes alongside details and
 *  rankings … this should be the first section"): the page opens on every class
 *  of this style still to come, and the Find classes link under Details is gone.
 *  `?show=details` and `?show=rankings` still open the other two.
 *
 *  ⚠ PUBLIC, like Discover: the record is the same for everybody. The boards are
 *  `dance_chart`, which is signed-in only (Step 25 — a person's activity is not
 *  public data), so a stranger is told where the rankings are rather than
 *  meeting an error. */
export default async function StylePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const style = styleFromSlug(slug);
  if (!style) notFound();
  const info = styleInfo(style);
  const color = dosStyleColor(style);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* ⚠ no Crews board (18 Oct 2026, the user: "crew rankings to be removed for now") */
  /* ⚠ THE STATS SCREEN'S OWN BOARD, NARROWED TO THIS STYLE (30 Oct 2026, the
     user: "give similar rankings in dance style page with similar look and
     filters") — Dancers · Artists · Studios, the metric chips and the city, the
     state in the address beside `show=rankings` */
  /* ⚠ A BOARD THAT CANNOT BE READ IS AN EMPTY BOARD, never a 500 — this page is
     mostly an encyclopedia entry and must not fail over a leaderboard.
     ⚠ THE CLASSES COLUMN (10 Oct 2026, the user: "add a column called classes
     alongside details and rankings showing all class cards for that style. this
     should be the first section"). Every published class of this style still to
     come, in every city, read in the SAME round as the boards; a class nobody is
     confirmed to teach is left off, which is Discover's own rule (18 Sep 2026). */
  /* the notable dancers' own photos (29 Oct 2026) — resolved ahead of time, so
     this is a lookup, and a name without a photo is never drawn */
  const notable = findNotablePeople(info.notable.slice(0, 5));
  const [board, styleClassesRaw, mine] = await Promise.all([
    user
      ? loadBoard(supabase, { seg: sp.seg, city: sp.city, metric: sp.metric }, "artist", style).catch(() => null)
      : Promise.resolve(null),
    findPublishedClasses(supabase, 120, null, style).catch(() => [] as PublicClassListing[]),
    user ? findMyEnrolledSessionIds(supabase).catch(() => new Map<string, { id: string; status: ClassBookingStatus }>()) : Promise.resolve(new Map<string, { id: string; status: ClassBookingStatus }>()),
  ]);
  const ids = styleClassesRaw.map((c) => c.id);
  const sessionIds = styleClassesRaw.map((c) => c.session?.id).filter(Boolean) as string[];
  /* ⚠ THE PROFILE YOU ARE ACTING AS (11 Oct 2026, B23) — Discover's own gate: a
     studio or a crew books no class, so a card says so instead of Book Now */
  const actingAs = user ? await resolveActingAs(supabase, sp.as).catch(() => null) : null;
  const noClass = actingAs && !canBookClass(actingAs) ? noBookingWords(actingAs) : null;
  const [taught, counts, classArtists, ranIds] = await Promise.all([
    findClassesWithArtist(supabase, ids).catch(() => new Set<string>()),
    countEnrolledBySession(supabase, sessionIds).catch(() => new Map<string, number>()),
    findClassArtists(supabase, ids).catch(() => new Map<string, ClassArtist>()),
    /* ⚠ the classes the viewer RUNS (11 Oct 2026, `20261016090000`) — the database
       refuses them a seat, so the card says so instead of offering Book Now */
    findClassIdsIRun(supabase, user?.id, ids),
  ]);
  /* soonest first — the card that happens next is the one somebody is choosing */
  const styleClasses = styleClassesRaw
    .filter((c) => taught.has(c.id))
    .sort((a, b) => (a.session?.startsAt ?? "").localeCompare(b.session?.startsAt ?? ""));

  const show = sp.show === "rankings" ? "rankings" : sp.show === "details" ? "details" : "classes";
  const base = `/styles/${slug}`;
  /* ⚠ THE NEW LOOK (5 Oct 2026, the user: "Redesign stats page according to the
     new look and all dance style pages as well"): every block is the class
     page's section card — a tinted header band with a mark, then the content —
     in the STYLE's own colour, so the page reads as one style rather than as a
     stack of grey boxes */
  const mark = (d: React.ReactNode) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {d}
    </svg>
  );

  /* ⚠ THE FACTS SAY EACH THING ONCE (30 Oct 2026, the user: "handle the facts
     in a better way without repetition of things, when mentioned in the same way
     according to year. place things better here."). The four tiles repeated
     themselves: "Konya, Anatolia (present-day Turkey)" under a Turkey flag,
     "Kerala" beside "India" with nothing new, and WHEN printed "1970s" as a
     sentence where the year IS the fact. Now one card in three rows:
       FROM  — the flag and the country, with the region after it only when the
               region adds something (a "(present-day …)" aside is dropped,
               because the flag already says it);
       WHEN  — the year or century set as a figure, and the era's sentence under
               it only when it says more than the year (not "SINCE": Kalbelia's
               2010 is its UNESCO listing, not its start);
       FAMILY — one word. */
  /* ⚠ FROM IS THE FLAG, THE COUNTRY AND THE STATE — NOTHING ELSE (29 Oct 2026,
     the user: "from should only have flag, country name and state no extra
     details"). The `origin` sentence ("Tamil Nadu — the temples of Thanjavur")
     is not parsed for a state; the state is named here, one per style, and a
     style that has none (a global or a whole-country form) prints the country alone */
  const region = STYLE_STATE[style] ?? null;
  /* ⚠ WHEN IS A YEAR, NEVER A CENTURY (29 Oct 2026, the user: "when should only be
     written in years not century etc only year") — the first year-like figure in
     the era: a decade stays a decade ("1970s"), a century becomes its first year
     ("19th century" → "1800s"); an era that names neither draws no WHEN row */
  const when = yearOfEra(info.era);
  /* ⚠ ONE TYPE FOR ALL THREE VALUES (29 Oct 2026, the user: "from when and
     family should be handled better different fonts currently for each") — the
     key in the micro caps, the value in one size, one weight, one ink */
  const factRow = { display: "grid", gridTemplateColumns: "62px 1fr", gap: 10, alignItems: "center", padding: "11px 0" } as const;
  const factKey = { fontSize: 9, fontWeight: 900, letterSpacing: 0.8, color: "var(--muted)" } as const;
  const factValue = { fontSize: 14, fontWeight: 800, lineHeight: 1.35, color: INK } as const;

  const details = (
    <div>
      {/* ⚠ NO "THE DANCE" CARD (30 Oct 2026, the user: "remove big photo from
          details and place it with the dance style heading … can reduce the
          size"): the drawn dancer is a small square beside the title now, so it
          is on every column rather than a full-width block at the top of one. */}
      <SectionCard icon={mark(<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" />)} label="THE FACTS" col={color}>
        <div data-testid="style-facts">
          <div data-testid="style-fact-country" style={factRow}>
            <div style={factKey}>FROM</div>
            <div style={{ minWidth: 0 }}>
              {/* the flag stays beside the words — a long region wraps under the words, never the flag onto a line of its own */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span data-testid="style-flags" aria-hidden="true" style={{ display: "inline-flex", gap: 4, flexShrink: 0, marginTop: 2 }}>
                  {isGlobal(info.country) ? (
                    <span style={{ fontSize: 17, lineHeight: 1 }}>🌍</span>
                  ) : (
                    countryCodes(info.country).map((c) => (
                      // eslint-disable-next-line @next/next/no-img-element -- a small static flag; next/image would need a remote host entry for nothing
                      <img key={c} src={flagSrc(c)} alt="" width={24} height={16} style={{ width: 24, height: 16, objectFit: "cover", borderRadius: 3, boxShadow: "0 0 0 1px rgba(0,0,0,.12)" }} />
                    ))
                  )}
                </span>
                <span style={{ ...factValue, minWidth: 0 }}>
                  {info.country}
                  {region ? <span data-testid="style-fact-region"> · {region}</span> : null}
                </span>
              </div>
            </div>
          </div>
          {when ? (
            <div data-testid="style-fact-since" style={{ ...factRow, borderTop: "1.5px solid var(--el)" }}>
              <div style={factKey}>WHEN</div>
              <div style={factValue}>{when}</div>
            </div>
          ) : null}
          <div data-testid="style-fact-family" style={{ ...factRow, borderTop: "1.5px solid var(--el)", paddingBottom: 2 }}>
            <div style={factKey}>FAMILY</div>
            <div style={factValue}>{info.family}</div>
          </div>
        </div>
      </SectionCard>

      {/* HISTORY (9522-9527) */}
      <SectionCard icon={mark(<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2" />)} label="HISTORY" col={color}>
        {info.history.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 9, marginBottom: i === info.history.length - 1 ? 0 : 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: color, marginTop: 7, flexShrink: 0 }} />
            <span style={{ fontSize: 13, lineHeight: 1.55 }}>{f}</span>
          </div>
        ))}
      </SectionCard>

    </div>
  );

  /* NOTABLE NAMES (9514-9521, "Founders & pioneers") — at most five, as a
     sideways carousel of the people themselves (29 Oct 2026, the user: "notable
     names should be carousel with pics of actual person with name"). Each photo
     is the person's own from Wikipedia and opens their page; every name has one
     (scripts/notable-photos.mjs refuses a name without). Scroll-snap, no script. */
  const notableCard = (
    <SectionCard icon={mark(<path d="M12 3l2.4 5 5.6.8-4 3.9.9 5.6L12 15.8 7.1 18.3l.9-5.6-4-3.9 5.6-.8z" />)} label="NOTABLE NAMES" col={color}>
      {notable.length === 0 ? (
        <div style={{ fontSize: 12.5, color: SUB }}>{style} is carried by its dancers rather than by a few famous names.</div>
      ) : (
        <>
          <div data-testid="notable-carousel" style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", margin: "0 -4px", padding: "2px 4px 6px", scrollbarWidth: "none" }}>
            {notable.map((p) => (
              <a key={p.name} data-testid="notable-person" href={p.page} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} — on Wikipedia`} style={{ flex: "0 0 128px", scrollSnapAlign: "start", textDecoration: "none" }}>
                <div style={{ position: "relative", width: 128, height: 156, borderRadius: 16, overflow: "hidden", background: `${color}22` }}>
                  <Image src={p.photo} alt={p.name} fill unoptimized sizes="128px" style={{ objectFit: "cover", objectPosition: "50% 22%" }} />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 900, marginTop: 7, lineHeight: 1.25, color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.name}</div>
              </a>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Photos: Wikipedia</div>
        </>
      )}
    </SectionCard>
  );

  /* THE CLASSES COLUMN — the app's one class card, exactly as Discover's Classes
     shelf draws it, for every city (a style page is not about one place) */
  const classesPanel = (
    <SectionCard icon={mark(<path d="M3 5h18v15H3zM3 10h18M8 3v4M16 3v4" />)} label={`${style.toUpperCase()} CLASSES`} col={color}>
      <div data-testid="style-classes-count" style={{ fontSize: 11.5, fontWeight: 800, color: SUB, marginBottom: 10 }}>
        {styleClasses.length === 1 ? "1 class coming up" : `${styleClasses.length} classes coming up`}
      </div>
      {styleClasses.length === 0 ? (
        <div data-testid="style-classes-empty" style={{ textAlign: "center", padding: "22px 12px", border: "1.5px dashed var(--el)", borderRadius: 14, fontSize: 12.5, color: SUB }}>
          No {style} classes are coming up yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {styleClasses.map((c) => {
            const filled = c.session ? counts.get(c.session.id) ?? 0 : 0;
            return (
              <ClassTile
                key={c.id}
                danceClass={c}
                filled={filled}
                artist={classArtists.get(c.id) ?? null}
                city={c.venueStatus === "accepted" && c.venueCity ? c.venueCity : c.businessCity}
                href={`/c/${c.shareSlug}`}
                relation={c.session && mine.get(c.session.id)?.status === "enrolled" ? "booked" : null}
                actions={
                  c.session ? (
                    <EnrollButton
                      sessionId={c.session.id}
                      isFull={filled >= c.capacity}
                      isSignedIn={Boolean(user)}
                      mine={mine.get(c.session.id) ?? null}
                      priceInr={c.priceInr}
                      shareSlug={c.shareSlug}
                      cannotBookWhy={noClass ?? (ranIds.has(c.id) ? "You run this class" : null)}
                    />
                  ) : null
                }
              />
            );
          })}
        </div>
      )}
    </SectionCard>
  );

  const rankings = board ? (
    <BoardsBrowser
      chart={board.chart}
      segment={board.segment}
      metric={board.metric}
      city={board.city}
      cities={board.cities}
      basePath={`/styles/${slug}`}
      baseQuery="show=rankings"
      youId={user?.id ?? null}
      label={`WHO LEADS IN ${style.toUpperCase()}`}
    />
  ) : (
    <SectionCard icon={mark(<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4" />)} label={`WHO LEADS IN ${style.toUpperCase()}`} col={color}>
      {(
        <div style={{ textAlign: "center", padding: "22px 12px", border: "1.5px dashed var(--el)", borderRadius: 14, fontSize: 12.5, color: SUB }}>
          The {style} rankings are for people on DanceOS.{" "}
          <Link href="/login" style={{ color: INK, fontWeight: 800 }}>
            Sign in ›
          </Link>
        </div>
      )}
    </SectionCard>
  );

  return (
    <div style={{ background: "var(--bg)", color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", paddingBottom: 40 }}>
      {/* THE STYLE, AS A ROOM (9481-9496). Its colour bled off the top of the
          screen; since 5 Oct 2026 it is a soft wash INSIDE the top squircle —
          the shape every tab and tool page stands on — with the two columns in
          the same squircle as the heading, and the ink the page's own (white on
          a light style's colour was the one place the title could vanish). */}
      <div style={{ padding: "12px var(--dos-gutter) 0" }}>
        <SegmentedPanels
          key={show}
          label="Style"
          initial={show}
          sections
          plainBody
          tint={color}
          top={
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: SUB }}>DANCE STYLE</div>
              <h1 data-testid="style-title" style={{ ...TAB_TITLE, color: INK, marginTop: 4, overflowWrap: "anywhere" }}><BeatText text={style} /></h1>
              {/* no country / family chips here — they are THE FACTS card's (29 Oct 2026) */}
              {/* THE DANCER UNDER THE NAME (29 Oct 2026, the user: "style pic should
                  be below the name and should be a bit bigger to match the space"):
                  a band the width of the heading on the style's own colour, the
                  drawn figure a 148px square centred in it */}
              <div data-testid="style-art-frame" style={{ marginTop: 12, height: 156, borderRadius: 22, overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", background: `linear-gradient(160deg, ${color}, ${color}88)`, boxShadow: `0 6px 18px ${color}40` }}>
                <div style={{ position: "relative", width: 148, height: 148 }}>
                  <StyleArt style={style} frame="page" label={`${style} dancer in costume`} />
                </div>
              </div>
            </div>
          }
          segments={[
            { key: "classes", href: base, label: "Classes", aria: "Classes" },
            { key: "details", href: `${base}?show=details`, label: "Details", aria: "Details" },
            { key: "rankings", href: `${base}?show=rankings`, label: "Rankings", aria: "Rankings" },
          ]}
          panels={[
            { key: "classes", node: classesPanel },
            {
              key: "details",
              node: (
                <div>
                  {details}
                  {notableCard}
                </div>
              ),
            },
            { key: "rankings", node: rankings },
          ]}
        />
      </div>
    </div>
  );
}
