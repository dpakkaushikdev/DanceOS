import { addDays, bucketKeyOf, shiftBucketKey, type Period } from "@/lib/format/month";
import type { EarningsRangeKeys } from "@/types/earnings";

/** A CUSTOM EARNINGS WINDOW (18 Oct 2026, the user: "better date filter with
 *  custom controls"). Two IST day keys in the URL — `?from=2026-09-01&to=2026-09-30`
 *  — both ends included. A plain module (no "use client"), so the server pages
 *  and the screen read one rule.
 *
 *  ⚠ The range is cut into buckets of a size chosen from its length, so the chart
 *  still draws a shape: up to a month by day, up to six months by week, up to
 *  three years by month, and longer by year — never more than about 40 columns.
 *  ⚠ Five years at most, the same ceiling the Year view draws. */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 5 * 366;

const dayNo = (key: string): number => {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

const real = (key: string): boolean => {
  if (!DAY.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};

/** the range a URL asks for, or null — swapped when backwards, clamped when long */
export function asRange(from?: string | null, to?: string | null): EarningsRangeKeys | null {
  if (!from || !to || !real(from) || !real(to)) return null;
  let a = from;
  let b = to;
  if (dayNo(a) > dayNo(b)) [a, b] = [b, a];
  if (dayNo(b) - dayNo(a) + 1 > MAX_DAYS) a = addDays(b, -(MAX_DAYS - 1));
  return { from: a, to: b };
}

export const rangeDays = (r: EarningsRangeKeys): number => dayNo(r.to) - dayNo(r.from) + 1;

/** the bucket size a range is cut into */
export const rangeGrain = (r: EarningsRangeKeys): Period => {
  const n = rangeDays(r);
  if (n <= 31) return "day";
  if (n <= 184) return "week";
  if (n <= 1100) return "month";
  return "year";
};

/** noon IST on a day — an instant that is unambiguously inside it */
const noonOf = (day: string) => `${day}T12:00:00+05:30`;

export const rangeFromIso = (r: EarningsRangeKeys): string => `${r.from}T00:00:00+05:30`;
/** the instant AFTER the range ends — an exclusive upper bound */
export const rangeToIso = (r: EarningsRangeKeys): string => `${addDays(r.to, 1)}T00:00:00+05:30`;

/** the buckets a range spans, oldest first */
export function rangeKeys(r: EarningsRangeKeys): string[] {
  const g = rangeGrain(r);
  const end = bucketKeyOf(noonOf(r.to), g);
  const keys: string[] = [];
  let k = bucketKeyOf(noonOf(r.from), g);
  for (let i = 0; i < 400 && k <= end; i++) {
    keys.push(k);
    k = shiftBucketKey(k, g, -1);
  }
  return keys;
}

/** the same length, one step back (-1) or forward (+1) */
export function shiftRange(r: EarningsRangeKeys, dir: -1 | 1): EarningsRangeKeys {
  const n = rangeDays(r);
  return { from: addDays(r.from, dir * n), to: addDays(r.to, dir * n) };
}

const words = (day: string) =>
  new Date(noonOf(day)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** "1 Sept 2026 – 30 Sept 2026" */
export const rangeLabel = (r: EarningsRangeKeys): string => (r.from === r.to ? words(r.from) : `${words(r.from)} – ${words(r.to)}`);

/** the query string for a range */
export const rangeQuery = (r: EarningsRangeKeys): string => `from=${r.from}&to=${r.to}`;
