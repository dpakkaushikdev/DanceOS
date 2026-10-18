import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PREFS, groupMap, type AppNotification, type NotificationKind, type NotificationPrefs } from "@/types/notification";

/** Step 24's reads and writes, grouped by app area since 11 Oct 2026
 *  (`20261019090000`). Notifications are raised by triggers, so nothing here
 *  inserts one. Every query says `user_id = auth.uid()` out loud even though
 *  the policy says the same — RLS is a ceiling, not a scope. */

const MAX_LIST = 200;

interface Row {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

interface PrefsRow {
  kinds: Record<string, unknown> | null;
  /** ⚠ added by `20261019090000` — tolerated missing, so a read before the
   *  apply is every group on rather than an error */
  push_kinds?: Record<string, unknown> | null;
  push: boolean | null;
}

const toNotification = (r: Row): AppNotification => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  href: r.href,
  readAt: r.read_at,
  createdAt: r.created_at,
});

/** The signed-in person's notifications, newest first — New and History are the
 *  same list split on `read_at`.
 *
 *  ⚠ HISTORY IS NEVER CLEARED (18 Oct 2026, the user: "earlier should not be
 *  removable … a history tab … which should not get cleared"). A READ row is
 *  read back whether or not an older "Clear" soft-deleted it, so everything
 *  hidden before today comes back into History; an UNREAD row that was hidden
 *  stays hidden. The own-row SELECT policy carries no `deleted_at` filter
 *  (Step 24), so this asks for nothing RLS did not already admit. */
const MAX_HISTORY = 500;

export async function findMyNotifications(supabase: SupabaseClient): Promise<AppNotification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, read_at, created_at")
    .eq("user_id", user.id)
    .or("deleted_at.is.null,read_at.not.is.null")
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY);
  if (error) {
    throw new Error(`notifications.findMine failed: ${error.message}`);
  }
  return ((data ?? []) as Row[]).map(toNotification);
}

/** WHAT IS UNREAD, AND WHERE EACH ONE POINTS (18 Oct 2026) — the drawer's
 *  per-tool counts are these rows matched to the tool whose address they open
 *  (`features/home/toolBadges.ts`). Only the three columns that decide it; a
 *  failed read is no badges, never an error page. */
export async function findMyUnreadNotes(supabase: SupabaseClient, userId: string): Promise<{ id: string; kind: string; href: string | null }[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, href")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(MAX_LIST);
  if (error) return [];
  return (data ?? []) as { id: string; kind: string; href: string | null }[];
}

/** ⚠ A STUDIO'S ENQUIRY NEWS IS THE STUDIO'S (18 Oct 2026, the user: "studio
 *  enquiries merging with user/artist enquiries notifications should not happen").
 *  Every enquiry notification is stored pointing at `/inbox/enquiries/{id}`, the
 *  PERSON's address, so the drawer counted a studio's enquiries on the person's
 *  own Enquiries tool. The stored row is left alone; here, for the studios this
 *  account RUNS, an enquiry it did not send is re-pointed at that studio's own
 *  desk (`/business/{id}/inbox/enquiries/{id}`), which is where the count then
 *  lands and where the detail page now redirects. One read, by id. */
export async function pointEnquiryNotesAtTheirDesk<T extends { href: string | null }>(
  supabase: SupabaseClient,
  notes: T[],
  userId: string,
  studioIds: string[]
): Promise<T[]> {
  if (studioIds.length === 0) return notes;
  const idOf = (href: string | null) => href?.match(/^\/inbox\/enquiries\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const ids = [...new Set(notes.map((n) => idOf(n.href)).filter((x): x is string => Boolean(x)))];
  if (ids.length === 0) return notes;
  const { data, error } = await supabase.from("enquiries").select("id, business_id, from_user_id").in("id", ids);
  if (error || !data) return notes;
  const studios = new Set(studioIds);
  const desk = new Map<string, string>();
  for (const e of data as { id: string; business_id: string | null; from_user_id: string }[]) {
    if (e.business_id && studios.has(e.business_id) && e.from_user_id !== userId) desk.set(e.id, e.business_id);
  }
  return notes.map((n) => {
    const id = idOf(n.href);
    const biz = id ? desk.get(id) : undefined;
    return biz && n.href ? { ...n, href: `/business/${biz}${n.href}` } : n;
  });
}

/** The bell's badge — one number, through the aggregate function (which leaves
 *  out a group switched off "here"). */
export async function findMyUnreadCount(supabase: SupabaseClient): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return 0;
  }
  const { data, error } = await supabase.rpc("my_unread_notifications");
  if (error) {
    /* the bell is decoration on a broken read — never the reason a page 500s */
    return 0;
  }
  return Number(data ?? 0);
}

/** The prefs row, made on first read so a person always has one. */
export async function findMyNotificationPrefs(supabase: SupabaseClient): Promise<NotificationPrefs> {
  const { data, error } = await supabase.rpc("my_notification_prefs");
  if (error || !data) {
    return DEFAULT_PREFS;
  }
  const row = data as PrefsRow;
  return {
    kinds: groupMap(row.kinds),
    pushKinds: groupMap(row.push_kinds),
    push: row.push !== false,
  };
}

/** ⚠ WhatsApp and email are passed as null — "leave them as they are"; the app
 *  no longer shows either. */
export async function setNotificationPrefs(supabase: SupabaseClient, prefs: NotificationPrefs): Promise<void> {
  const { error } = await supabase.rpc("set_notification_prefs", {
    p_kinds: prefs.kinds,
    p_push: prefs.push,
    p_whatsapp: null,
    p_email: null,
    p_push_kinds: prefs.pushKinds,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function markNotificationsRead(supabase: SupabaseClient, input: { ids?: string[]; kind?: NotificationKind }): Promise<number> {
  const { data, error } = await supabase.rpc("mark_notifications_read", { p_ids: input.ids ?? null, p_kind: input.kind ?? null });
  if (error) {
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}

/** "Clear" HIDES: the RPC soft-deletes, so nothing is erased. */
export async function clearNotifications(supabase: SupabaseClient, input: { ids?: string[]; kind?: NotificationKind }): Promise<number> {
  const { data, error } = await supabase.rpc("clear_notifications", { p_ids: input.ids ?? null, p_kind: input.kind ?? null });
  if (error) {
    throw new Error(error.message);
  }
  return Number(data ?? 0);
}
