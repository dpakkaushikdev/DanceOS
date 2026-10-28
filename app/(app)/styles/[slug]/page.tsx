import Link from "next/link";
import { notFound } from "next/navigation";
import { StyleArt } from "@/features/styles/components/StyleArt";
import { StyleBoards } from "@/features/styles/components/StyleBoards";
import { SegmentedPanels } from "@/features/shell/components/SegmentedNav";
import { SectionCard } from "@/components/ui/SectionCard";
import { dosStyleColor } from "@/lib/constants/styles";
import { styleFromSlug, styleInfo } from "@/lib/constants/styleInfo";
import { DOS_UI, INK, SUB, TAB_TITLE } from "@/lib/design/tokens";
import { BeatText } from "@/components/ui/BeatText";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findChart } from "@/repositories/stats";
import { ClassTile } from "@/features/classes/components/ClassTile";
import { EnrollButton } from "@/features/classBookings/components/EnrollButton";
import { findPublishedClasses } from "@/repositories/classes";
import { findClassArtists, findClassIdsIRun, findClassesWithArtist } from "@/repositories/classPeople";
import { countEnrolledBySession, findMyEnrolledSessionIds } from "@/repositories/classBookings";
import type { ClassArtist } from "@/types/classPerson";
import type { ClassBookingStatus } from "@/types/classBooking";
import type { PublicClassListing } from "@/types/class";
import type { ChartRow, ChartSegment } from "@/types/stats";
import { resolveActingAs } from "@/repositories/actingAs";
import { canBookClass, noBookingWords } from "@/types/profile";
import { findNotablePeople, type NotablePerson } from "@/lib/styles/notablePhotos";
import Image from "next/image";

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
  const SEGS: ChartSegment[] = ["studio", "artist", "dancer"];
  /* ⚠ A BOARD THAT CANNOT BE READ IS AN EMPTY BOARD, never a 500 — this page is
     mostly an encyclopedia entry and must not fail over a leaderboard.
     ⚠ THE CLASSES COLUMN (10 Oct 2026, the user: "add a column called classes
     alongside details and rankings showing all class cards for that style. this
     should be the first section"). Every published class of this style still to
     come, in every city, read in the SAME round as the boards; a class nobody is
     confirmed to teach is left off, which is Discover's own rule (18 Sep 2026). */
  const [boardsList, styleClassesRaw, mine, notable] = await Promise.all([
    user
      ? Promise.all(SEGS.map(async (s) => [s, await findChart(supabase, { segment: s, style, limit: 20 }).catch(() => [] as ChartRow[])] as const))
      : Promise.resolve(null),
    findPublishedClasses(supabase, 120, null, style).catch(() => [] as PublicClassListing[]),
    user ? findMyEnrolledSessionIds(supabase).catch(() => new Map<string, { id: string; status: ClassBookingStatus }>()) : Promise.resolve(new Map<string, { id: string; status: ClassBookingStatus }>()),
    /* the notable dancers' own photos (29 Oct 2026) — never fails, at worst initials */
    findNotablePeople(info.notable.slice(0, 5)).catch(() => info.notable.slice(0, 5).map((name) => ({ name, photo: null, page: null }) as NotablePerson)),
  ]);
  const boards = boardsList ? (Object.fromEntries(boardsList) as Partial<Record<ChartSegment, ChartRow[]>>) : null;
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

  const details = (
    <div>
      {/* THE DANCER — drawn in the style's costume, pose and props (2 Oct 2026,
          replacing the photo). A square on the style's own colour, the figure
          fitted whole inside it. */}
      <SectionCard icon={mark(<path d="M12 4a2 2 0 1 0 0 .01M9 21l2-6-3-3 2-4h4l2 4-3 3 2 6" />)} label="THE DANCE" col={color}>
        <div data-testid="style-art-frame" style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 14, overflow: "hidden", background: `linear-gradient(160deg, ${color}, ${color}88)` }}>
          <StyleArt style={style} frame="page" label={`${style} dancer in costume`} />
        </div>
      </SectionCard>

      {/* INFO — the four facts (9508-9513), tiles inside one card now; the 3px
          coloured top edge went the way the tool cards' left edge went (4 Oct) */}
      <SectionCard icon={mark(<path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" />)} label="THE FACTS" col={color}>
        <div data-testid="style-facts" style={{ display: "grid", gap: 8 }}>
          {[
            ["WHERE IT BEGAN", info.origin],
            ["WHEN", info.era],
          ].map(([k, v]) => (
            <div key={k} style={{ background: `${color}10`, border: `1.5px solid ${color}33`, borderRadius: 12, padding: "10px 11px" }}>
              <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 0.6, color: "var(--muted)" }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 800, marginTop: 3, lineHeight: 1.35 }}>{v}</div>
            </div>
          ))}
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
     is the person's own from Wikipedia and opens their page; a name with no photo
     wears its initials. Scroll-snap, no script. */
  const initials = (n: string) => n.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const notableCard = (
    <SectionCard icon={mark(<path d="M12 3l2.4 5 5.6.8-4 3.9.9 5.6L12 15.8 7.1 18.3l.9-5.6-4-3.9 5.6-.8z" />)} label="NOTABLE NAMES" col={color}>
      {notable.length === 0 ? (
        <div style={{ fontSize: 12.5, color: SUB }}>{style} is carried by its dancers rather than by a few famous names.</div>
      ) : (
        <>
          <div data-testid="notable-carousel" style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", margin: "0 -4px", padding: "2px 4px 6px", scrollbarWidth: "none" }}>
            {notable.map((p) => {
              const face = (
                <>
                  <div style={{ position: "relative", width: 128, height: 156, borderRadius: 16, overflow: "hidden", background: `linear-gradient(150deg, ${color}, ${color}77)` }}>
                    {p.photo ? (
                      <Image src={p.photo} alt={p.name} fill unoptimized sizes="128px" style={{ objectFit: "cover", objectPosition: "50% 22%" }} />
                    ) : (
                      <span aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", fontSize: 30, fontWeight: 900, letterSpacing: -0.5 }}>
                        {initials(p.name)}
                      </span>
                    )}
                    <span aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 44, background: "linear-gradient(transparent, rgba(0,0,0,.45))" }} />
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 900, marginTop: 7, lineHeight: 1.25, color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.name}</div>
                </>
              );
              return p.page ? (
                <a key={p.name} data-testid="notable-person" href={p.page} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} — on Wikipedia`} style={{ flex: "0 0 128px", scrollSnapAlign: "start", textDecoration: "none" }}>
                  {face}
                </a>
              ) : (
                <div key={p.name} data-testid="notable-person" style={{ flex: "0 0 128px", scrollSnapAlign: "start" }}>
                  {face}
                </div>
              );
            })}
          </div>
          {notable.some((p) => p.photo) ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Photos: Wikipedia</div> : null}
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

  const rankings = (
    <SectionCard icon={mark(<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4" />)} label={`WHO LEADS IN ${style.toUpperCase()}`} col={color}>
      {boards ? (
        <StyleBoards style={style} color={color} boards={boards} />
      ) : (
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
            <>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: SUB }}>DANCE STYLE</div>
              <h1 data-testid="style-title" style={{ ...TAB_TITLE, color: INK, marginTop: 4 }}><BeatText text={style} /></h1>
              {/* ⚠ the top says WHAT it is in two chips; the long facts (where it
                  began, when) are THE FACTS card's alone — they were said in both
                  places (29 Oct 2026, the user: "items being repeated on the page") */}
              <div data-testid="style-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {[info.country, info.family].filter(Boolean).map((t) => (
                  <span key={t} style={{ fontSize: 11, fontWeight: 900, padding: "5px 10px", borderRadius: 999, background: `${color}1f`, color: INK, border: `1.5px solid ${color}55` }}>
                    {t}
                  </span>
                ))}
              </div>
            </>
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
