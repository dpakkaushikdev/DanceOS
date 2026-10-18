"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ToolActions, ToolBody, ToolCard, ToolChip, ToolFacts, ToolHead, toolBtn } from "@/components/ui/ToolCard";
import { respondToEnquiryAction } from "@/features/enquiries/server-actions/enquiries";
import { stageTint } from "@/features/enquiries/components/enquiry-kit";
import { dateWords, moneyShort } from "./inbox-kit";
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

/** ONE ENQUIRY ON THE DESK, with its one move on it (18 Oct 2026, the user:
 *  "handle enquiries like how we handle classes"). The Classes screen's card
 *  grammar: the other end's face and name on the head, the stage as a chip, two
 *  figures, and — only while it waits on you — the move on the card's own bar.
 *  The whole card opens the enquiry; the bar's buttons sit above that link. */

/** what this enquiry waits on THIS end for, in two or three words — null when
 *  nothing (it is the other end's move, or it is over). The one rule the To do
 *  column and the card's button both read, so they cannot disagree. */
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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

  const accept = async () => {
    setBusy(true);
    setErr(null);
    const r = await respondToEnquiryAction({ enquiryId: e.id, accept: true, reason: null });
    setBusy(false);
    if (r.error) {
      setErr(r.error);
      return;
    }
    router.refresh();
  };

  return (
    /* ⚠ the stretched link keeps the accessible name every locator finds */
    <ToolCard testId="enquiry-card" href={href} hrefLabel={`${label} enquiry ${out ? "to" : "from"} ${who}`}>
      <ToolHead
        tint={tint}
        name={who}
        photoPath={out ? e.toPhotoPath : e.fromPhotoPath}
        eyebrow={`${label} · ${out ? "Sent" : "Received"}`}
        sub={what}
        right={<ToolChip testId="enquiry-stage" word={(revisionAsked(e) ? "Revision asked" : ENQ_STAGE_WORD[stage]).toUpperCase()} fg={c} bg={`${c}1f`} />}
      />
      <ToolBody>
        <ToolFacts
          tint={tint}
          items={[
            { label: "Date", value: day ? dateWords(day).replace(/ \d{4}$/, "") : "—" },
            { label: "Price", value: value ? moneyShort(value) : "—", tint: value ? c : undefined },
          ]}
        />
      </ToolBody>
      {move ? (
        <ToolActions>
          {!out && stage === "new" ? (
            <>
              {/* a decline asks why, which is the enquiry page's to ask */}
              <Link href={href} aria-label={`Decline the enquiry from ${who}`} style={toolBtn("secondary", tint)}>
                Decline ›
              </Link>
              <button type="button" disabled={busy} data-testid="enquiry-accept" aria-label={`Accept the enquiry from ${who}`} onClick={() => void accept()} style={toolBtn("primary", tint)}>
                {busy ? "Accepting…" : "Accept"}
              </button>
            </>
          ) : (
            <Link href={href} data-testid="enquiry-move" style={toolBtn("primary", tint)}>
              {move} ›
            </Link>
          )}
          {err ? (
            <div role="alert" style={{ flexBasis: "100%", fontSize: 11.5, color: "#F87171" }}>
              {err}
            </div>
          ) : null}
        </ToolActions>
      ) : null}
    </ToolCard>
  );
}
