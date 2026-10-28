"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type PointerEvent as PointerEvent_, type MouseEvent as MouseEvent_ } from "react";
import { Portal } from "@/components/ui/Portal";
import { DosMark } from "@/components/ui/DosMark";
import { LogOutConfirm } from "@/features/auth/components/LogOutConfirm";
import { SettingsSheet, type SettingsProfile } from "@/features/settings/components/SettingsSheet";
import { ToolGlyph, TOOLS_HEADING, type Tile } from "@/features/home/components/tool-grid";
import { DOS_DISPLAY, DOS_UI, INK, RED } from "@/lib/design/tokens";
import type { ArtistPlan } from "@/repositories/plans";
import type { Profile, ProfileRole } from "@/types/profile";
import type { Business } from "@/types/business";
import { setToolOrderAction } from "@/features/home/server-actions/toolOrder";
import { toolsLayoutKey } from "@/features/home/toolOrder";
import { DrawerTools } from "@/features/shell/components/DrawerTools";
import { loadMyNotificationsAction, markNotificationsReadAction, myUnreadCountAction } from "@/features/notifications/server-actions/notifications";
import { NotificationsScreen } from "@/features/notifications/components/NotificationsScreen";
import type { AppNotification, NotificationPrefs } from "@/types/notification";
import { viewKey, viewToolOf, type ViewMode, type ViewTool } from "@/features/shell/viewMode";
import { ViewModeContext } from "@/features/shell/components/ViewToggle";

/* ⚠ A SWIPE IS NOT A TAP (2 Oct 2026, the user: "swiping on top right profile
   switches also switches profile"). The switcher sits at the screen's right edge,
   where a swipe — a scroll, or the phone's own back gesture — often starts, and a
   short drag still ends in a `click`. So the chip and every menu row remember where
   the finger went down and ignore the press if it travelled, or if the browser took
   the gesture over (`pointercancel`). One gesture at a time, so one record is enough;
   a keyboard press has no pointer and is never mistaken for a swipe. */
const SWIPE_SLOP = 8;
/** how far a vertical drag on the switcher must travel to change profile */
const SWIPE_SWITCH = 28;
const tap ={ x: 0, y: 0, moved: false };
const tapHandlers = {
  onPointerDown: (e: PointerEvent_) => { tap.x = e.clientX; tap.y = e.clientY; tap.moved = false; },
  onPointerMove: (e: PointerEvent_) => { if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > SWIPE_SLOP) tap.moved = true; },
  onPointerCancel: () => { tap.moved = true; },
};
/** True — and the press cancelled — when the press was really a swipe. */
function wasSwipe(e: MouseEvent_): boolean {
  if (!tap.moved) return false;
  tap.moved = false;
  e.preventDefault();
  return true;
}

/** App shell lifted from the prototype's root (DanceOSApp.jsx:19171-19397): the
 *  fixed top bar (wordmark on a tab, back chip + title on a drill page, round
 *  theme/settings chips) and the floating pill bar. The prototype keeps
 *  screens in a stack; here each tab and drill is a real route, so "which tab is
 *  lit" and "is the bar drawn at all" read off the pathname instead of the stack.
 *
 *  THREE IN THE BAR (19 Sep 2026, the user: "remove profile tab from navbar" —
 *  their name for the eye that had the fourth slot since 15 Sep). Stats left
 *  the bar on 15 Sep 2026 for a tile, then for the chip beside the QR; Profile
 *  left it for an EYE the same day — "the profile view, what a user will see
 *  when he clicks over a studio or artist" — and the eye has now left the bar
 *  too, for the corner of Home's hero, under the pencil. The bar is Home ·
 *  Discover · Inbox. /profile and /stats are still routes (a route is a
 *  promise, Rule 14): the gear opens the first, the chip the second, and both
 *  read as drill pages, with the back chip and a title. Recorded in CLAUDE.md's
 *  deviations table.
 *
 *  THE MARK IS THE PROFILE SWITCHER (18 Sep 2026, the user: "DanceOS icon on top
 *  left should give a drop down for profile switcher which takes to different
 *  profiles managed by that specific user"). One person runs several things —
 *  their own profile, the studios they are on the team of, the crews they lead —
 *  and each has a home of its own. The layout lists them (`switcher`); pressing
 *  the mark opens the list, the one you are on is marked, and each row is a
 *  door. Nothing is switched in a session sense: every row is a route.
 *
 *  A STUDIO'S HOME AND A CREW'S HOME ARE HOMES (18 Sep 2026, the user: "both
 *  crew and studios should get a home and inbox tab below on their home pages
 *  as both have enquiries to deal with"). On `/business/{id}` and
 *  `/crews/{id}/manage` — and on their inboxes — the bar is the ENTITY's: Home ·
 *  Inbox, and the top-left is the mark with the switcher rather than a back
 *  chip, because you are somewhere, not inside something. */

/* the DanceOS mark lives in components/ui/DosMark (3 Oct 2026) */
/* ── tab set — labels, tints and icons lifted from the shell (19313-19396).
   Calendar left the bar in the prototype's final design; the five that remain
   each carry their section's own accent. ── */
const ICON_STROKE = { fill: "none", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/* ⚠ `satisfies`, never `: Record<string, …>` — see TAB_SET below for what that
   one word costs when it is the other way round */
const TAB_ICONS = {
  Home: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" stroke={c} {...ICON_STROKE}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  ),
  Discover: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" stroke={c} {...ICON_STROKE}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15 9-2 4.2L9 15l2-4.2z" />
    </svg>
  ),
  /* ⚠ THE `Stats` ICON WAS HERE UNTIL 27 Sep 2026 — dead since 15 Sep, when C1
     took Stats off the bar for a chip beside the QR. Nothing drew it for twelve
     days, and it was only found because typing the label against this map made
     the compiler list what the map holds. A bar of three icons was carrying
     four. */
  /* ⚠ THE `Inbox` ICON LEFT WITH ITS TAB (18 Oct 2026, the user: "inbox to be
     renamed as Enquiries and should be shifted with tools and removed from bottom
     bar"). The desk is the Enquiries tool in the profile drawer now
     (`features/home/tiles.ts`), drawn with `GLYPH.enquiries`. */
  /* ⚠ THE `Enquiries` ICON WAS HERE FOR ONE DAY (27 Sep 2026). It was the fourth
     tab that morning and a TOOL TILE by the evening, at the same person's word
     ("enquiries should not be on navbar a tab in tools for all"), so the glyph
     MOVED to `GLYPH.enquiries` in tool-grid rather than being left here — which
     is the `Stats` lesson from earlier the same day, applied in the same hour
     instead of twelve days later: an icon nothing draws is found by nothing but
     the type that lists the keys. */
} satisfies Record<string, (c: string) => ReactNode>;

/* ⚠ DISCOVER IS BLUE AND HOME IS GREEN (2 Oct 2026, the user's own words) —
   the two had them the other way round */
const TAB_TINT = {
  Home: "#22C55E",
  Discover: "#3B82F6",
} satisfies Record<string, string>;

/** the three that are places of their own — the eye to the account's public page
 *  sits on Home's hero since 19 Sep 2026, not here.
 *
 *  ⚠ THE LABEL IS TYPED AGAINST THE TWO MAPS (27 Sep 2026), which is not
 *  tidiness. Both were `Record<string, …>`, and that is exactly how two Home
 *  tiles came to draw an EMPTY CHIP the same day: a key the map does not have
 *  compiles, looks up `undefined`, and renders nothing — typecheck, lint and
 *  `next build` all green. A fourth tab added without an icon would have been a
 *  blank square in the bar, and nothing but a pair of eyes would have said so.
 *  With `satisfies` on the maps and this label typed off them, that tab fails
 *  to compile instead. */
type TabLabel = keyof typeof TAB_ICONS & keyof typeof TAB_TINT;
/* ⚠ DISCOVER FIRST, HOME THIRD (2 Oct 2026, the user: "discover should always be
   the first tab and home the 3rd in navbar") — on the main bar and on a studio's
   or a crew's own bar alike, so the order never changes under the thumb */
const TAB_SET: Array<{ label: TabLabel; href: string }> = [
  { label: "Discover", href: "/discover" },
  { label: "Home", href: "/" },
];

/** ONE ROW OF THE PROFILE SWITCHER — a home this account can go to. Built by the
 *  layout, drawn here. */
export interface SwitcherItem {
  key: string;
  href: string;
  label: string;
  /** what this is to you — "Your profile", "Owner", "Faculty", "Crew you lead" */
  sub: string;
  /* ⚠ `org` (26 Sep 2026) went with organizations on 29 Sep */
  kind: "me" | "studio" | "crew";
  /** its picture, or null for initials (2 Oct 2026) */
  photo?: string | null;
  /** ITS TOOLS (12 Oct 2026) — drawn one per line in the drawer the picture
   *  opens, in the order this account arranged them. Built by the layout. */
  tiles?: (Tile & { count?: number; noteIds?: string[] })[];
  /** what is unread across this profile's tools (18 Oct 2026, `toolBadges`) */
  count?: number;
}

const SWITCH_TINT: Record<SwitcherItem["kind"], string> = { me: "#5AC8FA", studio: "#3B82F6", crew: "#DC2626" };

/* ⚠⚠ THE PROFILE YOU ARE IN IS STICKY (18 Oct 2026, the user: "when checking own
   classes from profile page button for studio profile switches back to artist …
   profile switching should only happen from profile switcher nowhere else").
   Until today the chip was decided by the PATHNAME alone, so any page that
   belongs to no profile — a class page, a public schedule, the calendar —
   fell back to your own account, and opening your studio's class "switched"
   you. Now the profile is remembered in a cookie: the switcher (a tap or a
   swipe) sets it, a studio's or a crew's own desk pages set it to that one (you
   are inside it), and every other page keeps whatever it was. A cookie rather
   than localStorage so the server renders the same chip the client will. */
/* ⚠ the layout reads the same name as its own literal — a value exported from
   this "use client" module would be a client reference on the server */
const ACTIVE_PROFILE_COOKIE = "dos_profile";
const activeListeners = new Set<() => void>();
const subscribeActive = (cb: () => void) => {
  activeListeners.add(cb);
  return () => {
    activeListeners.delete(cb);
  };
};
const readActiveCookie = (): string | null => {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${ACTIVE_PROFILE_COOKIE}=`));
  return hit ? decodeURIComponent(hit.slice(ACTIVE_PROFILE_COOKIE.length + 1)) : null;
};
const writeActiveProfile = (key: string) => {
  if (readActiveCookie() === key) return;
  document.cookie = `${ACTIVE_PROFILE_COOKIE}=${encodeURIComponent(key)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  activeListeners.forEach((f) => f());
};

/* AN ENTITY'S HOME (18 Sep 2026): a studio's own home and a crew's, with their
   inboxes — the pages that wear the entity's Home · Inbox bar instead of the
   main bar. Matched on a uuid so the static /business/stats, /earnings and /team
   are not mistaken for a studio. ⚠ An ORGANIZATION's home was `/business/{uuid}`
   too from 26 Sep 2026 and wore the same bar; it went on 29 Sep. */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/* ⚠ the studio's `/inbox` is no longer an entity TAB (18 Oct 2026): it is the
   Enquiries tool, a drill page like every other desk */
const STUDIO_HOME_RE = new RegExp(`^/business/(${UUID})$`, "i");
/* ⚠ A CREW HAS NO INBOX (11 Oct 2026, the user: "only enquiries to be handled
   from inbox"). A crew takes no enquiries, so its bar is Home alone and
   `/crews/{id}/inbox` forwards to its Team desk (next.config.ts). */
const CREW_HOME_RE = new RegExp(`^/crews/(${UUID})/manage$`, "i");
/* TOOL PAGES THAT ARE NOT A DRAWER ROW OF THEIR OWN (28 Oct 2026): a studio's
   and a crew's desks under its home, and the settings ledgers */
const TOOL_PAGE_RE = new RegExp(
  `^(/business/${UUID}/.+|/crews/${UUID}/manage/.+|/(payments|invoices|refunds|subscription|earnings|memberships|routines|practice|calendar|my-classes|team|crews|business|assets)(/.*)?)$`,
  "i"
);
interface Entity {
  kind: "studio" | "crew";
  home: string;
  /** what the Discover link carries so the shelf knows who is reading it */
  as: string;
}
const entityOf = (pathname: string): Entity | null => {
  const s = pathname.match(STUDIO_HOME_RE);
  if (s) return { kind: "studio", home: `/business/${s[1]}`, as: s[1]! };
  const c = pathname.match(CREW_HOME_RE);
  if (c) return { kind: "crew", home: `/crews/${c[1]}/manage`, as: `crew-${c[1]}` };
  return null;
};

/* ⚠ `titleFor` AND `DRILL_TITLES` WENT WITH THE TITLE (28 Sep 2026). They were
   ~90 lines mapping a path to the word the bar printed, and the bar prints the
   wordmark now on every screen. ⚠ WHAT THAT COSTS, said rather than discovered:
   a drill page's name is its own `<h1>` alone from here, so a page that never
   grew one has no accessible name at all — and this repo has found exactly that
   shape FIVE times (the desks 18 Sep, the studio Team desk 21 Sep, `EventForm`
   and `/rooms` 22 Sep, the Inbox 27 Sep).
   ⚠⚠ THE SWEEP RAN THE SAME DAY, AND IT WAS TWENTY-FOUR SCREENS: the whole admin
   panel, the class page, the event page, both registers, the calendar's three
   routes and both public schedules, the class listing, the roster, the enquiry
   detail, the join page, notifications, both support screens, the Crews and
   Studios hubs, the events desk, the welcome screen and onboarding's three
   steps. Nothing is drawn differently — the element that already WAS each page's
   visible name is the heading now. `shoot-tiles` ASSERTS a heading on every tile
   page from here, which is the check that would have caught this: it had been
   printing " NO h1" in its own label and judging on the status alone. */

/* the <html> class as an external store (theme boot script + toggle both write it) */
const subscribeToHtmlClass = (onChange: () => void): (() => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
};
const readTheme = (): "dark" | "light" =>
  document.documentElement.className === "light" ? "light" : "dark";
const readServerTheme = (): "dark" | "light" => "dark";

/** ⚠ 40px, WAS 34 (28 Sep 2026, the user: "with bigger buttons"). These are the
 *  bell and the gear — the two controls on every screen in the app — and 34 was
 *  under the 44px a finger is usually given. 40 with the bar at 62 keeps 11px of
 *  air above and below, so they are bigger without the bar feeling packed. */
/* ⚠ 44px since 2 Oct 2026 ("make the top bar a bit bigger") — the full 44 a finger
   is given, in a 70px bar, so the 13px of air above and below is unchanged. */
const chipStyle: React.CSSProperties = {
  /* 46 since 12 Oct 2026, in the 78px bar */
  width: 46,
  height: 46,
  borderRadius: 23,
  flexShrink: 0,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  background: "var(--chip-bg)",
  border: "1.5px solid var(--chip-line)",
};

const initialsOf = (name: string) => name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

/** A COUNT IN ITS OWN COLOUR (18 Oct 2026). Something new: the colour itself,
 *  deepened a touch so white reads on the lighter tools. Nothing new: a wash of
 *  the colour with the 0 in it — drawn, never hidden. */
const countPill = (c: string, n: number, size: number): React.CSSProperties => ({
  flexShrink: 0,
  minWidth: size,
  height: size,
  padding: "0 7px",
  boxSizing: "border-box",
  borderRadius: 999,
  background: n > 0 ? `color-mix(in srgb, ${c} 84%, #000)` : `color-mix(in srgb, ${c} 14%, transparent)`,
  border: n > 0 ? "none" : `1.5px solid color-mix(in srgb, ${c} 40%, transparent)`,
  color: n > 0 ? "#fff" : c,
  fontSize: size > 20 ? 11 : 10.5,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontVariantNumeric: "tabular-nums",
});

/** WHAT SETTINGS NEEDS, FOR EVERY PROFILE THIS ACCOUNT CAN BE (21 Sep 2026).
 *  Read once per render of the signed-in group and handed over whole, because
 *  the sheet is per-profile now and the chrome is the only thing that knows,
 *  from the pathname, which profile you are acting as. */
export interface ChromeSettings {
  profile: Profile | null;
  role: ProfileRole;
  plan: ArtistPlan | null;
  isAdmin: boolean;
  /** ⚠ the artist page this account OWNS, or null — never a business it is
   *  merely on the team of, and never an arbitrary pick among the ones it owns */
  ownBusiness: Business | null;
  /** every studio AND organization this account is on the team of (26 Sep
   *  2026), so the sheet can be THAT one's while you are inside it */
  businesses: Business[];
}

export function AppChrome({
  children,
  unread: unreadFromServer = 0,
  adminOnly = false,
  signedOut = false,
  switcher = [],
  settings = null,
  views = {},
  initialProfile = null,
}: {
  /** no account at all (28 Oct 2026, the welcome screen's Skip): no bell, and
   *  the picture is a blank person that opens sign-in */
  signedOut?: boolean;
  /** the sticky profile's key as the request's cookie had it, so the server
   *  draws the chip the client will (18 Oct 2026) */
  initialProfile?: string | null;
  /** the card/list choice stored per tool on the account (12 Oct 2026) */
  views?: Partial<Record<ViewTool, ViewMode>>;
  children: ReactNode;
  /** what the bell says — counted server-side for this render */
  unread?: number;
  /** a platform admin with no profile (9 Sep 2026): no tab bar, no bell, no gear — a Sign out instead; the queue is its whole app */
  adminOnly?: boolean;
  /** the homes this account can go to — its own, its studios, the crews it leads (18 Sep 2026) */
  switcher?: SwitcherItem[];
  /** the material behind the gear; null for an account with no profile at all */
  settings?: ChromeSettings | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  /* THE BELL IS LIVE (Batch 3, 28 Oct 2026): re-asked every 30 s and when the
     app comes back into view. A fresh server render always wins — the live
     answer is kept only while it was asked on top of the count it replaces,
     so this needs no effect that writes state from a prop. */
  const [liveUnread, setLiveUnread] = useState<{ n: number; base: number } | null>(null);
  const unread = liveUnread && liveUnread.base === unreadFromServer ? liveUnread.n : unreadFromServer;
  useEffect(() => {
    if (adminOnly || signedOut) return;
    let alive = true;
    const ask = () => {
      if (document.visibilityState !== "visible") return;
      void myUnreadCountAction()
        .then((n) => {
          if (alive) setLiveUnread({ n, base: unreadFromServer });
        })
        .catch(() => {});
    };
    const every = setInterval(ask, 30000);
    document.addEventListener("visibilitychange", ask);
    window.addEventListener("focus", ask);
    return () => {
      alive = false;
      clearInterval(every);
      document.removeEventListener("visibilitychange", ask);
      window.removeEventListener("focus", ask);
    };
  }, [adminOnly, signedOut, unreadFromServer]);
  /* CARD OR LIST, PER TOOL (12 Oct 2026) — `features/shell/viewMode.ts` says why
     the chrome owns it. A press shows the change at once and saves it behind;
     the stored choice is read again on the next render of the layout. */
  const viewTool = viewToolOf(pathname);
  const [viewPicks, setViewPicks] = useState<Partial<Record<ViewTool, ViewMode>>>({});
  const viewMode: ViewMode | null = viewTool ? (viewPicks[viewTool] ?? views[viewTool] ?? "card") : null;
  const pickView = (mode: ViewMode) => {
    if (!viewTool || mode === viewMode) return;
    setViewPicks((p) => ({ ...p, [viewTool]: mode }));
    void setToolOrderAction({ key: viewKey(viewTool), order: mode === "list" ? ["list"] : [] });
  };
  const search = useSearchParams();
  const activeTab = TAB_SET.find((t) => t.href === pathname)?.label ?? null;
  const isTab = activeTab !== null;
  /* a studio's or a crew's own pages wear the entity's bar and the mark */
  const entity = entityOf(pathname);
  /* ── AN ENTITY'S BAR CARRIES DISCOVER TOO (19 Sep 2026, the user: "studio and
     organizations can have Discover in navbar but should not be able to book any
     class or event"). A studio's own pages had Home · Inbox, so the one thing
     the user named as allowed was the one thing missing from them. Booking is
     what is refused, and it is refused where the button is drawn, not by hiding
     the shelf: a business reading Discover gets the sentence in place of Book.
     Discover is a DOOR out of the entity, never a lit tab here — pressing it
     leaves for the main bar.
     ⚠⚠ AND THE LINK CARRIES WHICH PROFILE PRESSED IT (`?as=`, 27 Sep 2026).
     Until today the gate was `profiles.role === "org"`, and R48 retired that
     role — so it refused nobody from 26 Sep and nothing said so, because what
     it withholds is a sentence rather than an exception. There is no
     organization ACCOUNT left to test; what there is is the profile you
     switched into, and `/discover` belongs to none by itself. ⚠ It is a
     REQUEST, not an authority: the page looks it up among the businesses this
     account is on the team of and the crews it leads before believing it. ── */
  /* ⚠⚠ AND DISCOVER LEFT THE ENTITY BAR AGAIN (2 Oct 2026, the user: "discover
     should not be visible in navbar when in crew or studio profile"). C21 put it
     there on 19 Sep; the user has now reversed that. A studio's and a crew's own
     pages are Inbox · Home, and Discover is one press away through the profile
     switcher (your own profile's bar carries it). `entity.as` is still built by
     the layout and simply unused here. */
  const bar: Array<{ label: TabLabel; href: string }> = entity
    ? [
        /* the entity's Inbox tab left on 18 Oct 2026 — Enquiries is a tool now */
        { label: "Home", href: entity.home },
        /* ⚠ ENQUIRIES LEFT THIS BAR THE SAME DAY IT JOINED IT (27 Sep 2026, the
           user: "enquiries should not be on navbar a tab in tools for all"). It
           is a TILE on this entity's own tool grid now, carrying `?as=` so the
           desk it opens is scoped to the profile whose grid was pressed. */
      ]
    : TAB_SET;
  /* ⚠ NO ONE-TAB BAR (28 Oct 2026, Batch 4). A studio's and a crew's own bar
     has shrunk to Home alone (Discover left it 2 Oct, the Inbox 18 Oct), and a
     bar holding one tab is a button to the page you are on. The general rule:
     fewer than two tabs, no bar — and no 80px clearance reserved for it. */
  const showBar = (isTab || entity !== null) && !adminOnly && bar.length >= 2;
  const routeLit = entity ? (pathname === entity.home ? "Home" : null) : activeTab;
  /* ⚠ THE TAB MOVES ON THE PRESS, NOT ON THE ARRIVAL (18 Oct 2026, the user:
     "navbar below should have some animation when switching"). The pressed tab
     lights at once and plays its pop while the page is still on its way; keyed
     on the page it was pressed FROM, so the arrival hands back to the route's
     own answer without an effect writing state. */
  const [pressedTab, setPressedTab] = useState<{ label: TabLabel; from: string } | null>(null);
  const lit = pressedTab && pressedTab.from === pathname ? pressedTab.label : routeLit;
  /* THE SWITCHER'S OPEN STATE IS KEYED ON THE PAGE IT WAS OPENED ON: a navigation
     changes the pathname, so the menu closes by itself without an effect writing
     state (this repo's setState-in-effect rule) */
  const [openFor, setOpenFor] = useState<string | null>(null);
  const menuOpen = openFor === pathname;
  /* SETTINGS IS A PANE OF THE DRAWER (12 Oct 2026, the user: "settings page open
     should be smoother now since it has moved"): the gear swaps the drawer's
     contents in place — no navigation, no second sheet — and ‹ Back swaps them
     back. Opening the drawer always starts on the profiles. `?settings=1` still
     opens the bottom sheet for a deep link. */
  const [pane, setPane] = useState<"main" | "settings">("main");
  /* ⚠ NOTIFICATIONS OPEN FROM THE LEFT, IN PLACE (18 Oct 2026, the user:
     "notification should open from left like profile switcher"). The bell is a
     button now; the list is read on the press (`loadMyNotificationsAction`) and
     drawn by the same `NotificationsScreen` the `/notifications` address still
     renders (Rule 14). Keyed on the page it was opened on, like the switcher, so
     tapping a row that navigates closes it by itself. */
  const [notifFor, setNotifFor] = useState<string | null>(null);
  const notifOpen = notifFor === pathname;
  const [notifData, setNotifData] = useState<{ notifications: AppNotification[]; prefs: NotificationPrefs; nowIso: string } | null>(null);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifStamp, setNotifStamp] = useState(0);
  const loadNotes = useCallback(async () => {
    const r = await loadMyNotificationsAction();
    if ("error" in r) setNotifError(r.error);
    else {
      setNotifError(null);
      setNotifData(r);
    }
  }, []);
  const openNotes = () => {
    setOpenFor(null);
    setNotifStamp((n) => n + 1);
    setNotifFor(pathname);
    void loadNotes();
  };
  /* LOG OUT ASKS FIRST (3 Oct 2026, the user: "should not log out without
     confirmation") — both the menu's Log out and an admin's Sign out open this
     rather than submitting */
  const [confirmOut, setConfirmOut] = useState(false);
  const closeOut = useCallback(() => setConfirmOut(false), []);
  /* a crew's home is /crews/{id}/manage, and its desks hang under /crews/{id} —
     all "here" for that crew, so the match is on the crew's root */
  const isHere = (item: SwitcherItem) => {
    if (item.href === "/") return pathname === "/";
    const root = item.kind === "crew" ? item.href.replace(/\/manage$/, "") : item.href;
    return pathname === root || pathname.startsWith(`${root}/`);
  };
  /* WHICH PROFILE THE CHIP WEARS (21 Sep 2026). On a studio's or a crew's own
     pages it is that one; everywhere else — a tab, a desk, a public page you
     have drilled into — it is your own account, which is the profile you are
     acting as. A `me` row always exists, so this is only null for an admin. */
  const pathItem = switcher.find(isHere) ?? null;
  const stickyKey = useSyncExternalStore(subscribeActive, readActiveCookie, () => initialProfile);
  const stickyItem = stickyKey ? (switcher.find((s) => s.key === stickyKey) ?? null) : null;
  const hereItem = pathItem ?? stickyItem ?? switcher.find((s) => s.kind === "me") ?? switcher[0] ?? null;
  /* being inside a studio's or a crew's own pages is being in that profile */
  useEffect(() => {
    if (pathItem) writeActiveProfile(pathItem.key);
  }, [pathItem]);
  const toolTotal = switcher.reduce((s, i) => s + (i.count ?? 0), 0);

  /* ⚠ OPENING A TOOL READS ITS NEWS (18 Oct 2026): the counts are unread
     notifications that open that tool, so landing on it marks exactly those read
     and the chrome re-reads — the badge goes because the thing it counted was
     seen, never on a timer. One call per tool visit, at most 200 ids. */
  /* ⚠ ONE TOOL LIT AT A TIME (18 Oct 2026, the user: "when clicking on students as
     an artist - studio and classes both getting highlighted together in profile
     switcher"). Each drawer row lit itself when the page started with its address,
     so an artist's Studios tool (`/business`) lit beside Students
     (`/business/{page}/students`). Only the LONGEST matching address is lit — the
     same rule the counts below already use. */
  const activeToolHref = (() => {
    let best: string | null = null;
    for (const t of hereItem?.tiles ?? []) {
      const p = t.href.split("?")[0];
      if ((pathname === p || pathname.startsWith(`${p}/`)) && (!best || p.length > best.split("?")[0].length)) best = t.href;
    }
    return best;
  })();
  /* ⚠⚠ A VISIBLE WAY BACK ON A TOOL PAGE (28 Oct 2026, Batch 4). The back chip
     was taken off every screen on 18 Oct ("remove back button … should not appear
     at all"), which left a page opened from the drawer with no way back but the
     phone's gesture. It is back — on TOOL pages only: any page whose address is
     one of the drawer's tools (the longest-match rule above, over every profile's
     tiles), a studio's or a crew's desks under its own home, and the settings
     ledgers. A tab, an entity's own home, a public page and the class page keep
     the bar as it was. */
  /* has this tab moved within the app since it loaded? Then back is a real step
     back; a cold landing (a deep link, a reload) goes to the profile's home. */
  const navRef = useRef<{ first: string | null; moved: boolean }>({ first: null, moved: false });
  useEffect(() => {
    if (navRef.current.first === null) navRef.current.first = pathname;
    else if (pathname !== navRef.current.first) navRef.current.moved = true;
  }, [pathname]);
  const onToolPage =
    !isTab &&
    entity === null &&
    pathname !== "/" &&
    (TOOL_PAGE_RE.test(pathname) ||
      switcher.some((i) =>
        (i.tiles ?? []).some((t) => {
          const p = t.href.split("?")[0];
          return p !== "/" && (pathname === p || pathname.startsWith(`${p}/`));
        })
      ));
  const goBack = () => {
    if (navRef.current.moved || (typeof document !== "undefined" && document.referrer.startsWith(window.location.origin))) {
      router.back();
      return;
    }
    router.push(hereItem?.href ?? "/");
  };
  const seenRef = useRef<string>("");
  useEffect(() => {
    /* ⚠ THE LONGEST MATCH, NOT THE FIRST (18 Oct 2026, found auditing the counts):
       the person's Studios tool is `/business`, which prefixes every studio desk —
       so `find` picked it on `/business/{id}/inbox`, marked the person's studio
       news read, and never cleared that desk's own count. The tool whose address
       is the longest prefix of this page is the one being opened. */
    const matches = switcher
      .flatMap((i) => i.tiles ?? [])
      .filter((t) => {
        const p = t.href.split("?")[0];
        return pathname === p || pathname.startsWith(`${p}/`);
      })
      .sort((a, b) => b.href.split("?")[0].length - a.href.split("?")[0].length);
    const tile = matches[0];
    if (!tile?.noteIds?.length) return;
    const sig = tile.noteIds.join(",");
    if (seenRef.current === sig) return;
    seenRef.current = sig;
    void markNotificationsReadAction({ ids: tile.noteIds.slice(0, 200) }).then((r) => {
      if (!r.error) router.refresh();
    });
  }, [pathname, switcher, router]);

  /* ⚠ SWIPE THE PHOTO TO MOVE PROFILE, THE WAY GOOGLE'S AVATAR DOES (2 Oct 2026,
     the user: "swiping up or down on profile pic should also switch profile …
     clicking on it it opens switcher how it is now"). A vertical swipe on the
     chip goes to the NEXT profile in the menu's own order (up) or the PREVIOUS
     one (down), wrapping at either end; a tap is untouched. It is only a swipe
     once it is clearly vertical and long enough — a sideways drag or a wobble
     does nothing at all, which is the 2 Oct "a swipe is not a tap" fix kept. */
  const swipeSwitch = (dy: number) => {
    if (switcher.length < 2 || !hereItem) return;
    const at = Math.max(0, switcher.findIndex((s) => s.key === hereItem.key));
    const next = switcher[(at + (dy < 0 ? 1 : -1) + switcher.length) % switcher.length];
    setOpenFor(null);
    writeActiveProfile(next.key);
    router.push(next.href);
  };

  /* ⚠⚠ THE SWIPE ON AN iPHONE IS NATIVE TOUCH, NOT POINTER EVENTS (2 Oct 2026,
     the user: "swipe from last chat not working on iphones for the profile
     switcher"). iOS Safari does not reliably honour `touch-action: none` on a
     control inside a fixed bar: it starts its own gesture (a page scroll, the
     pull-to-refresh, the edge back swipe), fires `pointercancel`, and the
     `pointerup` the swipe was read from never arrives — so on an iPhone nothing
     happened. The one thing iOS always obeys is `preventDefault()` on a
     NON-PASSIVE `touchmove`, and React registers touch listeners passive, so
     these are added by hand. The pointer path below is kept for a mouse and a
     pen, and told to stand aside for a touch so a swipe never switches twice. */
  const switcherRef = useRef<HTMLButtonElement>(null);
  const swipeRef = useRef(swipeSwitch);
  useEffect(() => {
    swipeRef.current = swipeSwitch;
  });
  useEffect(() => {
    const el = switcherRef.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let live = false;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return;
      sx = t.clientX;
      sy = t.clientY;
      live = true;
      tap.x = sx;
      tap.y = sy;
      tap.moved = false;
    };
    const move = (e: TouchEvent) => {
      if (!live) return;
      /* keep the page, the refresh and the back gesture off this finger */
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      if (t && Math.hypot(t.clientX - sx, t.clientY - sy) > SWIPE_SLOP) tap.moved = true;
    };
    const end = (e: TouchEvent) => {
      if (!live) return;
      live = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dy) >= SWIPE_SWITCH && Math.abs(dy) > Math.abs(dx) * 1.5) {
        tap.moved = true; // the click iOS may still send is not a tap
        if (e.cancelable) e.preventDefault();
        swipeRef.current(dy);
      }
    };
    const cancel = () => {
      live = false;
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end, { passive: false });
    el.addEventListener("touchcancel", cancel);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", cancel);
    };
  }, [adminOnly]);

  /* ══ SETTINGS, FOR THE PROFILE YOU ARE IN (21 Sep 2026, the user: "settings
     are seprate for each profile type according to which profile you are in").
     ⚠ `hereItem` is the whole answer and it already existed — it is what the
     switcher marks HERE, and its prefix match means a studio's DESKS count as
     being in that studio, not just its home. So the sheet's subject is decided
     by the same reading as the switcher's, and the two can never disagree about
     which profile you are in.
     ⚠ A studio the switcher names but `settings.studios` does not is a studio
     whose row failed to read; falling back to the account's own settings is
     better than a sheet with nothing in it. ══ */
  const activeSettings: SettingsProfile | null = !settings
    ? null
    : (() => {
        const mine: SettingsProfile = {
          kind: "me",
          profile: settings.profile,
          role: settings.role,
          plan: settings.plan,
          business: settings.ownBusiness,
        };
        if (!hereItem) return mine;
        if (hereItem.kind === "studio") {
          /* the same row the switcher named */
          const business = settings.businesses.find((t) => t.id === hereItem.key);
          return business ? { kind: "studio", business } : mine;
        }
        if (hereItem.kind === "crew") return { kind: "crew", crew: { id: hereItem.key, name: hereItem.label } };
        return mine;
      })();
  /* THE GEAR'S OWN HISTORY ENTRY (the rule moved here with the sheet, 19 Sep
     2026): it PUSHES `?settings=1` onto the page you are standing on, so closing
     is one step BACK — the same step the system gesture takes. A replace left
     the parameter standing one entry behind, so back re-opened the sheet and
     closing it again landed on a second, identical page: the "page keeps
     looping" that was reported. A deep link with nothing behind it is the one
     case that must replace instead. */
  const settingsOpen = search.get("settings") === "1";
  const openSettings = () => {
    const q = new URLSearchParams(search.toString());
    q.set("settings", "1");
    router.push(`${pathname}?${q.toString()}`);
  };
  const closeSettings = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    const q = new URLSearchParams(search.toString());
    q.delete("settings");
    const rest = q.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname);
  };
  /* ⚠ THE "MANAGING {STUDIO}" STRIP IS GONE (18 Sep 2026, the user: "remove the
     blue bar which shows exit studio from all pages"). It was asked about once
     before, on 16 Sep, and kept on the DESKS with the argument that a tool hero
     names the tool and nothing names the studio — the user has now answered that
     argument, so `WorkspaceStrip` and its server action are deleted rather than
     hidden. The back chip in the bar above is the way out of a desk; from a
     notification deep link, Home and Discover are one tap away in the tab bar. */

  /* theme lives on <html> (set pre-paint by the root layout's boot script) and is
     persisted under the prototype's key — the <html> class IS the store, so the
     toggle icon reads it through useSyncExternalStore instead of mirrored state */
  const theme = useSyncExternalStore(subscribeToHtmlClass, readTheme, readServerTheme);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.className = next;
    try {
      window.localStorage.setItem("__DOSTHEME", next);
    } catch {
      /* private mode — the toggle still works for this page load */
    }
  };

  return (
    <div
      style={
        {
          position: "relative",
          background: "var(--bg)",
          minHeight: "100vh",
          /* how much room a page leaves at the bottom (19173-19180): the tab bar floats
             over the end of a tab page, so the shell publishes the clearance and a
             screen reads it as padding-bottom: var(--dos-foot) */
          "--dos-foot": showBar ? "calc(80px + var(--dos-safe-bottom))" : "calc(16px + var(--dos-safe-bottom))",
        } as React.CSSProperties
      }
    >
      <a href="#dos-main" className="dos-skip">
        Skip to content
      </a>

      {/* ── the top bar: mark + wordmark on a tab; back chip + page title on a drill (19227-19266) ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          zIndex: 400,
          height: "var(--dos-top)",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "var(--dos-safe-top) 12px 0 14px",
          background: "var(--hdr-bg)",
          backdropFilter: "blur(18px) saturate(1.4)",
          WebkitBackdropFilter: "blur(18px) saturate(1.4)",
          /* ⚠ THE BAR'S BOTTOM EDGE IS A SQUIRCLE (12 Oct 2026, the user: "top bar
             becomes a bit more bigger and its outline at bootom of top bar also
             becomes squircle") — the outline runs down both sides and round the
             bottom corners rather than straight across */
          border: "1.5px solid var(--hdr-line)",
          borderTop: "none",
          borderRadius: "0 0 26px 26px",
        }}
      >
        {/* ⚠⚠ THE BACK CHIP COMES FIRST ON A DRILL PAGE, AND THE LOGO IS ALWAYS
            AFTER IT (28 Sep 2026, the user: "make sure not to show page name in
            the top bar now DanceOS logo should be constant").
            The bar used to be one of two things: the wordmark on a tab, or a
            back chip and the PAGE'S NAME on a drill. So the brand left the
            screen the moment anybody opened anything, which is the opposite of
            constant. The wordmark is drawn on every screen now and the title is
            gone. ⚠ Back is KEPT and moved to the leftmost place, where every
            phone puts it: it is the only wayfinding a drill page has left, and
            dropping it as well would stand somebody three taps inside Settings
            with nothing but the system gesture. */}
        {/* ⚠ THE BELL IS ON THE LEFT, AND BACK SITS BESIDE THE LOGO (18 Oct 2026,
            the user: "notification on top bar should go on left side and back
            button should appear left side of dance os logo"). The left edge
            holds the bell alone; the back chip rides in the centred brand group,
            immediately before the mark. */}
        <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, flex: 1 }}>
          {onToolPage && !adminOnly ? (
            <button type="button" data-testid="back-chip" aria-label="Go back" onClick={goBack} style={{ ...chipStyle, fontFamily: "inherit" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          ) : null}
          {adminOnly || signedOut ? null : (
          /* ⚠ NO DOT ON THE BELL'S CORNER (19 Oct 2026, the user: "notification when
             appears the red dot on top left on the bell looks bad find a better
             solution"). With something unread the chip itself becomes a filled pill —
             the bell and the count side by side, in the notification colour — and the
             bell rings once (`dosBellRing`, off under reduced motion). Nothing hangs
             off the chip's edge any more. */
          <button
            type="button"
            data-testid="bell"
            data-unread={unread > 0 ? "1" : "0"}
            aria-haspopup="dialog"
            aria-expanded={notifOpen}
            {...tapHandlers}
            onClick={(e) => { if (wasSwipe(e)) return; openNotes(); }}
            aria-label={unread > 0 ? `Notifications — ${unread} unread` : "Notifications"}
            style={{
              ...chipStyle,
              cursor: "pointer",
              fontFamily: "inherit",
              ...(unread > 0
                ? { width: "auto", minWidth: chipStyle.height, padding: "0 13px 0 11px", gap: 6, borderRadius: 999, background: "linear-gradient(135deg, #EC4899, #DB2777)", border: "1.5px solid transparent", boxShadow: "0 4px 14px rgba(236,72,153,.32)" }
                : null),
            }}
          >
            <svg key={unread > 0 ? `on-${unread}` : "off"} className={unread > 0 ? "dos-bell-ring" : undefined} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={unread > 0 ? "#fff" : INK} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
              <path d="M10.5 19a2 2 0 0 0 3 0" />
            </svg>
            {unread > 0 ? (
              <span data-testid="bell-badge" style={{ color: "#fff", fontSize: 13.5, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums", letterSpacing: -0.2 }}>
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </button>
          )}
        </span>
        {/* THE BRAND IS A DOOR TO DISCOVER (28 Oct 2026, the user: "clicking on
            dance os logo and name on top bar takes to discover"). It keeps the
            profile you are in, exactly as the bottom bar's Discover does. */}
        <Link
          href={
            hereItem && hereItem.kind !== "me"
              ? `/discover?as=${hereItem.kind === "crew" ? `crew-${hereItem.key}` : hereItem.key}`
              : "/discover"
          }
          aria-label="DanceOS — open Discover"
          data-testid="brand"
          style={{
            position: "absolute",
            left: "50%",
            top: "var(--dos-safe-top)",
            bottom: 0,
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            columnGap: 6,
            whiteSpace: "nowrap",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          {/* ⚠⚠ NO BACK CHIP, ON ANY SCREEN (18 Oct 2026, the user: "remove back
              button on left of logo should not appear at all"). The phone's own
              back gesture and the browser's back are the way out of a drill page;
              the drawer the picture opens and the bottom bar are the way home.
              ⚠ THE WORDMARK IS NEW THE SAME DAY (the user: "Dance OS logo font and
              color change completely dont like that white and pink color should be
              something else make it different with some different animation"):
              one word, upright, heavy and tight-tracked, filled with a teal → amber
              gradient that SLIDES slowly across it (`dosWordSheen`), "OS" a
              lighter weight so it still reads as two parts. One element animates —
              no per-letter wave — and reduced motion stops it. textContent stays
              "DanceOS" for the visually hidden copy; the role="img" name is the word. */}
          <span className="dos-logo-anim" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", lineHeight: 0 }}>
            <DosMark size={32} />
          </span>
          <span
            data-testid="wordmark"
            className="dos-wordmark"
            role="img"
            aria-label="DanceOS"
            style={{
              flexShrink: 0,
              fontSize: "clamp(21px, 5.8vw, 25px)",
              fontWeight: 900,
              letterSpacing: -1.1,
              lineHeight: 1,
              fontFamily: DOS_DISPLAY,
              whiteSpace: "nowrap",
              textTransform: "uppercase",
            }}
          >
            <span aria-hidden="true">Dance</span>
            <span aria-hidden="true" style={{ fontWeight: 500, letterSpacing: -0.4, marginLeft: 1 }}>OS</span>
          </span>
        </Link>
        <span style={{ display: "flex", gap: 7, flexShrink: 0 }}>
          {/* ⚠ THE THEME CHIP AND THE GEAR LEFT THE BAR (12 Oct 2026, the user:
              "dark and light mode like toggle on top of this section with settings
              on its right") — they head the drawer the picture opens now. An
              admin-only account has no drawer, so its Sign out stays here. */}
          {adminOnly ? (
            <button type="button" aria-label="Sign out" aria-haspopup="dialog" onClick={() => setConfirmOut(true)} style={{ ...chipStyle, width: "auto", padding: "0 13px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", color: INK, border: "none" }}>
              Sign out
            </button>
          ) : null}
          {/* THE PROFILE SWITCHER — the picture of the profile you are in, at the
              extreme right beside Settings (2 Oct 2026). Its ring is that kind's
              colour, so it still answers "which profile am I?" without opening. */}
          {adminOnly ? null : signedOut ? (
            /* NO ACCOUNT (28 Oct 2026, the way Cult has it — the user: "the
               profile icon shows no user image as sign up is skipped; clicking
               over blank user image redirects the user to the signup page"): a
               blank person where the picture would be, and it IS the door to
               sign-in; `next` brings them back to the page they were looking at */
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              data-testid="signin-chip"
              aria-label="Sign in"
              style={{ ...chipStyle, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", border: "2px solid var(--chip-line)", background: "var(--chip-bg)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8.5" r="3.6" />
                <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
              </svg>
            </Link>
          ) : (
            <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
            <button
              type="button"
              data-testid="profile-switcher"
              aria-label={`${hereItem ? `Switch profile — you are in ${hereItem.label}` : "Switch profile"}${toolTotal ? ` — ${toolTotal} new in your tools` : ""}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              ref={switcherRef}
              /* a TOUCH is read by the native listeners above (the iPhone fix);
                 these are the mouse's and the pen's, and the finger is captured
                 so a drag that leaves the 44px chip still ends here */
              onPointerDown={(e) => { if (e.pointerType === "touch") return; tapHandlers.onPointerDown(e); e.currentTarget.setPointerCapture?.(e.pointerId); }}
              onPointerMove={(e) => { if (e.pointerType !== "touch") tapHandlers.onPointerMove(e); }}
              onPointerCancel={(e) => { if (e.pointerType !== "touch") tapHandlers.onPointerCancel(); }}
              onPointerUp={(e) => {
                if (e.pointerType === "touch") return;
                const dx = e.clientX - tap.x;
                const dy = e.clientY - tap.y;
                if (Math.abs(dy) >= SWIPE_SWITCH && Math.abs(dy) > Math.abs(dx) * 1.5) swipeSwitch(dy);
              }}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => { if (wasSwipe(e)) return; setPane("main"); setOpenFor(menuOpen ? null : pathname); }}
              style={{ ...chipStyle, padding: 0, overflow: "hidden", fontFamily: "inherit", touchAction: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none", border: `2px solid ${hereItem ? SWITCH_TINT[hereItem.kind] : "var(--chip-line)"}`, background: hereItem ? `linear-gradient(135deg,${SWITCH_TINT[hereItem.kind]},${SWITCH_TINT[hereItem.kind]}88)` : "var(--chip-bg)" }}
            >
              {hereItem?.photo ? (
                <Image src={hereItem.photo} alt="" width={46} height={46} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }} />
              ) : (
                <span aria-hidden="true" style={{ color: "#fff", fontSize: 12.5, fontWeight: 900 }}>{hereItem ? initialsOf(hereItem.label) : "?"}</span>
              )}
            </button>
            {/* ⚠ NO COUNT ON THE PICTURE (18 Oct 2026, the user: "no notification
                red dot on the profile switcher on the profile pic"). The counts
                stay inside the drawer, on each profile row and each tool row. */}
            </span>
          )}
        </span>
      </div>

      {/* ── SETTINGS, FOR THE PROFILE YOU ARE IN (21 Sep 2026). Rendered by the
          chrome rather than by a page, which is the whole reason it can be
          per-profile; `?settings=1` on the current address is its open state, so
          it is a PLACE the system back gesture closes. ── */}
      {activeSettings ? <SettingsSheet open={settingsOpen} onClose={closeSettings} active={activeSettings} isAdmin={settings?.isAdmin ?? false} photo={hereItem?.photo ?? null} /> : null}

      {/* ── THE DRAWER THE PICTURE OPENS (12 Oct 2026, the user: "take the tools
          from the home section under the profile switcher from top right in one
          line for each tile. coming from right side now this entire section.
          dark and light mode like toggle on top of this section with settings on
          its right"). It slides in from the right edge of the app's column and
          holds, top to bottom: the theme toggle with the gear beside it, the
          profiles you can switch to, the TOOLS of the profile you are in — one
          row per tile, in the order this account arranged them — and Log out.
          The tools left the three homes for it. Portalled, because the top bar is
          a transformed element and a fixed scrim drawn inside it would cover the
          bar alone. A navigation changes the pathname, which closes it. ── */}
      {notifOpen && !adminOnly ? (
        <Portal>
          <div onClick={() => setNotifFor(null)} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,.4)" }} />
          <div style={{ position: "fixed", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 710, pointerEvents: "none", display: "flex", justifyContent: "flex-start" }}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Notifications"
              data-testid="notif-drawer"
              onKeyDown={(e) => { if (e.key === "Escape") setNotifFor(null); }}
              style={{ pointerEvents: "auto", width: "92%", maxWidth: 380, height: "100%", overflowY: "auto", boxSizing: "border-box", background: "var(--solid)", color: "var(--text)", borderRight: "1.5px solid var(--el)", borderRadius: "0 26px 26px 0", boxShadow: "18px 0 48px rgba(0,0,0,.4)", padding: "calc(var(--dos-safe-top) + 14px) 12px calc(var(--dos-safe-bottom) + 18px)", fontFamily: DOS_UI, animation: "dosDrawerLeft .22s ease" }}
            >
              {notifData ? (
                <NotificationsScreen
                  key={notifStamp}
                  variant="drawer"
                  notifications={notifData.notifications}
                  prefs={notifData.prefs}
                  nowIso={notifData.nowIso}
                  onClose={() => setNotifFor(null)}
                  onRefresh={() => void loadNotes()}
                  onRead={(k) =>
                    setLiveUnread((prev) => {
                      const cur = prev && prev.base === unreadFromServer ? prev.n : unreadFromServer;
                      return { n: Math.max(0, cur - k), base: unreadFromServer };
                    })
                  }
                />
              ) : (
                <div data-testid="notif-loading" style={{ padding: "40px 10px", textAlign: "center", fontSize: 13, color: notifError ? "#F87171" : "var(--muted)" }}>
                  {notifError ?? "Loading…"}
                </div>
              )}
            </div>
          </div>
        </Portal>
      ) : null}
      {menuOpen && !adminOnly ? (
        <Portal>
          <div onClick={() => setOpenFor(null)} style={{ position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,.4)" }} />
          <div style={{ position: "fixed", top: 0, bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, zIndex: 710, pointerEvents: "none", display: "flex", justifyContent: "flex-end" }}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Profiles and tools"
              data-testid="profile-drawer"
              onKeyDown={(e) => { if (e.key === "Escape") setOpenFor(null); }}
              style={{ pointerEvents: "auto", width: "86%", maxWidth: 340, height: "100%", overflowY: "auto", boxSizing: "border-box", background: "var(--solid)", color: "var(--text)", borderLeft: "1.5px solid var(--el)", borderRadius: "26px 0 0 26px", boxShadow: "-18px 0 48px rgba(0,0,0,.4)", padding: "calc(var(--dos-safe-top) + 14px) 12px calc(var(--dos-safe-bottom) + 18px)", fontFamily: DOS_UI, animation: "dosDrawerRight .22s ease" }}
            >
              {pane === "settings" && activeSettings ? (
                <SettingsSheet inline open onClose={() => setOpenFor(null)} onBack={() => setPane("main")} active={activeSettings} isAdmin={settings?.isAdmin ?? false} photo={hereItem?.photo ?? null} />
              ) : (
              <>
              {/* the theme toggle, with Settings on its right */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div role="group" aria-label="Theme" style={{ flex: 1, display: "flex", padding: 4, gap: 4, borderRadius: 999, background: "var(--el)" }}>
                  {(["light", "dark"] as const).map((t) => {
                    const on = theme === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        aria-label={on ? `${t === "dark" ? "Dark" : "Light"} theme — on` : `Switch to ${t} theme`}
                        onClick={() => { if (!on) toggleTheme(); }}
                        style={{ flex: 1, height: 38, borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: on ? "var(--text)" : "transparent", color: on ? "var(--solid)" : "var(--sub)" }}
                      >
                        {t === "light" ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
                          </svg>
                        )}
                        {t === "light" ? "Light" : "Dark"}
                      </button>
                    );
                  })}
                </div>
                {/* the gear opens Settings for THE PROFILE YOU ARE IN (21 Sep 2026),
                    as a pane of this drawer (12 Oct 2026) */}
                <button
                  type="button"
                  onClick={() => { if (activeSettings) setPane("settings"); else { setOpenFor(null); openSettings(); } }}
                  aria-label="Settings"
                  aria-expanded={false}
                  style={{ ...chipStyle, width: 46, height: 46, borderRadius: 23, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3.2" />
                    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" />
                  </svg>
                </button>
              </div>

              {/* the rows keep the switcher's own roles — a menu of profiles, each a
                  menuitem, Log out the last — while the tools stay links */}
              <div role="menu" aria-label="Your profiles">
              <div style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 1.2, color: "var(--muted)", padding: "0 6px 6px" }}>SWITCH PROFILE</div>
              {switcher.map((item) => {
                /* ⚠ ONE ROW IS ALWAYS THE ONE YOU ARE IN (18 Oct 2026, the user: "should
                   not have here written and one profile should be highlighted always.
                   better highlight") — `hereItem`, which falls back to your own account
                   on a page that belongs to no profile, so Discover highlights you too */
                const here = item.key === hereItem?.key;
                const tint = SWITCH_TINT[item.kind];
                return (
                  <Link
                    key={item.key}
                    role="menuitem"
                    href={item.href}
                    aria-current={here ? "page" : undefined}
                    aria-label={`${item.label} — ${item.sub}${here ? " — you are here" : ""}${item.count ? ` — ${item.count} new` : ""}`}
                    {...tapHandlers}
                    onClick={(e) => { if (wasSwipe(e)) return; writeActiveProfile(item.key); setOpenFor(null); }}
                    data-here={here ? "1" : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 8px",
                      marginBottom: 3,
                      borderRadius: 16,
                      textDecoration: "none",
                      color: "var(--text)",
                      background: here ? `linear-gradient(90deg, ${tint}2e, ${tint}10)` : "transparent",
                      border: `1.5px solid ${here ? tint : "transparent"}`,
                      boxShadow: here ? `0 4px 14px ${tint}33` : "none",
                    }}
                  >
                    <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, overflow: "hidden", display: "inline-flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg,${tint},${tint}88)`, color: "#fff", fontSize: 12, fontWeight: 900, boxShadow: here ? `0 0 0 2px var(--solid), 0 0 0 4px ${tint}` : "none" }}>
                      {item.photo ? <Image src={item.photo} alt="" width={34} height={34} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : initialsOf(item.label)}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      <span style={{ display: "block", fontSize: 10, fontWeight: 800, color: tint, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{item.sub}</span>
                    </span>
                    {/* always drawn, 0 included, in the profile's own colour (18 Oct 2026) */}
                    <span data-testid="profile-count" aria-hidden="true" style={countPill(tint, item.count ?? 0, 20)}>
                      {(item.count ?? 0) > 99 ? "99+" : item.count ?? 0}
                    </span>
                    {/* no tick (18 Oct 2026, the user: "only highlight should be there") */}
                  </Link>
                );
              })}

              {/* THE TOOLS OF THE PROFILE YOU ARE IN — one line each */}
              {hereItem?.tiles && hereItem.tiles.length > 0 ? (
                <>
                  <div style={{ height: 1.5, background: "var(--el)", margin: "12px 6px" }} />
                  {/* THE TOOLS HEADING WITH ARRANGE ON ITS RIGHT (18 Oct 2026) — `DrawerTools`
                      draws the heading, the Arrange ↔ Done button and the drag list; the
                      normal-mode row below is the chrome's own, unchanged */}
                  <DrawerTools
                    key={hereItem.key}
                    heading={TOOLS_HEADING[hereItem.kind === "me" ? (settings?.plan?.active ? "artist" : "user") : hereItem.kind]}
                    layoutKey={hereItem.kind === "me" ? toolsLayoutKey(settings?.plan?.active ? "artist" : "user") : toolsLayoutKey(hereItem.kind, hereItem.key)}
                    tiles={hereItem.tiles}
                    renderLink={(t) => (
                      <Link
                        key={t.name}
                        href={t.href}
                        aria-label={t.name}
                        /* the count is a DESCRIPTION, not part of the name, so "Classes"
                           stays one control's name whether or not something is new */
                        aria-describedby={`tool-count-${hereItem.key}-${t.k}`}
                        {...tapHandlers}
                        onClick={(e) => { wasSwipe(e); }}
                        style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 8px", borderRadius: 14, textDecoration: "none", color: "var(--text)", background: t.href === activeToolHref ? "var(--el)" : "transparent" }}
                      >
                        <ToolGlyph k={t.k} c={t.c} size={34} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 900, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                        {/* WHAT IS NEW HERE (18 Oct 2026) — unread notifications that open this tool */}
                        {/* ALWAYS DRAWN, 0 INCLUDED, IN THE TOOL'S OWN COLOUR (18 Oct 2026,
                            the user: "tool notification in profile switcher should be
                            visible even if 0 … in color of their tool") — a filled pill
                            while something is new, a quiet wash of the colour at 0 */}
                        <span data-testid="tool-count" data-count={t.count ?? 0} id={`tool-count-${hereItem.key}-${t.k}`} aria-label={`${t.count ?? 0} new`} style={countPill(t.c, t.count ?? 0, 22)}>
                          {(t.count ?? 0) > 99 ? "99+" : t.count ?? 0}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9.5 5.5 16 12l-6.5 6.5" />
                        </svg>
                      </Link>
                    )}
                  />
                </>
              ) : null}

              {/* LOG OUT, last (21 Sep 2026), and it asks first (3 Oct 2026) */}
              <div style={{ height: 1.5, background: "var(--el)", margin: "12px 6px" }} />
              <button
                type="button"
                role="menuitem"
                aria-haspopup="dialog"
                {...tapHandlers}
                onClick={(e) => {
                  if (wasSwipe(e)) return;
                  setOpenFor(null);
                  setConfirmOut(true);
                }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", borderRadius: 14, width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", color: RED, textAlign: "left" }}
              >
                <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${RED}1f` }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 17l5-5-5-5M20 12H9M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
                  </svg>
                </span>
                <span style={{ fontSize: 13, fontWeight: 900 }}>Log out</span>
              </button>
              </div>
              </>
              )}
            </div>
          </div>
        </Portal>
      ) : null}
      {confirmOut ? <LogOutConfirm onClose={closeOut} word={adminOnly ? "Sign out" : "Log out"} /> : null}

      {/* everything else flows below the bar; tabs also leave room for the pill bar */}
      <div
        id="dos-main"
        role="main"
        data-dos-view={viewMode === "list" ? "list" : undefined}
        style={{
          paddingTop: "var(--dos-top)",
          paddingBottom: showBar ? "calc(80px + var(--dos-safe-bottom))" : "calc(16px + var(--dos-safe-bottom))",
          boxSizing: "border-box",
        }}
      >
        <ViewModeContext.Provider value={{ mode: adminOnly ? null : viewMode, pick: pickView }}>{children}</ViewModeContext.Provider>
      </div>

      {/* ── the floating pill bar — a tab draws the main one, an entity's home its own
          (19308-19397). The selected tab expands into a filled capsule carrying its
          icon AND name; the others are their icon alone, each keeping its aria-label
          so a screen reader names all of them. ── */}
      {showBar && (
        <nav
          /* ⚠ still "Studio" for an organization's home too (26 Sep 2026): the chrome
             cannot tell the two apart from the path, and `shoot-hero` locates the bar by
             this word — an organization's bar being called Studio is the price of
             not adding a read to every page for a label */
          aria-label={entity ? (entity.kind === "studio" ? "Studio" : "Crew") : "Main"}
          style={{
            position: "fixed",
            bottom: "calc(12px + var(--dos-safe-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 300,
            background: "var(--nav-bg)",
            backdropFilter: "blur(22px) saturate(1.6)",
            WebkitBackdropFilter: "blur(22px) saturate(1.6)",
            display: "flex",
            padding: "8px 10px",
            borderRadius: 999,
            gap: 4,
            border: "1.5px solid var(--nav-line)",
            boxShadow: "var(--nav-shadow)",
          }}
        >
          {bar.map(({ label, href: baseHref }) => {
            /* ⚠ IN A STUDIO OR A CREW, THE MAIN BAR STAYS IN IT (18 Oct 2026) — Home
               is that profile's home and Discover says who is reading, so a tab
               press never quietly switches you back to yourself */
            const href =
              !entity && hereItem && hereItem.kind !== "me"
                ? label === "Home"
                  ? hereItem.href
                  : `${baseHref}?as=${hereItem.kind === "crew" ? `crew-${hereItem.key}` : hereItem.key}`
                : baseHref;
            const on = lit === label;
            const tint = TAB_TINT[label];
            const c = on ? "#FFFFFF" : "var(--tab-rest)";
            return (
              <Link
                key={label}
                href={href}
                aria-label={label}
                aria-current={on ? "page" : undefined}
                className="dos-tab"
                onClick={() => { if (!on) setPressedTab({ label, from: pathname }); }}
                style={{
                  animation: on ? "dosTabIn .42s cubic-bezier(.34,1.56,.64,1)" : "none",
                  height: 44,
                  cursor: "pointer",
                  borderRadius: 999,
                  padding: on ? "0 15px 0 13px" : "0 13px",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: on ? 7 : 0,
                  background: on ? `linear-gradient(135deg,${tint},${tint}cc)` : "transparent",
                  boxShadow: on ? `0 4px 14px ${tint}66` : "none",
                  /* ⚠ THE SELECTED TAB WEARS ITS OWN OUTLINE (12 Oct 2026, the user:
                     "navbar icons … should be separate outline when selected. in same
                     design") — a ring in the tab's own colour, 2px clear of the capsule */
                  outline: on ? `2px solid ${tint}` : "2px solid transparent",
                  outlineOffset: 2,
                  transition: "background .22s ease, padding .22s ease, gap .22s ease, box-shadow .22s ease, outline-color .22s ease",
                  WebkitTapHighlightColor: "transparent",
                  textDecoration: "none",
                }}
              >
                <span aria-hidden="true" style={{ display: "inline-flex", animation: on ? "dosTabPop .5s cubic-bezier(.34,1.56,.64,1)" : "none" }}>
                  {TAB_ICONS[label](c)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: c,
                    letterSpacing: 0.1,
                    lineHeight: 1,
                    maxWidth: on ? 90 : 0,
                    opacity: on ? 1 : 0,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    transition: "max-width .22s ease, opacity .18s ease",
                    fontFamily: DOS_UI,
                  }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
