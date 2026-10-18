/** THE ENQUIRIES TOOL'S ADDRESS (18 Oct 2026) — a plain module, because the two
 *  server pages read it and a value exported from a `"use client"` file is a
 *  client reference on the server (the 11 Oct `isClassAsk` lesson). */

export type EnquiriesTab = "todo" | "ongoing" | "past";
export type EnquiriesSide = "all" | "in" | "out";

/** the words in the address — `?side=received|sent` */
export const SIDE_PARAM: Record<EnquiriesSide, string> = { all: "", in: "received", out: "sent" };

/** an old or new address → the column and chip it opens on (Rule 14): `?show=done`
 *  is Past, `?show=jobs` is To do (the jobs asked of you are a group there),
 *  and `?show=enquiries|requests|invites` open on the default */
export function readEnquiriesAddress(q: { tab?: string; side?: string; show?: string }): { tab: EnquiriesTab | null; side: EnquiriesSide } {
  const tab: EnquiriesTab | null =
    q.tab === "todo" || q.tab === "ongoing" || q.tab === "past" ? q.tab : q.show === "done" || q.side === "completed" ? "past" : q.show === "jobs" ? "todo" : null;
  const side: EnquiriesSide = q.side === "received" || q.side === "in" ? "in" : q.side === "sent" || q.side === "out" ? "out" : "all";
  return { tab, side };
}
