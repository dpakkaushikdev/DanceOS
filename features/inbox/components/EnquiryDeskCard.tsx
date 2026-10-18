"use client";

import Link from "next/link";
import { EnqFace, EnquiryRoad, stageTint } from "@/features/enquiries/components/enquiry-kit";
import { DOS_DISPLAY } from "@/lib/design/tokens";
import { DOS_MONO, EnqIcon, agoWords, dateWords, moneyShort } from "./inbox-kit";
import {
  ENQ_CLOSED,
  ENQ_STAGE_WORD,
  ENQ_TINT,
  enquiryMoney,
  enquiryStage,
  enquiryTypeOf,
  enquiryValueInr,
  liveQuoteOf,
  openEndingOf,
  quoteExpired,
  revisionAsked,
  type Enquiry,
} from "@/types/enquiry";

/** ONE ENQUIRY ON THE DESK (18 Oct 2026, re-cut the same day — the user: "remove
 *  buttons on enquiry cards … better looking enquiry card").
 *
 *  ⚠ NO BUTTONS. The whole card is the door to the enquiry, and what it waits on
 *  you for is said as a pill on its foot ("Your move · Send a quote") rather than
 *  pressed here — an accept or a decline is answered on the enquiry's own page,
 *  where the reason a decline asks for can be asked. The accessible name is the
 *  one every locator already finds. */

/** what this enquiry waits on THIS end for, in two or three words — null when
 *  nothing (it is the other end's move, or it is over). The one rule the To do
 *  column and the card's pill both read, so they cannot disagree. */
export function enquiryMove(e: Enquiry, out: boolean, nowIso: string): string | null {
  const stage = enquiryStage(e);
  if (ENQ_CLOSED.has(stage)) return null;
  const mine: "sender" | "business" = out ? "sender" : "business";
  const ending = openEndingOf(e);
  if (ending) return ending.side !== mine ? "Answer the terms" : null;
  if (e.status === "completing" && e.completeAskedSide) return e.completeAskedSide !== mine ? "Confirm it's done" : null;
  const live = liveQuoteOf(e);
  if (!out) {
    if (stage === "new") return "Accept or decline";
    if (revisionAsked(e)) return "Send a new quote";
    if (stage === "accepted" && !live) return "Send a quote";
    if (stage === "quoted" && live && quoteExpired(live, nowIso)) return "Send a new quote";
    return null;
  }
  if (stage === "quoted" && live?.status === "sent" && !quoteExpired(live, nowIso)) return "Answer the quote";
  const m = enquiryMoney(e);
  if (m.additionsWaiting > 0) return "Answer the addition";
  if (m.advanceDueInr > 0) return "Pay the advance";
  return null;
}

export function EnquiryDeskCard({ e, out, nowIso, href, move }: { e: Enquiry; out: boolean; nowIso: string; href: string; move: string | null }) {
  const stage = enquiryStage(e);
  const tint = ENQ_TINT[e.typeKey] ?? "#8B5CF6";
  const label = enquiryTypeOf(e.typeKey)?.label ?? e.typeKey;
  const who = out ? e.businessName : e.fromName;
  const value = enquiryValueInr(e);
  const what = e.fields.filter(([k]) => k !== "Enquiry")[0]?.[1] ?? label;
  const today = nowIso.slice(0, 10);
  const days = [...e.dates].sort();
  const day = days.find((d) => d >= today) ?? days[days.length - 1] ?? null;
  const c = stageTint(stage);
  const stageWord = revisionAsked(e) ? "Revision asked" : ENQ_STAGE_WORD[stage];

  return (
    <Link
      href={href}
      data-testid="enquiry-card"
      aria-label={`${label} enquiry ${out ? "to" : "from"} ${who}`}
      style={{
        display: "block",
        position: "relative",
        marginBottom: 12,
        borderRadius: 22,
        overflow: "hidden",
        textDecoration: "none",
        color: "var(--text)",
        background: `linear-gradient(160deg, ${tint}26 0%, ${tint}0a 46%, var(--card) 100%)`,
        border: `1.5px solid ${tint}40`,
        boxShadow: `0 8px 22px -16px ${tint}`,
      }}
    >
      {/* the kind, the side, how long ago — and where it stands, on the right */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px 0" }}>
        <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 9, background: tint, display: "grid", placeItems: "center", flexShrink: 0, boxShadow: `0 4px 10px -4px ${tint}` }}>
          <EnqIcon k={e.typeKey} size={14} color="#fff" sw={2.2} />
        </span>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.8, color: tint, textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", whiteSpace: "nowrap" }}>· {out ? "Sent" : "Received"}</span>
        <span
          data-testid="enquiry-stage"
          style={{ marginLeft: "auto", flexShrink: 0, fontSize: 9.5, fontWeight: 900, letterSpacing: 0.6, padding: "4px 9px", borderRadius: 999, color: c, background: `${c}1f`, border: `1px solid ${c}55`, textTransform: "uppercase" }}
        >
          {stageWord}
        </span>
      </div>

      {/* who, what, and the price */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px 0" }}>
        <EnqFace path={out ? e.toPhotoPath : e.fromPhotoPath} name={who} size={48} tint={out ? "#64748B" : tint} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16.5,
              fontWeight: 900,
              letterSpacing: -0.4,
              lineHeight: 1.15,
              fontFamily: DOS_DISPLAY,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {what}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--sub)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {out ? "to " : "from "}
            <b style={{ color: "var(--text)" }}>{who}</b>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: DOS_MONO, letterSpacing: -0.5, color: value ? "var(--text)" : "var(--muted)" }}>{value ? moneyShort(value) : "—"}</div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: "var(--muted)", marginTop: 1 }}>{value ? "PRICE" : "NO QUOTE"}</div>
        </div>
      </div>

      <div style={{ padding: "12px 14px 0" }}>
        <EnquiryRoad stage={stage} compact />
      </div>

      {/* the foot: when, where, and — only while it waits on you — what for */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 12px", flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, padding: "4px 9px", borderRadius: 999, background: "var(--el)", color: "var(--sub)" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <rect x="3.5" y="5" width="17" height="15" rx="3" />
            <path d="M3.5 10h17M8 3v4M16 3v4" />
          </svg>
          {day ? dateWords(day).replace(/ \d{4}$/, "") : "No date"}
        </span>
        <span style={{ fontSize: 10.5, color: "var(--muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.whereText || agoWords(e.createdAt, nowIso)}</span>
        {move ? (
          <span data-testid="enquiry-move" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 900, padding: "4px 10px", borderRadius: 999, background: "#F59E0B", color: "#1A1205" }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: "#1A1205" }} />
            {move}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
