"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { clearNotifications, findMyNotificationPrefs, findMyNotifications, findMyUnreadCount, markNotificationsRead, setNotificationPrefs } from "@/repositories/notifications";
import { DEFAULT_PREFS, type AppNotification, type NotificationKind, type NotificationPrefs } from "@/types/notification";

/** THE BELL'S LIVE COUNT (Batch 3, 28 Oct 2026). The count was read once per
 *  page render, so a booking or an invite that arrived while somebody sat on a
 *  screen stayed invisible until they moved. The chrome asks this every 30 s
 *  and when the app comes back into view. The caller's own count only —
 *  `my_unread_notifications` is scoped to `auth.uid()` inside. Signed out → 0. */
export async function myUnreadCountAction(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  return findMyUnreadCount(supabase).catch(() => 0);
}

/** THE DRAWER'S READ (18 Oct 2026) — the bell opens notifications from the left
 *  in place, so the list is fetched on the press rather than by a page. Both
 *  reads are scoped to `auth.uid()` in the repository, exactly as the page's. */
export async function loadMyNotificationsAction(): Promise<{ notifications: AppNotification[]; prefs: NotificationPrefs; nowIso: string } | { error: string }> {
  const supabase = await requireUser();
  try {
    const [notifications, prefs] = await Promise.all([findMyNotifications(supabase), findMyNotificationPrefs(supabase)]);
    return { notifications, prefs, nowIso: new Date().toISOString() };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not load your notifications" };
  }
}

/** Step 24's writes, by app area since 11 Oct 2026. Nothing here raises a
 *  notification — triggers do that where the fact happens. These are the three
 *  things a person does with the ones they have: read them, hide them, and
 *  decide what reaches them. */

export interface NotificationActionResult {
  error: string | null;
  n?: number;
}

/** the six groups a person may switch; `event` is the retired feature's
 *  history, which may still be marked read or hidden but never switched */
const GROUPS = ["class", "team", "crew", "membership", "enquiry", "money", "danceos"] as const;
const KINDS = [...GROUPS, "event"] as const;
const target = z.object({ ids: z.array(z.string().uuid()).max(200).optional(), kind: z.enum(KINDS).optional() });

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return supabase;
}

const revalidate = () => {
  revalidatePath("/notifications");
  /* the bell sits in the chrome, and the chrome is re-read on every navigation
     (every route under it is dynamic) — the screen's own `router.refresh()`
     redraws it at once. This used to revalidate the WHOLE app segment cache
     (`revalidatePath("/", "layout")`) on every mark-as-read, which made every
     navigation that followed a cold render (19 Sep 2026, "make app snappier"). */
};

export async function markNotificationsReadAction(input: { ids?: string[]; kind?: NotificationKind }): Promise<NotificationActionResult> {
  const parsed = target.safeParse(input);
  if (!parsed.success) return { error: "Something went wrong — please try again." };
  const supabase = await requireUser();
  try {
    const n = await markNotificationsRead(supabase, parsed.data);
    revalidate();
    return { error: null, n };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not mark those read" };
  }
}

/** Hide — a soft delete, never an erase. */
export async function clearNotificationsAction(input: { ids?: string[]; kind?: NotificationKind }): Promise<NotificationActionResult> {
  const parsed = target.safeParse(input);
  if (!parsed.success) return { error: "Something went wrong — please try again." };
  if (!parsed.data.ids?.length && !parsed.data.kind) return { error: "Say which notifications to clear" };
  const supabase = await requireUser();
  try {
    const n = await clearNotifications(supabase, parsed.data);
    revalidate();
    return { error: null, n };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not clear those" };
  }
}

const groupSwitches = z.partialRecord(z.enum(GROUPS), z.boolean());
const prefsSchema = z.object({
  kinds: groupSwitches,
  pushKinds: groupSwitches,
  push: z.boolean(),
});

export async function setNotificationPrefsAction(input: z.input<typeof prefsSchema>): Promise<NotificationActionResult> {
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { error: "Something went wrong — please try again." };
  const supabase = await requireUser();
  try {
    await setNotificationPrefs(supabase, {
      /* a partial map is filled in from the defaults, never the other way round */
      kinds: { ...DEFAULT_PREFS.kinds, ...parsed.data.kinds },
      pushKinds: { ...DEFAULT_PREFS.pushKinds, ...parsed.data.pushKinds },
      push: parsed.data.push,
    });
    revalidate();
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not save that" };
  }
}
