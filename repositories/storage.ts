import type { SupabaseClient } from "@supabase/supabase-js";

/** STORAGE — how much of DanceOS one profile takes up (30 Oct 2026, the user:
 *  *"setting for every kind of profile should get a new option called Storage
 *  which gives you a percentage and space wise breakup of your entire data on
 *  the app"*).
 *
 *  Two kinds of data, measured two ways, and the screen says which is which:
 *
 *  * FILES are measured exactly — every object in the subject's own folders of
 *    the `media` and `org-proof` buckets, with the size Storage reports. A
 *    person's: `avatars/`, `gallery/`, `routines/`. A studio's: `tenants/`,
 *    `posters/`, `assets/`, and its verification photos (which live in the
 *    OWNER's `proof/` folder, so they are matched by the paths the studio's own
 *    `studio_photos` rows name). A crew's: `crews/`.
 *  * RECORDS are ESTIMATED — the rows that belong to the subject, counted, with
 *    their size taken as the length of the row as JSON. Postgres keeps them in
 *    its own format, so this is "about", and the screen prints it that way.
 *
 *  ⚠ THE SERVICE ROLE IS USED, AND ONLY AFTER THE CALLER WAS PROVEN TO OWN THE
 *  SUBJECT: the page resolves `?as=` through `resolveActingAs` (a business the
 *  caller RUNS, a crew they LEAD) or uses the signed-in person's own id. Every
 *  read here is keyed on that id, and only SIZES and COUNTS leave this file. */

export interface StorageLine {
  key: string;
  label: string;
  kind: "file" | "record";
  bytes: number;
  count: number;
  color: string;
}

export interface StorageReport {
  lines: StorageLine[];
  total: number;
  /** true when a records read hit its cap and the size was scaled up */
  estimated: boolean;
}

export type StorageSubject = { kind: "me"; id: string } | { kind: "studio"; id: string } | { kind: "crew"; id: string };

type Obj = { name: string; metadata?: { size?: number } | null };

async function listFolder(admin: SupabaseClient, bucket: string, prefix: string): Promise<{ name: string; size: number }[]> {
  const out: { name: string; size: number }[] = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error || !data) break;
    for (const o of data as Obj[]) {
      const size = Number(o.metadata?.size ?? 0);
      if (o.metadata) out.push({ name: `${prefix}/${o.name}`, size });
    }
    if (data.length < 1000) break;
  }
  return out;
}

async function fileLine(admin: SupabaseClient, key: string, label: string, color: string, bucket: string, prefix: string, only?: Set<string>): Promise<StorageLine> {
  const files = await listFolder(admin, bucket, prefix).catch(() => []);
  const kept = only ? files.filter((f) => only.has(f.name)) : files;
  return { key, label, kind: "file", color, count: kept.length, bytes: kept.reduce((s, f) => s + f.size, 0) };
}

const RECORD_CAP = 1000;

async function recordLine(admin: SupabaseClient, key: string, label: string, color: string, table: string, column: string, id: string): Promise<StorageLine & { scaled: boolean }> {
  const { data, count, error } = await admin.from(table).select("*", { count: "exact" }).eq(column, id).limit(RECORD_CAP);
  if (error) return { key, label, kind: "record", color, count: 0, bytes: 0, scaled: false };
  const rows = (data ?? []) as unknown[];
  const sampled = rows.reduce<number>((s, r) => s + new TextEncoder().encode(JSON.stringify(r)).length, 0);
  const n = count ?? rows.length;
  const scaled = n > rows.length && rows.length > 0;
  return { key, label, kind: "record", color, count: n, bytes: scaled ? Math.round((sampled / rows.length) * n) : sampled, scaled };
}

export async function measureStorage(admin: SupabaseClient, subject: StorageSubject): Promise<StorageReport> {
  const id = subject.id;
  let files: Promise<StorageLine>[] = [];
  let records: Promise<StorageLine & { scaled: boolean }>[] = [];

  if (subject.kind === "me") {
    files = [
      fileLine(admin, "avatar", "Profile picture", "#EC4899", "media", `avatars/${id}`),
      fileLine(admin, "header", "Header pictures", "#8B5CF6", "media", `gallery/${id}`),
      fileLine(admin, "music", "Routine music", "#F59E0B", "media", `routines/${id}`),
    ];
    records = [
      recordLine(admin, "profile", "Profile", "#64748B", "profiles", "id", id),
      recordLine(admin, "bookings", "Bookings", "#0EA5E9", "class_bookings", "user_id", id),
      recordLine(admin, "passes", "Memberships", "#B45309", "membership_passes", "user_id", id),
      recordLine(admin, "routines", "Routines", "#10B981", "routines", "owner_id", id),
      recordLine(admin, "follows", "Follows", "#22C55E", "follows", "follower_id", id),
      recordLine(admin, "enquiries", "Enquiries sent", "#A855F7", "enquiries", "from_user_id", id),
      recordLine(admin, "notifications", "Notifications", "#94A3B8", "notifications", "user_id", id),
    ];
  } else if (subject.kind === "studio") {
    /* the verification photos sit in the OWNER's proof folder — matched by the
       paths this studio's own rows name, so another studio's are never counted */
    const { data: photos } = await admin.from("studio_photos").select("path").eq("business_id", id).is("deleted_at", null);
    const paths = ((photos ?? []) as { path: string }[]).map((p) => p.path).filter(Boolean);
    const folders = [...new Set(paths.map((p) => p.split("/").slice(0, 2).join("/")))];
    const photoSet = new Set(paths);
    files = [
      fileLine(admin, "avatar", "Profile picture", "#EC4899", "media", `tenants/${id}`),
      fileLine(admin, "posters", "Class posters", "#F59E0B", "media", `posters/${id}`),
      fileLine(admin, "assets", "Asset pictures", "#64748B", "media", `assets/${id}`),
      Promise.all(folders.map((f) => fileLine(admin, "photos", "", "", "org-proof", f, photoSet))).then((ls) => ({
        key: "photos",
        label: "Studio photos",
        kind: "file" as const,
        color: "#8B5CF6",
        count: ls.reduce((s, l) => s + l.count, 0),
        bytes: ls.reduce((s, l) => s + l.bytes, 0),
      })),
    ];
    records = [
      recordLine(admin, "classes", "Classes", "#0D9488", "classes", "business_id", id),
      recordLine(admin, "sessions", "Sessions", "#06B6D4", "class_sessions", "business_id", id),
      recordLine(admin, "bookings", "Bookings", "#0EA5E9", "class_bookings", "business_id", id),
      recordLine(admin, "payments", "Payments", "#22C55E", "payments", "business_id", id),
      recordLine(admin, "memberships", "Memberships", "#B45309", "memberships", "business_id", id),
      recordLine(admin, "rooms", "Rooms", "#4338CA", "rooms", "business_id", id),
      recordLine(admin, "team", "Team", "#C2410C", "business_members", "business_id", id),
      recordLine(admin, "students", "Students", "#65A30D", "leads", "business_id", id),
      recordLine(admin, "assets", "Assets", "#475569", "assets", "business_id", id),
    ];
  } else {
    files = [fileLine(admin, "pictures", "Crew pictures", "#EF4444", "media", `crews/${id}`)];
    records = [
      recordLine(admin, "crew", "Crew", "#64748B", "crews", "id", id),
      recordLine(admin, "members", "Members", "#C2410C", "crew_members", "crew_id", id),
      recordLine(admin, "practices", "Practices", "#4338CA", "crew_practices", "crew_id", id),
    ];
  }

  const [f, r] = await Promise.all([Promise.all(files), Promise.all(records)]);
  const estimated = r.some((x) => x.scaled);
  const lines: StorageLine[] = [...f, ...r.map((l): StorageLine => ({ key: l.key, label: l.label, kind: l.kind, bytes: l.bytes, count: l.count, color: l.color }))].sort((a, b) => b.bytes - a.bytes);
  return { lines, total: lines.reduce((s, l) => s + l.bytes, 0), estimated };
}

/** 1.2 MB, 340 KB, 12 bytes — one grammar for every size on the screen */
export function bytesWords(n: number): string {
  if (n < 1024) return `${n} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
