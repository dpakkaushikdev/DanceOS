"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { Portal } from "@/components/ui/Portal";
import { toast } from "@/components/ui/Toast";
import { plainError } from "@/lib/errors";
import { markNotificationsReadAction, setNotificationPrefsAction } from "@/features/notifications/server-actions/notifications";
import { PushDevice, type PushDeviceState } from "@/features/notifications/components/PushDevice";
import { DOS_DISPLAY, DOS_UI, INK, LILAC, MUTED, SUB } from "@/lib/design/tokens";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";
import {
  NOTIF_GROUPS,
  agoWords,
  groupOf,
  type AppNotification,
  type NotificationGlyph,
  type NotificationGroup,
  type NotificationKind,
  type NotificationPrefs,
} from "@/types/notification";

/** ⚠⚠ THE NOTIFICATIONS SCREEN, SECOND REVAMP (18 Oct 2026, the user:
 *  "notifications should be swipable. and earlier should not be removable and a
 *  history tab day wise collapsible notifications history which should not get
 *  cleared. notifications should be crisp and short mostly. should be swipeable
 *  and collapsible according to type of notification. type filters for
 *  notifications. notification settings extra text should be removed").
 *
 *   NEW — what you have not opened, one collapsible section per TYPE (Classes ·
 *     Studios & team · …), each with its count and its own "Read". A row
 *     SWIPES either way: past the threshold it is marked read and moves to
 *     History. Tapping opens the screen where you act, marking it read.
 *   HISTORY — everything read, by IST DAY, each day a collapsible section (today
 *     and yesterday open). ⚠ NOTHING IN HISTORY CAN BE REMOVED: there is no
 *     Clear and no ×, and rows an older Clear soft-deleted are read back
 *     (`findMyNotifications`). `clear_notifications` stays in the database with
 *     no caller.
 *   TYPE CHIPS narrow either column — every chip always drawn, a 0 drawn quiet.
 *   ROWS ARE ONE LINE OF TITLE AND ONE OF BODY — the whole text is on the screen
 *     the row opens.
 *   SETTINGS — this phone, the master Push switch, then one row per type with
 *     Here · Push. No sub-lines, no footnotes. */

type Column = "new" | "history";
type Filter = "all" | NotificationKind;

const pressable = { cursor: "pointer", fontFamily: "inherit" } as const;
const SWIPE_AT = 90;

const chip = (on: boolean, quiet: boolean, tint?: string): React.CSSProperties => ({
  flexShrink: 0,
  padding: "8px 13px",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  fontFamily: "inherit",
  border: `1.5px solid ${on ? (tint ?? "var(--text)") : "var(--el)"}`,
  background: on ? (tint ?? "var(--text)") : "var(--card)",
  color: on ? (tint ? "#fff" : "var(--solid)") : quiet ? MUTED : "var(--text)",
  whiteSpace: "nowrap",
});

const headBtn: React.CSSProperties = { position: "relative", width: 38, height: 38, borderRadius: 19, border: "1.5px solid var(--chip-line)", background: "var(--chip-bg)", color: "var(--text)", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, ...pressable };

const smallBtn: React.CSSProperties = {
  padding: "6px 11px",
  borderRadius: 999,
  border: "1.5px solid var(--el)",
  background: "var(--card)",
  color: INK,
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
  ...pressable,
};

const oneLine: React.CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .18s" }}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/** one drawn mark per group, one stroke family */
function GroupGlyph({ glyph, size = 16 }: { glyph: NotificationGlyph; size?: number }) {
  const paths: Record<NotificationGlyph, ReactNode> = {
    class: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="3" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8.5" r="3" />
        <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
        <circle cx="17" cy="9.5" r="2.3" />
        <path d="M15.6 14.3c2.4.1 4.1 1.7 4.6 4.7" />
      </>
    ),
    crew: (
      <>
        <circle cx="12" cy="6.5" r="2.4" />
        <circle cx="5.5" cy="10" r="2" />
        <circle cx="18.5" cy="10" r="2" />
        <path d="M8 20c.4-3.3 1.9-5.5 4-5.5s3.6 2.2 4 5.5M2.5 19c.3-2.3 1.4-3.8 3-3.8M21.5 19c-.3-2.3-1.4-3.8-3-3.8" />
      </>
    ),
    membership: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <path d="M3 10h18M7 14.5h4" />
      </>
    ),
    enquiry: <path d="M21 14.5a2 2 0 0 1-2 2H8l-4.5 4V5.5a2 2 0 0 1 2-2H19a2 2 0 0 1 2 2zM8 9h9M8 12.5h6" />,
    money: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9 8h6M9 10.5h6M10.5 8c2.6 0 2.6 4.5 0 4.5H9.5l4.5 4" />
      </>
    ),
    danceos: (
      <>
        <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" />
        <path d="M8.8 12l2.2 2.2 4.4-4.4" />
      </>
    ),
    event: <path d="M4 7.5a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[glyph]}
    </svg>
  );
}

function Toggle({ on, label, tint, disabled = false, testId, onPress }: { on: boolean; label: string; tint: string; disabled?: boolean; testId?: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      onClick={onPress}
      style={{ width: 42, height: 24, borderRadius: 12, flexShrink: 0, border: "none", padding: 0, background: on && !disabled ? tint : "var(--el)", position: "relative", opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left .15s" }} />
    </button>
  );
}

function SettingsSheet({ prefs, busy, error, onSave, onClose }: { prefs: NotificationPrefs; busy: boolean; error: string | null; onSave: (p: NotificationPrefs) => void; onClose: () => void }) {
  useCloseOnBack(onClose);
  const [draft, setDraft] = useState<NotificationPrefs>(prefs);
  const [device, setDevice] = useState<PushDeviceState>("checking");
  const pushBlocked = !draft.push || device !== "on";
  const flip = (map: "kinds" | "pushKinds", g: NotificationGroup) => setDraft({ ...draft, [map]: { ...draft[map], [g]: !draft[map][g] } });
  const colHead: React.CSSProperties = { width: 42, textAlign: "center", fontSize: 9.5, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", color: MUTED };
  return (
    <Portal>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 940 }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Notification settings"
          onClick={(e) => e.stopPropagation()}
          style={{ background: "var(--solid)", color: INK, borderRadius: "24px 24px 0 0", padding: "14px var(--dos-gutter) 26px", width: "100%", maxWidth: 430, boxSizing: "border-box", maxHeight: "88vh", overflowY: "auto", animation: "dosSheetUp .22s ease-out", fontFamily: DOS_UI }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--el)", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 17, fontWeight: 900, fontFamily: DOS_DISPLAY }}>Notifications</div>

          <PushDevice onState={setDevice} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: "1.5px solid var(--el)" }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 800 }}>Push</div>
            <Toggle on={draft.push} label="Push to my phones" tint="#22C55E" testId="notif-push-master" onPress={() => setDraft({ ...draft, push: !draft.push })} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 2px" }}>
            <span style={{ flex: 1 }} />
            <span style={colHead}>Here</span>
            <span style={colHead}>Push</span>
          </div>
          {NOTIF_GROUPS.map((g) => {
            const k = g.k as NotificationGroup;
            return (
              <div key={k} data-testid={`notif-pref-${k}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1.5px solid var(--el)" }}>
                <span style={{ width: 30, height: 30, borderRadius: 10, flexShrink: 0, background: `${g.tint}22`, color: g.tint, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <GroupGlyph glyph={g.glyph} size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 800 }}>{g.label}</div>
                <Toggle on={draft.kinds[k]} label={`${g.label} here`} tint={g.tint} testId={`notif-here-${k}`} onPress={() => flip("kinds", k)} />
                <Toggle on={draft.pushKinds[k]} label={`${g.label} push`} tint={g.tint} disabled={pushBlocked} testId={`notif-pushkind-${k}`} onPress={() => flip("pushKinds", k)} />
              </div>
            );
          })}
          {/* a refused save is said HERE — the screen behind the sheet is covered by it */}
          {error ? (
            <div role="alert" style={{ fontSize: 11.5, color: "#F87171", marginTop: 12 }}>
              {plainError(error)}
            </div>
          ) : null}
          <button
            type="button"
            disabled={busy}
            aria-label="Save settings"
            onClick={() => onSave(draft)}
            style={{ marginTop: 16, width: "100%", padding: 13, borderRadius: 999, border: "none", background: "var(--text)", color: "var(--solid)", fontWeight: 900, fontSize: 13, ...pressable }}
          >
            {busy ? "Saving…" : "Done"}
          </button>
        </div>
      </div>
    </Portal>
  );
}

/** IST calendar day of an instant, "2026-10-18" — History's sections */
const istDay = (iso: string): string => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const dayWords = (day: string, today: string, yesterday: string): string => {
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  const d = new Date(`${day}T12:00:00+05:30`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata", ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) });
};

/** A ROW THAT SWIPES. Pointer events, `touch-action: pan-y` so a vertical
 *  scroll is still the page's; past `SWIPE_AT` the row slides out and `onSwipe`
 *  runs. A drag of more than a few pixels is not a tap, so it never opens. */
function SwipeRow({ enabled, tint, onSwipe, children }: { enabled: boolean; tint: string; onSwipe: () => void; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const [gone, setGone] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  const end = () => {
    start.current = null;
    setDragging(false);
    if (Math.abs(dx) >= SWIPE_AT) {
      setGone(dx > 0 ? 1 : -1);
      window.setTimeout(onSwipe, 160);
    } else {
      setDx(0);
    }
  };
  const offset = gone ? gone * 480 : dx;
  const reveal = Math.min(1, Math.abs(dx) / SWIPE_AT);
  return (
    <div style={{ position: "relative", marginBottom: 8, borderRadius: 16, overflow: "hidden" }}>
      {enabled ? (
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, borderRadius: 16, background: tint, opacity: 0.18 + reveal * 0.6, display: "flex", alignItems: "center", justifyContent: dx >= 0 ? "flex-start" : "flex-end", padding: "0 18px", color: "#fff", fontSize: 11.5, fontWeight: 900, letterSpacing: 0.6, textTransform: "uppercase" }}
        >
          ✓ Read
        </div>
      ) : null}
      <div
        onPointerDown={(e) => {
          if (!enabled || (e.pointerType === "mouse" && e.button !== 0)) return;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          const x = e.clientX - s.x;
          const y = e.clientY - s.y;
          if (!moved.current) {
            if (Math.abs(x) < 8) return;
            if (Math.abs(y) > Math.abs(x)) {
              start.current = null;
              return;
            }
            moved.current = true;
            setDragging(true);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
          setDx(x);
        }}
        onPointerUp={end}
        onClickCapture={(e) => {
          /* a drag is not a tap — the row it ended on must not open */
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setDx(0);
        }}
        style={{
          position: "relative",
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform .18s ease-out",
          touchAction: enabled ? "pan-y" : "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function NotificationsScreen({
  notifications,
  prefs,
  nowIso,
  initialColumn = null,
  initialGroup = null,
  variant = "page",
  onRefresh,
  onRead,
}: {
  notifications: AppNotification[];
  prefs: NotificationPrefs;
  nowIso: string;
  /** the address's `?show=`; null lets the screen choose */
  initialColumn?: Column | null;
  initialGroup?: string | null;
  /** "drawer" (18 Oct 2026): the same screen inside the left drawer the bell
      opens — it writes no address and re-reads through `onRefresh` */
  variant?: "page" | "drawer";
  /** no longer drawn — the drawer has no close button (18 Oct 2026); kept so callers compile */
  onClose?: () => void;
  onRefresh?: () => void;
  /** INSTANT (Batch 3): `n` rows were just marked read on screen (negative when a
   *  refusal puts them back) — the chrome takes the bell's count down at once */
  onRead?: (n: number) => void;
}) {
  const nextRouter = useRouter();
  const inDrawer = variant === "drawer";
  /* in the drawer a "refresh" re-reads the list (and the chrome's bell);
     a push navigates away, which closes the drawer by itself */
  const router = {
    push: (href: string) => nextRouter.push(href),
    refresh: () => {
      onRefresh?.();
      nextRouter.refresh();
    },
  };
  /* an area switched off "here" is not drawn at all — the bell already leaves it
     out (`my_unread_notifications`), so the screen and the badge agree */
  /* ⚠ the retired Events rows are not drawn at all (30 Oct 2026, the user:
     "remove events retired from notifications") — they stay in the table as
     history and simply never reach the screen */
  const shownHere = (k: NotificationKind) => k !== "event" && prefs.kinds[k] !== false;
  /* a row swiped read moves to History at once, before the server answers */
  const [readNow, setReadNow] = useState<Record<string, string>>({});
  const visible = notifications.filter((n) => shownHere(n.kind)).map((n) => (readNow[n.id] && !n.readAt ? { ...n, readAt: readNow[n.id] } : n));
  const hiddenBySettings = notifications.filter((n) => n.kind !== "event" && !shownHere(n.kind)).length;
  const fresh = visible.filter((n) => !n.readAt);
  const history = visible.filter((n) => n.readAt);

  /* ⚠ ALWAYS OPENS ON NEW (18 Oct 2026, the user: "notification should by default
     open on new") — even when nothing is new; History is a tap away */
  const [column, setColumn] = useState<Column>(initialColumn ?? "new");
  const groupKeys: NotificationKind[] = NOTIF_GROUPS.map((g) => g.k);
  const [filter, setFilter] = useState<Filter>(groupKeys.includes(initialGroup as NotificationKind) ? (initialGroup as NotificationKind) : "all");
  /* a section's open state is what the person CHANGED — default open is decided
     on the fly, so no effect has to write it */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [prefOpen, setPrefOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const write = (c: Column, f: Filter) => {
    if (typeof window === "undefined" || inDrawer) return;
    const q = new URLSearchParams();
    q.set("show", c);
    if (f !== "all") q.set("group", f);
    window.history.replaceState(window.history.state, "", `/notifications?${q.toString()}`);
  };
  const pickColumn = (c: Column) => {
    setColumn(c);
    write(c, filter);
  };
  const pickFilter = (f: Filter) => {
    setFilter(f);
    write(column, f);
  };

  const run =async (op: () => Promise<{ error: string | null }>, done: string | null): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const out = await op();
    setBusy(false);
    if (out.error) {
      setError(out.error);
      toast.error(out.error);
      return false;
    }
    if (done) toast(done);
    router.refresh();
    return true;
  };

  const inColumn = column === "new" ? fresh : history;
  const shown = filter === "all" ? inColumn : inColumn.filter((n) => n.kind === filter);
  const filterLabel = filter === "all" ? null : groupOf(filter).label;

  /* the tap goes at once — marking it read rides behind the navigation rather
     than holding the person on this screen for a round trip */
  /* ⚠ INSTANT (Batch 3): a row is read ON SCREEN the moment it is opened or
     swiped — its dot goes and the bell counts down — and the server's word
     follows; a refusal puts it back with toast.error */
  const markLocal = (ids: string[]) => {
    if (ids.length === 0) return;
    const at = new Date().toISOString();
    setReadNow((m) => {
      const next = { ...m };
      for (const id of ids) next[id] = at;
      return next;
    });
    onRead?.(ids.length);
  };
  const unmarkLocal = (ids: string[]) => {
    if (ids.length === 0) return;
    setReadNow((m) => {
      const next = { ...m };
      for (const id of ids) delete next[id];
      return next;
    });
    onRead?.(-ids.length);
  };

  const openRow = (n: AppNotification) => {
    if (!n.readAt) {
      markLocal([n.id]);
      void markNotificationsReadAction({ ids: [n.id] }).then((out) => {
        if (out.error) {
          unmarkLocal([n.id]);
          toast.error(out.error);
        }
      });
    }
    if (n.href) {
      router.push(n.href);
    } else {
      router.refresh();
    }
  };

  const swipeRead = (n: AppNotification) => {
    markLocal([n.id]);
    void markNotificationsReadAction({ ids: [n.id] }).then((out) => {
      if (out.error) {
        setError(out.error);
        toast.error(out.error);
        unmarkLocal([n.id]);
      } else {
        router.refresh();
      }
    });
  };

  /* "Read" on a section or on everything — the rows move to History at once */
  const readMany = (kind: NotificationKind | null, done: string) => {
    const ids = fresh.filter((n) => kind === null || n.kind === kind).map((n) => n.id);
    markLocal(ids);
    void run(() => (kind === null ? markNotificationsReadAction({}) : markNotificationsReadAction({ kind })), done).then((ok) => {
      if (!ok) unmarkLocal(ids);
    });
  };

  const isOpen = (key: string, byDefault: boolean) => (key in toggled ? toggled[key] : byDefault);
  const flipOpen = (key: string, byDefault: boolean) => setToggled((t) => ({ ...t, [key]: !(key in t ? t[key] : byDefault) }));

  /* ⚠ THE HEAD (18 Oct 2026, the user: "no sub heading and should have different
     heading and layout now. history should be a button with settings on top
     right"). One heading — "Updates", or "History" while that is shown — with the
     new count as a pill on its line, and on the right ONE History button (it
     reads "New" while History is shown, and takes you back) beside the gear. The
     two columns' test ids ride on that one button. */
  const onHistory = column === "history";
  const head = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <h1 style={{ margin: 0, fontFamily: DOS_DISPLAY, fontSize: inDrawer ? 26 : 30, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1.05 }}>Notifications</h1>
        {onHistory ? (
          <span data-testid="notif-history-pill" style={{ fontSize: 11, fontWeight: 900, padding: "3px 9px", borderRadius: 999, background: "var(--el)", color: "var(--sub)" }}>
            History
          </span>
        ) : fresh.length > 0 ? (
          <span data-testid="notif-counts" style={{ fontSize: 11, fontWeight: 900, padding: "3px 9px", borderRadius: 999, background: "#6D28D9", color: "#fff" }}>
            {fresh.length} new
          </span>
        ) : null}
      </div>
      {/* 18 Oct 2026, the user: "history should just be an icon, no cross button".
          One round icon — a clock while New is shown, a back arrow while History
          is — and no close control: the scrim and system back close the drawer. */}
      <button
        type="button"
        aria-pressed={onHistory}
        data-testid={onHistory ? "notif-tab-new" : "notif-tab-history"}
        aria-label={onHistory ? "Back to new updates" : "History"}
        onClick={() => pickColumn(onHistory ? "new" : "history")}
        style={{ ...headBtn, ...(onHistory ? { background: "var(--text)", color: "var(--solid)", borderColor: "var(--text)" } : null) }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {onHistory ? <path d="M15 6l-6 6 6 6" /> : (
            <>
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l3 2" />
            </>
          )}
        </svg>
      </button>
      <button type="button" aria-label="Notification settings" data-testid="notif-settings" onClick={() => setPrefOpen(true)} style={headBtn}>
        <GearIcon />
      </button>
    </div>
  );

  const chips = (
    <div role="group" aria-label="Type" data-testid="notif-chips" style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2, marginTop: 10 }}>
      <button type="button" aria-pressed={filter === "all"} data-testid="notif-chip-all" onClick={() => pickFilter("all")} style={chip(filter === "all", inColumn.length === 0)}>
        All · {inColumn.length}
      </button>
      {groupKeys.map((k) => {
        const g = groupOf(k);
        const off = !shownHere(k);
        const n = inColumn.filter((x) => x.kind === k).length;
        return (
          <button key={k} type="button" aria-pressed={filter === k} data-testid={`notif-chip-${k}`} onClick={() => pickFilter(k)} style={chip(filter === k, n === 0, g.tint)}>
            {g.label} · {off ? "off" : n}
          </button>
        );
      })}
    </div>
  );

  const row = (n: AppNotification, showGroup: boolean) => {
    const g = groupOf(n.kind);
    const unread = !n.readAt;
    return (
      <SwipeRow key={n.id} enabled={unread} tint={g.tint} onSwipe={() => swipeRead(n)}>
          <div
            data-testid="notif-row"
            data-kind={n.kind}
            data-read={unread ? "no" : "yes"}
            style={{ background: "var(--solid)", borderRadius: 16 }}
          >
            <button
              type="button"
              aria-label={`Open: ${n.title}`}
              onClick={() => openRow(n)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--card)", border: `1.5px solid ${unread ? `${g.tint}66` : "var(--el)"}`, borderRadius: 16, textAlign: "left", color: INK, ...pressable }}
            >
              <span style={{ position: "relative", width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: `${g.tint}22`, color: g.tint, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <GroupGlyph glyph={g.glyph} size={15} />
                {unread ? <span aria-hidden="true" data-testid="notif-unread-dot" style={{ position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: 5, background: g.tint, border: "2px solid var(--solid)" }} /> : null}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ ...oneLine, flex: 1, minWidth: 0, fontSize: 13, fontWeight: unread ? 800 : 600 }}>{n.title}</span>
                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: MUTED }}>{agoWords(n.createdAt, nowIso)}</span>
                </span>
                {n.body || showGroup ? (
                  <span style={{ ...oneLine, fontSize: 11, color: SUB, marginTop: 2 }}>
                    {showGroup ? <span style={{ color: g.tint, fontWeight: 800 }}>{g.label}{n.body ? " · " : ""}</span> : null}
                    {n.body}
                  </span>
                ) : null}
              </span>
            </button>
          </div>
      </SwipeRow>
    );
  };

  const sectionHead = (key: string, open: boolean, byDefault: boolean, label: ReactNode, count: number, tint: string | null, right?: ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 8px" }}>
      <button
        type="button"
        aria-expanded={open}
        data-testid={`notif-section-${key}`}
        onClick={() => flipOpen(key, byDefault)}
        style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: "6px 2px", border: "none", background: "transparent", color: INK, ...pressable }}
      >
        <span style={{ color: tint ?? SUB, display: "inline-flex" }}>
          <Chevron open={open} />
        </span>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.9, textTransform: "uppercase", color: tint ?? SUB }}>{label}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: MUTED }}>{count}</span>
        <span style={{ flex: 1, height: 1.5, background: "var(--el)" }} />
      </button>
      {right}
    </div>
  );

  const empty = (text: ReactNode) => (
    <div data-testid="notif-empty" style={{ textAlign: "center", padding: "30px 18px", color: SUB, border: "1.5px dashed var(--el)", borderRadius: 20, fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
      {text}
    </div>
  );

  let body: ReactNode;
  if (shown.length === 0) {
    body =
      column === "new"
        ? empty(
            <>
              <div style={{ fontWeight: 800, color: INK, fontFamily: DOS_DISPLAY }}>All caught up</div>
              <div style={{ marginTop: 3 }}>{filterLabel ? `Nothing new in ${filterLabel}.` : "Nothing new."}</div>
            </>,
          )
        : empty(filterLabel ? `No ${filterLabel} history yet.` : "No history yet.");
  } else if (column === "new") {
    /* NEW, ONE SECTION PER TYPE, every one open until it is folded */
    const kinds = groupKeys.filter((k) => shown.some((n) => n.kind === k));
    body = (
      <div data-testid="notif-new">
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 6px" }}>
          <button
            type="button"
            disabled={busy}
            data-testid="notif-read-all"
            aria-label={filterLabel ? `Mark ${filterLabel} read` : "Mark all read"}
            onClick={() => readMany(filter === "all" ? null : filter, filter === "all" ? "All read" : `${filterLabel} read`)}
            style={smallBtn}
          >
            {filterLabel ? `Mark ${filterLabel} read` : "Mark all read"}
          </button>
        </div>
        {kinds.map((k) => {
          const g = groupOf(k);
          const rows = shown.filter((n) => n.kind === k);
          const key = `new-${k}`;
          const open = isOpen(key, true);
          return (
            <section key={k} data-testid="notif-type-section" data-kind={k}>
              {sectionHead(
                key,
                open,
                true,
                g.label,
                rows.length,
                g.tint,
                <button type="button" disabled={busy} aria-label={`Read every ${g.label} notification`} data-testid={`notif-read-${k}`} onClick={() => readMany(k, `${g.label} read`)} style={smallBtn}>
                  Read
                </button>,
              )}
              {open ? rows.map((n) => row(n, false)) : null}
            </section>
          );
        })}
      </div>
    );
  } else {
    /* HISTORY, BY IST DAY — today and yesterday open, older days folded */
    const today = istDay(nowIso);
    const yesterday = istDay(new Date(new Date(nowIso).getTime() - 864e5).toISOString());
    const days: string[] = [];
    const byDay = new Map<string, AppNotification[]>();
    for (const n of shown) {
      const d = istDay(n.createdAt);
      if (!byDay.has(d)) {
        byDay.set(d, []);
        days.push(d);
      }
      byDay.get(d)!.push(n);
    }
    body = (
      <div data-testid="notif-history">
        {days.map((d) => {
          const key = `day-${d}`;
          const byDefault = d === today || d === yesterday || d === days[0];
          const open = isOpen(key, byDefault);
          const rows = byDay.get(d)!;
          return (
            <section key={d} data-testid="notif-day" data-day={d}>
              {sectionHead(key, open, byDefault, dayWords(d, today, yesterday), rows.length, null)}
              {open ? rows.map((n) => row(n, true)) : null}
            </section>
          );
        })}
      </div>
    );
  }

  const offLine =
    hiddenBySettings > 0 ? (
      <button type="button" onClick={() => setPrefOpen(true)} style={{ marginTop: 8, border: "none", background: "transparent", padding: 0, color: MUTED, fontSize: 10.5, fontWeight: 700, ...pressable }}>
        {hiddenBySettings} off in settings ›
      </button>
    ) : null;
  /* while the settings sheet is open its own line says it (above), not this one behind it */
  const errorLine = error && !prefOpen ? (
    <div role="alert" style={{ fontSize: 11.5, color: "#F87171", marginBottom: 10 }}>
      {plainError(error)}
    </div>
  ) : null;

  return (
    <div
      data-testid={inDrawer ? "notif-drawer-body" : undefined}
      style={inDrawer ? { color: INK, fontFamily: DOS_UI } : { background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "0 var(--dos-gutter) 40px", boxSizing: "border-box", overflowX: "hidden" }}
    >
      {inDrawer ? (
        <>
          <div style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--solid)", paddingBottom: 10, marginBottom: 6, borderBottom: "1.5px solid var(--el)" }}>
            {head}
            {chips}
            {offLine}
          </div>
          {errorLine}
          {body}
        </>
      ) : (
        <>
          <DeskTop style={{ paddingBottom: 12 }}>
            {head}
            {chips}
            {offLine}
          </DeskTop>
          <DeskBody style={{ paddingTop: 4 }}>
            {errorLine}
            {body}
          </DeskBody>
        </>
      )}

      {prefOpen ? (
        <SettingsSheet
          prefs={prefs}
          busy={busy}
          error={error}
          onClose={() => {
            setPrefOpen(false);
            setError(null);
          }}
          onSave={(p) =>
            void run(() => setNotificationPrefsAction({ kinds: p.kinds, pushKinds: p.pushKinds, push: p.push }), "Saved").then((ok) => {
              if (ok) setPrefOpen(false);
            })
          }
        />
      ) : null}

    </div>
  );
}
