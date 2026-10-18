"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  answerEndingAction,
  answerQuoteAction,
  cancelAdditionAction,
  declineCompletionAction,
  endEnquiryAction,
  markCompleteAction,
  recordEnquiryPaymentAction,
  respondToEnquiryAction,
  retractEndingAction,
  sendAdditionAction,
  sendQuoteAction,
} from "@/features/enquiries/server-actions/enquiries";
import { confirmCheckoutAction, startEnquiryCheckoutAction } from "@/features/payments/server-actions/payments";
import { EnqFace, EnquiryRoad, stageTint } from "@/features/enquiries/components/enquiry-kit";
import { QuoteComposer, QuoteLines, type ComposerValue } from "@/features/enquiries/components/QuoteComposer";
import { EnquiryFilesPanel, EnquiryPracticesPanel, EnquiryTeamPanel, type TeamPick } from "@/features/enquiries/components/EnquiryJobPanels";
import { EnquiryFormSheet } from "@/features/enquiries/components/EnquiryFormSheet";
import { DosHero, EnqIcon, Eyebrow, Surface, agoWords, dateWords, money } from "@/features/inbox/components/inbox-kit";
import { DOS_MONO } from "@/features/inbox/components/inbox-kit";
import { ColumnCount, columnTab, columnTrack } from "@/components/ui/ColumnTabs";
import { openCashfreeCheckout, preloadCheckout } from "@/lib/cashfree/checkout-client";
import { DOS_UI, LILAC } from "@/lib/design/tokens";
import {
  ENQ_CLOSED,
  ENQ_STAGE_WORD,
  ENQ_TINT,
  additionsOf,
  baseQuoteOf,
  enquiryMoney,
  enquiryStage,
  enquiryTypeOf,
  istDayKey,
  liveQuoteOf,
  openEndingOf,
  quoteExpired,
  revisionAsked,
  type Enquiry,
  type EnquiryFile,
  type EnquiryJob,
  type EnquiryQuote,
} from "@/types/enquiry";

/** ONE ENQUIRY, END TO END (3 Oct 2026 — the user's own process; re-cut 18 Oct
 *  2026: "what they asked for … on top", "different columns inside payments —
 *  earnings, quote with history", "quote should open like a form", "call it off
 *  should be on top right", "profile pics on top should take to profile").
 *
 *  Top to bottom:
 *    the header (call off / withdraw on its top right), WHO (faces are doors),
 *    WHAT THEY ASKED FOR, WHERE IT STANDS, then the sections
 *    Payments · Team · Practices · Files — both ends see all four.
 *    PAYMENTS: what needs an answer now (accept the enquiry, the ending terms,
 *    completion), then two columns — EARNINGS (the figures, the project, what is
 *    due and paid, additions) · QUOTE (the live quote and its history).
 *  Every rule is the database's (the RPCs). ⚠ Money logic is untouched by the
 *  re-cut — the same actions, the same arguments, only moved. */

const bizBtn: React.CSSProperties = {
  width: "100%",
  textAlign: "center",
  padding: 13,
  borderRadius: 999,
  background: "var(--text)",
  color: "var(--solid)",
  fontWeight: 900,
  fontSize: 13.5,
  cursor: "pointer",
  border: "none",
  fontFamily: "inherit",
};
const ghostBtn: React.CSSProperties = { ...bizBtn, background: "var(--el)", color: "var(--text)", fontWeight: 800, fontSize: 12.5 };
const greenBtn: React.CSSProperties = { ...bizBtn, background: "#22C55E", color: "#07240F" };
const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--solid)",
  border: "1.5px solid var(--el)",
  borderRadius: 10,
  padding: "10px 11px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};
const smallLabel: React.CSSProperties = { fontSize: 9, fontWeight: 900, letterSpacing: 0.7, color: "var(--muted)" };
const hint: React.CSSProperties = { fontSize: 11, color: "var(--sub)", lineHeight: 1.5 };

export type EnquirySection = "payments" | "team" | "practices" | "files";
/* ⚠ BOTH ENDS SEE ALL FOUR since 18 Oct 2026 (`20261026090000` lets the sender
   read the job) — the sender reads the team and practices and adds participants */
const SECTIONS: Array<{ k: EnquirySection; label: string }> = [
  { k: "payments", label: "Payments" },
  { k: "team", label: "Team" },
  { k: "practices", label: "Practices" },
  { k: "files", label: "Files" },
];
type PayColumn = "earnings" | "quote";

const signed = (n: number) => `${n < 0 ? "−" : ""}${money(Math.abs(n))}`;

/** a history row's date — "18 Oct, 6:30 pm", IST */
const historyDate = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

const quoteWord = (q: EnquiryQuote, nowIso: string): string =>
  q.kind === "addition"
    ? q.status === "accepted"
      ? q.costInr > 0
        ? q.fullPaidAt
          ? "Paid"
          : "Accepted · due"
        : "Accepted"
      : q.status === "declined"
        ? "Declined"
        : q.status === "cancelled"
          ? "Taken back"
          : q.status === "superseded"
            ? "Replaced"
            : "Waiting on an answer"
    : q.fullPaidAt
      ? "Paid in full"
      : q.advancePaidAt && q.advanceInr > 0
        ? "Advance paid"
        : q.status === "accepted"
          ? "Accepted"
          : q.status === "declined"
            ? q.revisionAskedAt
              ? "Revision asked"
              : "Declined"
            : q.status === "superseded"
              ? "Replaced"
              : quoteExpired(q, nowIso)
                ? "Expired"
                : "Waiting on an answer";
const quoteColour = (q: EnquiryQuote, nowIso: string): string =>
  q.fullPaidAt || q.status === "accepted"
    ? "#22C55E"
    : q.status === "declined" || quoteExpired(q, nowIso)
      ? "#F87171"
      : q.status === "superseded" || q.status === "cancelled"
        ? "var(--muted)"
        : "#F59E0B";

/** a reason asked for in place — one pattern for every "say why" on the page */
interface Ask {
  key: string;
  title: string;
  placeholder: string;
  confirm: string;
  /** a refund amount, between 0 and `max`, starting at `start` */
  amount?: { max: number; start: number };
  /** the reason may be left empty (a counter offer keeps the old one) */
  optional?: boolean;
  danger?: boolean;
  run: (reason: string, amount: number | null) => Promise<{ error: string | null }>;
  done: string;
}

/** a face, as a door to the profile when there is one */
function FaceDoor({ href, label, children }: { href: string | null; label: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} aria-label={label} style={{ display: "inline-flex", flexShrink: 0, borderRadius: 14 }}>
      {children}
    </Link>
  ) : (
    <>{children}</>
  );
}

export function EnquiryDetail({
  enquiry: e,
  mine,
  canWork,
  nowIso,
  meId,
  payOnline = false,
  paidBack = null,
  job = { available: false, people: [], practices: [] },
  team = [],
  initialTab = "payments",
  files = { available: false, files: [] },
  fromHref = null,
  toHref = null,
}: {
  /** the links shared on the enquiry (`20261025090000`), read for both ends */
  files?: { available: boolean; files: EnquiryFile[] };
  /** the job's people and practices (`20261024090000`) — `available: false` before it is applied */
  job?: EnquiryJob;
  /** the business's own people, offered as Team */
  team?: TeamPick[];
  initialTab?: EnquirySection;
  enquiry: Enquiry;
  /** the enquiry came TO me — I am on the business's (or crew's) side */
  mine: boolean;
  /** …and I may work it: an owner or manager, or the crew's leader */
  canWork: boolean;
  nowIso: string;
  /** who is reading — to say which end ended it */
  meId: string;
  /** a business's enquiry on a configured rail — the sender pays here */
  payOnline?: boolean;
  /** the outcome a phone was brought back with from the payment (`/pay/return`) */
  paidBack?: "paid" | "processing" | "refunded" | "failed" | null;
  /** the sender's profile — the FROM face is a door to it */
  fromHref?: string | null;
  /** the asked side's profile (a studio's page, an artist's person page, a crew's
   *  page) — null when it cannot be resolved, and the TO face is then a picture */
  toHref?: string | null;
}) {
  const router = useRouter();
  const type = enquiryTypeOf(e.typeKey);
  const tint = ENQ_TINT[e.typeKey] ?? "#8B5CF6";
  const stage = enquiryStage(e);
  const closed = ENQ_CLOSED.has(stage);
  const live = liveQuoteOf(e);
  const base = baseQuoteOf(e);
  const adds = additionsOf(e);
  const quotes = e.quotes.filter((q) => q.kind === "quote");
  const m = enquiryMoney(e);
  const ending = openEndingOf(e);
  const todayKey = istDayKey(nowIso);
  const projectOn = e.status === "ongoing" || e.status === "completing";
  const mySide: "sender" | "business" = mine ? "business" : "sender";
  /* the business's side acts only as an owner, a manager or the crew's leader */
  const acts = mine ? canWork : true;
  const otherName = mine ? e.fromName : e.businessName;

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<null | { mode: "quote" } | { mode: "addition"; revises: EnquiryQuote | null }>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [askReason, setAskReason] = useState("");
  const [askAmount, setAskAmount] = useState("");
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [tab, setTab] = useState<EnquirySection>(SECTIONS.some((s) => s.k === initialTab) ? initialTab : "payments");
  /* ⚠ the column is DERIVED until somebody picks one: while it is being priced
     it opens on the Quote, once the project is on on the Earnings — so accepting
     a quote lands on what is now due without an effect writing state */
  const [payPick, setPayPick] = useState<PayColumn | null>(null);
  const payCol: PayColumn = payPick ?? (base && (projectOn || closed) ? "earnings" : "quote");
  /* the section is the address (`?show=`), replaced — a tap is not a page */
  const pickTab = (k: EnquirySection) => {
    setTab(k);
    const url = new URL(window.location.href);
    if (k === "payments") url.searchParams.delete("show");
    else url.searchParams.set("show", k);
    window.history.replaceState(window.history.state, "", url.toString());
  };

  /* ── what is due, in the order it falls due ── */
  const dues: Array<{ quoteId: string; part: "advance" | "balance" | "full" | "addition"; amount: number; word: string }> = [];
  if (base && projectOn) {
    if (m.advanceDueInr > 0) dues.push({ quoteId: base.id, part: "advance", amount: m.advanceDueInr, word: "The advance" });
    for (const a of adds) {
      if (a.status === "accepted" && a.costInr > 0 && !a.fullPaidAt) dues.push({ quoteId: a.id, part: "addition", amount: a.costInr, word: `Addition #${a.n}` });
    }
    if (!m.balancePaid && m.advanceDueInr === 0 && m.balanceInr > 0) {
      dues.push({ quoteId: base.id, part: base.advanceInr > 0 ? "balance" : "full", amount: m.balanceInr, word: base.advanceInr > 0 ? "The balance" : "The project" });
    }
  }
  const canPay = !mine && payOnline && dues.length > 0 && !ending;
  useEffect(() => {
    if (canPay) preloadCheckout();
  }, [canPay]);

  const fire = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };
  const run = async (op: () => Promise<{ error: string | null }>, doneMsg: string) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const out = await op();
    setBusy(false);
    if (out.error) {
      setError(out.error);
      return false;
    }
    fire(doneMsg);
    router.refresh();
    return true;
  };
  const openAsk = (a: Ask) => {
    setAsk(a);
    setAskReason("");
    setAskAmount(a.amount ? String(a.amount.start) : "");
    setError(null);
  };
  const submitAsk = async () => {
    if (!ask) return;
    const reason = askReason.trim();
    if (!reason && !ask.optional) {
      setError("Say why — they will read it");
      return;
    }
    let amount: number | null = null;
    if (ask.amount) {
      amount = Number(askAmount);
      if (!Number.isInteger(amount) || amount < 0 || amount > ask.amount.max) {
        setError(`The refund is between ₹0 and ${money(ask.amount.max)}`);
        return;
      }
    }
    const ok = await run(() => ask.run(reason, amount), ask.done);
    if (ok) setAsk(null);
  };

  /* ⚠ PAYING (3 Oct 2026, "payment for enquiry should connect to payments"). Our
     order, then the Cashfree window, then the SERVER asks Cashfree what happened. */
  const confirmPay = async (orderId: string) => {
    setBusy(true);
    setError(null);
    const out = await confirmCheckoutAction({ orderId });
    setBusy(false);
    setOpenOrder(null);
    if (out.error || !out.outcome) {
      setError(out.error ?? "Could not confirm the payment");
      return;
    }
    fire(out.outcome === "booked" ? "Paid — they have been told" : out.outcome === "processing" ? "Payment received — confirming it now" : "That payment could not be applied — it is on its way back");
    router.refresh();
  };
  const pay = async (d: (typeof dues)[number]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await startEnquiryCheckoutAction({ quoteId: d.quoteId, enquiryId: e.id, businessName: e.businessName.slice(0, 80) || "DanceOS", description: `${type?.label ?? "Enquiry"} · ${d.word}` });
    if (!res.checkout) {
      setBusy(false);
      setError(res.error ?? "Could not start the payment");
      return;
    }
    const checkout = res.checkout;
    setOpenOrder(checkout.orderId);
    try {
      const result = await openCashfreeCheckout(checkout.paymentSessionId, checkout.mode);
      if (result.redirect) return;
    } catch (openError: unknown) {
      setBusy(false);
      setOpenOrder(null);
      setError(openError instanceof Error ? openError.message : "Could not open the payment window");
      return;
    }
    void confirmPay(checkout.orderId);
  };

  const closeComposer = () => {
    setComposer(null);
    setError(null);
  };
  /* ⚠ the composer is a SHEET: it closes FIRST (spending its history entry) and
     the page re-reads after, so a `back()` never races the refresh (19 Sep) */
  const submitComposer = async (v: ComposerValue) => {
    if (!composer || busy) return;
    setBusy(true);
    setError(null);
    const out =
      composer.mode === "quote"
        ? await sendQuoteAction({ enquiryId: e.id, items: v.items, lumpInr: v.lumpInr, advancePct: v.advancePct, validUntil: v.validUntil, note: v.note })
        : await sendAdditionAction({ enquiryId: e.id, items: v.items, lumpInr: v.lumpInr, note: v.note, revises: composer.revises?.id ?? null });
    setBusy(false);
    if (out.error) {
      setError(out.error);
      return;
    }
    const done = composer.mode === "quote" ? (quotes.length ? "Revised quote sent — they have been told" : "Quote sent — they have been told") : "Addition sent — they have been told";
    setComposer(null);
    fire(done);
    setTimeout(() => router.refresh(), 600);
  };

  const rows: Array<[string, string]> = [
    ...e.fields.filter(([k]) => k !== "Enquiry"),
    [e.dates.length > 1 ? "Dates" : "Date", e.dates.map(dateWords).join(", ")],
    ...(e.whereText ? ([["Where", e.whereText]] as Array<[string, string]>) : []),
  ];
  const tel = String((mine ? e.mobile : e.businessPhone) ?? "").replace(/[^\d+]/g, "");
  const endedBy = e.closedBy === meId ? "by you" : e.closedBy === e.fromUserId ? `by ${e.fromName}` : mine ? "by your side" : `by ${e.businessName}`;
  const accepted = e.endings.find((x) => x.status === "accepted");
  const lastRefused = [...e.endings].reverse().find((x) => x.status === "refused");
  const mayEnd = !closed && !ending && acts && !(mine && e.status === "new");

  /* ── the payments summary (18 Oct 2026) — every figure from `enquiryMoney`,
     the quote being priced standing in for the project before one is accepted ── */
  const priced = base ?? live;
  const advInr = priced ? priced.advanceInr : 0;
  const acceptedAdds = adds.filter((a) => a.status === "accepted");
  const backInr = e.endings.filter((x) => x.status === "accepted").reduce((s, x) => s + x.refundInr, 0);
  /* ⚠ ONE MONEY CARD (18 Oct 2026, the user: "better designed earnings") — the
     figure the job is worth, a bar of how much of it has come in, and every
     line it is made of, with nothing drawn as "—" */
  const worthInr = base ? m.totalInr : live ? live.costInr : 0;
  const paidPct = worthInr > 0 ? Math.min(100, Math.round((m.paidInr / worthInr) * 100)) : 0;
  const standing: { w: string; c: string } = !priced
    ? { w: "No quote yet", c: "var(--muted)" }
    : !base
      ? { w: live ? quoteWord(live, nowIso) : "Quoted", c: live ? quoteColour(live, nowIso) : "#F59E0B" }
      : m.outstandingInr > 0
        ? { w: `${money(m.outstandingInr)} due`, c: "#F59E0B" }
        : { w: "✓ Paid in full", c: "#22C55E" };
  const moneyLines: Array<{ k: string; v: string; note?: string; c?: string }> = [];
  if (priced) {
    moneyLines.push({ k: base ? "Quote" : "Quoted", v: money(priced.costInr) });
    if (advInr > 0) moneyLines.push({ k: "Advance", v: money(advInr), note: base?.advancePaidAt ? "paid" : base ? "due" : `${priced.advancePct}% up front`, c: base?.advancePaidAt ? "#22C55E" : base ? "#F59E0B" : undefined });
    moneyLines.push({ k: "On completion", v: money(Math.max(priced.costInr - advInr, 0)) });
  }
  acceptedAdds.forEach((a) => moneyLines.push({ k: `Addition #${a.n}`, v: a.costInr < 0 ? signed(a.costInr) : `+${money(a.costInr)}` }));
  if (m.additionsWaiting) moneyLines.push({ k: "Additions waiting", v: String(m.additionsWaiting), c: "#F59E0B" });
  if (backInr > 0) moneyLines.push({ k: "Refunded", v: money(backInr), c: "#F87171" });

  /* ── the "say why" box, drawn where it was asked for ── */
  const askBox = (key: string) =>
    ask && ask.key === key ? (
      <div data-testid={`ask-${key}`} style={{ marginTop: 10, background: "var(--solid)", borderRadius: 12, padding: 11, border: "1.5px solid var(--el)" }}>
        <div style={{ fontSize: 12.5, fontWeight: 900, marginBottom: 7 }}>{ask.title}</div>
        {ask.amount ? (
          <>
            <div style={{ ...smallLabel, marginBottom: 5 }}>REFUND · OF {money(ask.amount.max)} PAID</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7 }}>
              <span style={{ fontWeight: 900 }}>₹</span>
              <input value={askAmount} inputMode="numeric" onChange={(ev) => setAskAmount(ev.target.value.replace(/[^\d]/g, "").slice(0, 9))} aria-label="Refund amount" style={{ ...fieldStyle, flex: 1, fontFamily: DOS_MONO }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {(
                [
                  ["Full", ask.amount.max],
                  ["Half", Math.floor(ask.amount.max / 2)],
                  ["None", 0],
                ] as Array<[string, number]>
              ).map(([w, v]) => (
                <button key={w} type="button" aria-pressed={Number(askAmount) === v} onClick={() => setAskAmount(String(v))} style={{ ...ghostBtn, padding: "7px 4px", fontSize: 11, background: Number(askAmount) === v ? "var(--text)" : "var(--el)", color: Number(askAmount) === v ? "var(--solid)" : "var(--sub)" }}>
                  {w}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <textarea value={askReason} maxLength={500} rows={3} onChange={(ev) => setAskReason(ev.target.value)} placeholder={ask.placeholder} aria-label="Reason" style={{ ...fieldStyle, resize: "vertical", marginBottom: 8 }} />
        {error ? (
          <div role="alert" style={{ fontSize: 11.5, color: "#F87171", marginBottom: 8 }}>
            {error}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 7 }}>
          <button type="button" onClick={() => setAsk(null)} style={{ ...ghostBtn, flex: 1, color: "var(--sub)" }}>
            Back
          </button>
          <button type="button" disabled={busy} onClick={() => void submitAsk()} style={{ ...bizBtn, flex: 1.5, background: ask.danger ? "#F87171" : "var(--text)", color: ask.danger ? "#1F0707" : "var(--solid)" }}>
            {ask.confirm}
          </button>
        </div>
      </div>
    ) : null;

  /* ── ENDING IT, from the header's top right (18 Oct 2026) ── */
  const openEnd = () =>
    openAsk({
      key: "end",
      title: mine ? "Call off this enquiry?" : "Withdraw this enquiry?",
      placeholder: "Why — they will read this",
      confirm: m.paidInr > 0 ? "Propose these terms" : mine ? "Call it off" : "Withdraw",
      danger: true,
      amount: m.paidInr > 0 ? { max: m.paidInr, start: m.paidInr } : undefined,
      run: (reason, amount) => endEnquiryAction({ enquiryId: e.id, reason, refundInr: amount }),
      done: m.paidInr > 0 ? "Terms sent — they have been told" : mine ? "Called off — they have been told" : "Withdrawn — they have been told",
    });

  /* ── THE QUOTE CARD (the Quote column) — the live quote while it is being
     priced, the accepted one once the project is on ── */
  const shown = live ?? base;
  const mayQuote = mine && acts && ["new", "accepted", "quoted"].includes(e.status);
  const quoteCard = shown ? (
    <Surface tint={quoteColour(shown, nowIso)}>
      {/* ⚠ RE-CUT (18 Oct 2026, the user: "better designed … quotes section") —
          the price large, how it splits as one bar, the lines under it */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={smallLabel}>{quotes.length > 1 ? `QUOTE #${shown.n}` : "THE QUOTE"}</span>
        {shown.validUntil && shown.status === "sent" ? (
          <span style={{ fontSize: 10, fontWeight: 800, color: quoteExpired(shown, nowIso) ? "#F87171" : "var(--muted)" }}>· valid until {dateWords(shown.validUntil)}</span>
        ) : null}
        <span
          data-testid="live-quote-state"
          style={{ marginLeft: "auto", fontSize: 10, fontWeight: 900, padding: "4px 9px", borderRadius: 999, color: quoteColour(shown, nowIso), background: "var(--solid)", border: `1.5px solid ${quoteColour(shown, nowIso)}55` }}
        >
          {quoteWord(shown, nowIso)}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, fontFamily: DOS_MONO, marginTop: 6 }}>{money(shown.costInr)}</div>
      {/* the split: up front, then on completion — one bar, two labels */}
      <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--el)", marginTop: 9 }}>
        {shown.advanceInr > 0 ? <div style={{ width: `${Math.max(4, Math.min(100, shown.advancePct))}%`, background: "#8B5CF6" }} /> : null}
        <div style={{ flex: 1, background: "#3B82F655" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 11, fontWeight: 800 }}>
        <span style={{ color: shown.advanceInr ? "#8B5CF6" : "var(--muted)" }}>{shown.advanceInr ? `${money(shown.advanceInr)} up front · ${shown.advancePct}%` : "No advance"}</span>
        <span style={{ color: "var(--sub)" }}>{money(shown.costInr - shown.advanceInr)} on completion</span>
      </div>
      {shown.items.length ? (
        <div style={{ marginTop: 10, background: "var(--solid)", borderRadius: 12, padding: "2px 11px 6px" }}>
          <QuoteLines items={shown.items} costInr={shown.costInr} />
        </div>
      ) : null}
      {shown.note ? <div style={{ ...hint, marginTop: 8 }}>{shown.note}</div> : null}

      {shown.status === "sent" && !closed ? (
        mine ? (
          <div style={{ ...hint, marginTop: 10 }}>{quoteExpired(shown, nowIso) ? "Expired before they answered — send a revised one." : `Waiting on ${e.fromName}.`}</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 7, marginTop: 11 }}>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  openAsk({
                    key: "revise",
                    title: "Ask for a revised quote",
                    placeholder: "What should change — the price, a line, the advance…",
                    confirm: "Ask for a revision",
                    run: (reason) => answerQuoteAction({ quoteId: shown.id, enquiryId: e.id, answer: "revise", reason }),
                    done: "Asked for a revised quote — they have been told",
                  })
                }
                style={{ ...ghostBtn, flex: 1 }}
              >
                Ask to revise
              </button>
              <button
                type="button"
                disabled={busy || quoteExpired(shown, nowIso)}
                aria-label="Accept this quote"
                onClick={() => void run(() => answerQuoteAction({ quoteId: shown.id, enquiryId: e.id, answer: "accept", reason: null }), shown.advanceInr > 0 ? `Accepted — the project is on, ${money(shown.advanceInr)} due as the advance` : "Accepted — the project is on")}
                style={{ ...greenBtn, flex: 1.4, opacity: quoteExpired(shown, nowIso) ? 0.45 : 1 }}
              >
                {quoteExpired(shown, nowIso) ? "Expired" : `Accept ${money(shown.costInr)}`}
              </button>
            </div>
            {askBox("revise")}
          </>
        )
      ) : null}
    </Surface>
  ) : (
    <Surface>
      <div style={hint}>{mine ? "No quote yet." : `No quote yet — ${e.businessName} sends one here.`}</div>
    </Surface>
  );

  return (
    <div style={{ background: LILAC, maxWidth: 430, margin: "0 auto", color: "var(--text)", paddingBottom: 40, fontFamily: DOS_UI, minHeight: "100vh" }}>
      <DosHero
        tint={tint}
        label={mine ? type?.label ?? e.typeKey : `${type?.label ?? e.typeKey} · you asked`}
        title={otherName}
        right={
          mayEnd ? (
            /* ⚠ CALL IT OFF ON THE TOP RIGHT (18 Oct 2026). The accessible name is
               the old button's, so every locator still finds it */
            <button
              type="button"
              disabled={busy}
              aria-label={mine ? "Call it off" : "Withdraw enquiry"}
              data-testid="enquiry-end"
              onClick={openEnd}
              style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 999, border: "1.5px solid rgba(255,255,255,.55)", background: "rgba(220,38,38,.92)", color: "#fff", fontWeight: 900, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}
            >
              {mine ? "Call off" : "Withdraw"}
            </button>
          ) : (
            <span style={{ width: 38, height: 38, borderRadius: 19, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <EnqIcon k={e.typeKey} size={19} color="#fff" sw={2} />
            </span>
          )
        }
      />
      <div style={{ padding: "12px var(--dos-gutter) 0" }}>
        {ask?.key === "end" ? (
          <Surface tint="#F87171">
            <div style={hint}>{m.paidInr > 0 ? `${money(m.paidInr)} is paid — propose what goes back; ${otherName} accepts, counters or refuses.` : `Nothing is paid, so it ends at once.`}</div>
            {askBox("end")}
          </Surface>
        ) : null}

        {/* ── WHO — each face is a door to that profile ── */}
        <Surface>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FaceDoor href={fromHref} label={`Open ${e.fromName}'s profile`}>
              <EnqFace path={e.fromPhotoPath} name={e.fromName} size={42} tint={tint} />
            </FaceDoor>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={smallLabel}>FROM</div>
              <div style={{ fontSize: 13.5, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mine ? e.fromName : "You"}</div>
            </div>
            <span aria-hidden style={{ color: "var(--muted)", fontSize: 16 }}>
              →
            </span>
            <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
              <div style={smallLabel}>TO</div>
              <div style={{ fontSize: 13.5, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mine ? "You" : e.businessName}</div>
            </div>
            <FaceDoor href={toHref} label={`Open ${e.businessName}'s profile`}>
              <EnqFace path={e.toPhotoPath} name={e.businessName} size={42} tint="#64748B" />
            </FaceDoor>
          </div>
          {tel ? (
            <a
              href={`tel:${tel}`}
              aria-label={`Call ${otherName}`}
              style={{ marginTop: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 11, borderRadius: 999, background: "var(--solid)", border: "1.5px solid var(--el)", fontWeight: 800, fontSize: 13, color: "var(--text)", textDecoration: "none" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />
              </svg>
              Call {mine && e.mobile ? <span style={{ fontFamily: DOS_MONO, fontWeight: 600, color: "var(--sub)" }}>{e.mobile}</span> : null}
            </a>
          ) : null}
        </Surface>

        {/* ── WHAT THEY ASKED FOR — first, above where it stands (18 Oct 2026) ── */}
        {/* ⚠ RE-CUT SMALLER (18 Oct 2026, the user: "what they asked for section
            revamp and smaller and better design") — the answers as small tiles,
            two to a row, a long one across both; the message one quiet line */}
        <Surface tint={tint}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: 8, background: tint, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <EnqIcon k={e.typeKey} size={13} color="#fff" sw={2.2} />
            </span>
            <span style={{ ...smallLabel, color: "var(--text)" }}>{mine ? "WHAT THEY ASKED FOR" : "WHAT YOU ASKED FOR"}</span>
            <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 900, color: tint, whiteSpace: "nowrap" }}>{type?.label ?? e.typeKey}</span>
          </div>
          <dl data-testid="enquiry-asked" style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {rows.map(([k, v], i) => (
              <div key={`${k}·${i}`} style={{ background: "var(--solid)", borderRadius: 11, padding: "7px 10px", minWidth: 0, gridColumn: v.length > 22 ? "1 / -1" : undefined }}>
                <dt style={{ ...smallLabel, fontSize: 8.5, letterSpacing: 0.6 }}>{k.toUpperCase()}</dt>
                <dd style={{ margin: "2px 0 0", fontSize: 12.5, fontWeight: 800, lineHeight: 1.3, overflowWrap: "anywhere" }}>{v}</dd>
              </div>
            ))}
          </dl>
          {e.message ? (
            <p data-testid="enquiry-message" style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--sub)", fontStyle: "italic", overflowWrap: "anywhere" }}>
              “{e.message}”
            </p>
          ) : null}
        </Surface>

        {/* ── WHERE IT STANDS ── */}
        <Surface tint={stageTint(stage)}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <span style={smallLabel}>WHERE IT STANDS</span>
            <span data-testid="enquiry-stage" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 900, color: stageTint(stage) }}>
              {ENQ_STAGE_WORD[stage]}
            </span>
          </div>
          <EnquiryRoad stage={stage} />
          {closed ? (
            <div data-testid="enquiry-closed-by" style={{ fontSize: 11.5, color: "var(--sub)", marginTop: 9, lineHeight: 1.5 }}>
              {ENQ_STAGE_WORD[stage]} {endedBy}
              {e.closedAt ? ` · ${agoWords(e.closedAt, nowIso)}` : ""}
              {e.closeReason ? (
                <div data-testid="close-reason" style={{ marginTop: 4, color: "var(--text)" }}>
                  “{e.closeReason}”
                </div>
              ) : null}
              {accepted && accepted.refundInr > 0 ? (
                <div data-testid="refund-summary" style={{ marginTop: 6, fontWeight: 800, color: "var(--text)" }}>
                  {money(accepted.refundInr)} back
                  {accepted.refundOnlineInr ? ` · ${money(accepted.refundOnlineInr)} online, through Cashfree` : ""}
                  {accepted.refundHandInr ? ` · ${money(accepted.refundHandInr)} by hand` : ""}
                </div>
              ) : null}
            </div>
          ) : null}
          {mine && !canWork ? <div style={{ ...hint, marginTop: 9 }}>Read only — its owners and managers act on it.</div> : null}
        </Surface>

        {/* ── FOUR SECTIONS, BOTH ENDS (18 Oct 2026) ── */}
        <div role="tablist" aria-label="Enquiry sections" style={{ ...columnTrack(), marginBottom: 10 }}>
          {SECTIONS.map((s) => {
            const on = tab === s.k;
            const count =
              s.k === "team"
                ? job.people.length
                : s.k === "practices"
                  ? job.practices.filter((p) => p.status === "scheduled" && p.endsAt >= nowIso).length
                  : s.k === "files"
                    ? files.files.length
                    : null;
            return (
              <button key={s.k} type="button" role="tab" aria-selected={on} data-testid={`enquiry-tab-${s.k}`} onClick={() => pickTab(s.k)} style={columnTab(on)}>
                {s.label}
                {count ? <ColumnCount n={count} on={on} /> : null}
              </button>
            );
          })}
        </div>

        {tab === "team" ? <EnquiryTeamPanel enquiryId={e.id} job={job} canWork={mine && canWork} team={team} tint={tint} meId={meId} sender={{ id: e.fromUserId, name: e.fromName }} /> : null}
        {tab === "practices" ? (
          <EnquiryPracticesPanel
            enquiryId={e.id}
            job={job}
            canWork={mine && canWork}
            closed={closed}
            nowIso={nowIso}
            tint={tint}
            hostName={e.businessName}
            hostPhotoPath={e.toPhotoPath}
            typeKey={e.typeKey}
            myPart={mine ? (canWork ? "runs" : "team") : "participant"}
            linked={mine}
          />
        ) : null}
        {tab === "files" ? <EnquiryFilesPanel enquiryId={e.id} available={files.available} files={files.files} meId={meId} canWork={mine && canWork} closed={closed} tint={tint} /> : null}

        {tab === "payments" ? (
          <>
            {paidBack ? (
              <div
                role="status"
                data-testid="paid-back"
                style={{
                  borderRadius: 14,
                  padding: "11px 13px",
                  marginBottom: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  background: paidBack === "paid" ? "rgba(34,197,94,.14)" : "var(--card)",
                  border: `1.5px solid ${paidBack === "paid" ? "#22C55E" : "var(--el)"}`,
                  color: paidBack === "paid" ? "#22C55E" : "var(--sub)",
                }}
              >
                {paidBack === "paid" ? "✓ Payment confirmed" : paidBack === "processing" ? "Payment received — the bank is still confirming it" : paidBack === "refunded" ? "That payment could not be applied — it is on its way back" : "The payment didn't go through — nothing was charged"}
              </div>
            ) : null}

            {/* ── WHAT NEEDS AN ANSWER NOW, above the columns ── */}
            {mine && acts && e.status === "new" ? (
              <Surface tint="#3B82F6">
                <Eyebrow tint="#3B82F6">NEW ENQUIRY</Eyebrow>
                <div style={{ display: "flex", gap: 7 }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      openAsk({
                        key: "decline",
                        title: "Decline this enquiry?",
                        placeholder: "Why — they will read this",
                        confirm: "Decline",
                        danger: true,
                        run: (reason) => respondToEnquiryAction({ enquiryId: e.id, accept: false, reason }),
                        done: "Declined — they have been told",
                      })
                    }
                    style={{ ...ghostBtn, flex: 1 }}
                  >
                    Decline
                  </button>
                  <button type="button" disabled={busy} onClick={() => void run(() => respondToEnquiryAction({ enquiryId: e.id, accept: true, reason: null }), "Accepted — they have been told")} style={{ ...greenBtn, flex: 1.4 }}>
                    Accept enquiry
                  </button>
                </div>
                {askBox("decline")}
              </Surface>
            ) : null}

            {revisionAsked(e) && live ? (
              <div data-testid="revision-asked" style={{ borderRadius: 14, padding: "11px 13px", marginBottom: 10, fontSize: 12, lineHeight: 1.5, background: "rgba(245,158,11,.12)", border: "1.5px solid #F59E0B" }}>
                <b style={{ color: "#F59E0B" }}>{mine ? `${e.fromName} asked for a revised quote.` : "You asked for a revised quote."}</b>
                {live.answerReason ? <div style={{ marginTop: 4 }}>“{live.answerReason}”</div> : null}
              </div>
            ) : null}

            {/* ── ENDING IT ── terms after money; at once before it */}
            {ending ? (
              <Surface tint="#F87171">
                <Eyebrow tint="#F87171">{ending.outcome === "withdrawn" ? "ENDING IT · WITHDRAWAL" : "ENDING IT · CALLED OFF"}</Eyebrow>
                <div data-testid="ending-terms" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                  <b>{ending.side === mySide ? "You" : otherName}</b> proposed {money(ending.refundInr)} back of the {money(m.paidInr)} paid.
                  <div style={{ marginTop: 4, color: "var(--sub)" }}>“{ending.reason}”</div>
                </div>
                {e.endings.length > 1 ? (
                  <div style={{ marginTop: 8 }}>
                    {e.endings
                      .filter((x) => x.id !== ending.id)
                      .map((x) => (
                        <div key={x.id} style={{ fontSize: 10.5, color: "var(--muted)", padding: "2px 0" }}>
                          {x.side === mySide ? "You" : otherName} · {money(x.refundInr)} · {x.status}
                          {x.answerReason ? ` — “${x.answerReason}”` : ""}
                        </div>
                      ))}
                  </div>
                ) : null}
                {acts ? (
                  ending.side === mySide ? (
                    <button type="button" disabled={busy} onClick={() => void run(() => retractEndingAction({ endingId: ending.id, enquiryId: e.id }), "Taken back — the project carries on")} style={{ ...ghostBtn, marginTop: 10 }}>
                      Take back these terms
                    </button>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            openAsk({
                              key: "refuse-ending",
                              title: "Refuse these terms?",
                              placeholder: "Why — the project stays open",
                              confirm: "Refuse",
                              danger: true,
                              run: (reason) => answerEndingAction({ endingId: ending.id, enquiryId: e.id, answer: "refuse", refundInr: null, reason }),
                              done: "Refused — the project stays open",
                            })
                          }
                          style={{ ...ghostBtn, flex: 1, minWidth: 90 }}
                        >
                          Refuse
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            openAsk({
                              key: "counter-ending",
                              title: "Propose different terms",
                              placeholder: "Why this amount (optional)",
                              confirm: "Send the counter",
                              optional: true,
                              amount: { max: m.paidInr, start: ending.refundInr },
                              run: (reason, amount) => answerEndingAction({ endingId: ending.id, enquiryId: e.id, answer: "counter", refundInr: amount, reason: reason || null }),
                              done: "Counter sent — they have been told",
                            })
                          }
                          style={{ ...ghostBtn, flex: 1, minWidth: 90 }}
                        >
                          Counter
                        </button>
                        <button type="button" disabled={busy} aria-label="Accept these terms" onClick={() => void run(() => answerEndingAction({ endingId: ending.id, enquiryId: e.id, answer: "accept", refundInr: null, reason: null }), "Agreed — the enquiry is closed")} style={{ ...greenBtn, flex: 1.4, minWidth: 120 }}>
                          Accept · {money(ending.refundInr)} back
                        </button>
                      </div>
                      {askBox("refuse-ending")}
                      {askBox("counter-ending")}
                    </>
                  )
                ) : null}
              </Surface>
            ) : null}

            {lastRefused && !ending && !closed ? (
              <div data-testid="ending-refused" style={{ borderRadius: 14, padding: "11px 13px", marginBottom: 10, fontSize: 12, lineHeight: 1.5, background: "var(--card)", border: "1.5px solid var(--el)" }}>
                {lastRefused.side === mySide ? `${otherName} refused your terms` : "You refused their terms"}
                {lastRefused.answerReason ? `: “${lastRefused.answerReason}”` : ""}. It stays open —{" "}
                <Link href="/support" style={{ color: "var(--text)", fontWeight: 800 }}>
                  message DanceOS
                </Link>{" "}
                if you cannot agree.
              </div>
            ) : null}

            {/* ── COMPLETION ── either side marks it; the other confirms */}
            {projectOn ? (
              <Surface tint={e.status === "completing" ? "#22C55E" : undefined}>
                <Eyebrow>COMPLETION</Eyebrow>
                {e.status === "completing" ? (
                  e.completeAskedSide === mySide ? (
                    <>
                      <div data-testid="completion-waiting" style={{ fontSize: 12, lineHeight: 1.5 }}>
                        Marked complete — waiting for {otherName} to confirm.
                      </div>
                      {acts ? (
                        <button type="button" disabled={busy} onClick={() => void run(() => declineCompletionAction({ enquiryId: e.id, reason: null }), "Taken back — the project is on again")} style={{ ...ghostBtn, marginTop: 9, padding: 10, fontSize: 12 }}>
                          Take it back
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div data-testid="completion-asked" style={{ fontSize: 12, lineHeight: 1.5 }}>
                        <b>{otherName}</b> marked it complete.
                      </div>
                      {acts ? (
                        <>
                          <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                openAsk({
                                  key: "not-yet",
                                  title: "Not finished yet?",
                                  placeholder: "What is still to do",
                                  confirm: "Say not yet",
                                  run: (reason) => declineCompletionAction({ enquiryId: e.id, reason }),
                                  done: "Sent back — the project is on again",
                                })
                              }
                              style={{ ...ghostBtn, flex: 1 }}
                            >
                              Not finished
                            </button>
                            <button type="button" disabled={busy} onClick={() => void run(() => markCompleteAction({ enquiryId: e.id }), "Completed — the project is closed")} style={{ ...greenBtn, flex: 1.4 }}>
                              Confirm complete
                            </button>
                          </div>
                          {askBox("not-yet")}
                        </>
                      ) : null}
                    </>
                  )
                ) : (
                  <>
                    <div style={hint}>
                      {m.readyToComplete
                        ? `All paid — mark it complete when the job is done.`
                        : `Can be completed once ${[m.outstandingInr ? `${money(m.outstandingInr)} is paid` : null, m.additionsWaiting ? "every addition is answered" : null].filter(Boolean).join(" and ") || "everything is settled"}.`}
                    </div>
                    {acts ? (
                      <button type="button" disabled={busy || !m.readyToComplete || Boolean(ending)} onClick={() => void run(() => markCompleteAction({ enquiryId: e.id }), "Marked complete — they confirm it")} style={{ ...greenBtn, marginTop: 9, opacity: m.readyToComplete && !ending ? 1 : 0.45 }}>
                        Mark the project complete
                      </button>
                    ) : null}
                  </>
                )}
              </Surface>
            ) : null}

            {/* ── TWO COLUMNS: EARNINGS · QUOTE (18 Oct 2026) ── */}
            <div role="tablist" aria-label="Payments" style={{ ...columnTrack(), marginBottom: 10 }}>
              {(
                [
                  ["earnings", "Earnings"],
                  ["quote", "Quote"],
                ] as Array<[PayColumn, string]>
              ).map(([k, w]) => {
                const on = payCol === k;
                return (
                  <button key={k} type="button" role="tab" aria-selected={on} data-testid={`enquiry-pay-${k}`} onClick={() => setPayPick(k)} style={columnTab(on)}>
                    {w}
                    {k === "quote" && quotes.length ? <ColumnCount n={quotes.length} on={on} /> : k === "earnings" && dues.length ? <ColumnCount n={dues.length} on={on} attention={canPay || (mine && acts)} /> : null}
                  </button>
                );
              })}
            </div>

            {payCol === "earnings" ? (
              <>
                <Surface tint="#22C55E">
                  <div data-testid="enquiry-money">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={smallLabel}>{base ? "THE PROJECT" : priced ? "QUOTED" : "EARNINGS"}</div>
                        {base ? (
                          <div data-testid="project-total" style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1, fontFamily: DOS_MONO, marginTop: 2 }}>
                            {money(m.totalInr)}
                          </div>
                        ) : (
                          <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1, fontFamily: DOS_MONO, marginTop: 2, color: priced ? "var(--text)" : "var(--muted)" }}>{priced ? money(worthInr) : "—"}</div>
                        )}
                      </div>
                      <span data-testid="money-standing" style={{ flexShrink: 0, marginTop: 4, fontSize: 10.5, fontWeight: 900, padding: "5px 10px", borderRadius: 999, color: standing.c, background: "var(--solid)", border: "1.5px solid var(--el)" }}>
                        {standing.w}
                      </span>
                    </div>
                    {priced ? (
                      <>
                        <div aria-label={`${paidPct}% received`} style={{ height: 9, borderRadius: 999, background: "var(--el)", overflow: "hidden", marginTop: 10 }}>
                          <div style={{ width: `${paidPct}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #22C55E, #16A34A)" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, fontWeight: 800 }}>
                          <span data-testid="money-received" style={{ color: "#22C55E" }}>
                            {money(m.paidInr)} received
                          </span>
                          <span data-testid="money-due" style={{ color: base && m.outstandingInr ? "#F59E0B" : "var(--muted)" }}>
                            {base ? (m.outstandingInr ? `${money(m.outstandingInr)} to come` : "nothing to come") : "due once accepted"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div style={{ ...hint, marginTop: 6 }}>{mine ? "Send a quote from the Quote column." : `${e.businessName} sends a quote first.`}</div>
                    )}
                  </div>
                  {moneyLines.length ? (
                    <div data-testid="enquiry-breakup" style={{ marginTop: 12, background: "var(--solid)", borderRadius: 13, padding: "4px 12px" }}>
                      {moneyLines.map((l, i) => (
                        <div key={l.k} data-testid={`breakup-${l.k.toLowerCase().replace(/[^a-z]+/g, "-")}`} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "8px 0", borderBottom: i < moneyLines.length - 1 ? "1px dashed var(--el)" : "none", fontSize: 12.5 }}>
                          <span style={{ color: "var(--sub)", fontWeight: 700 }}>{l.k}</span>
                          {l.note ? <span style={{ fontSize: 9.5, fontWeight: 900, color: l.c ?? "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{l.note}</span> : null}
                          <b style={{ marginLeft: "auto", fontFamily: DOS_MONO, color: l.note ? undefined : l.c }}>{l.v}</b>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* ── WHAT IS DUE, with its button — inside the one card ── */}
                  {base && projectOn && dues.length ? (
                    <>
                      <div data-testid="dues" style={{ marginTop: 12 }}>
                        <div style={{ ...smallLabel, marginBottom: 6 }}>DUE NOW</div>
                        {dues.map((d) => (
                          <div key={`${d.quoteId}-${d.part}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", marginBottom: 6, borderRadius: 12, background: "rgba(245,158,11,.1)", border: "1.5px solid rgba(245,158,11,.35)" }}>
                            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 800 }}>
                              {d.word} · {money(d.amount)}
                            </span>
                            {mine ? (
                              acts ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void run(() => recordEnquiryPaymentAction({ quoteId: d.quoteId, enquiryId: e.id, part: d.part }), `${d.word} recorded · ${money(d.amount)}`)}
                                  style={{ ...greenBtn, width: "auto", padding: "8px 12px", fontSize: 11.5 }}
                                >
                                  Record received
                                </button>
                              ) : null
                            ) : canPay ? (
                              <button type="button" disabled={busy} data-testid="enquiry-pay" onClick={() => void pay(d)} style={{ ...greenBtn, width: "auto", padding: "8px 12px", fontSize: 11.5 }}>
                                Pay {money(d.amount)}
                              </button>
                            ) : null}
                          </div>
                        ))}
                        <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 4, lineHeight: 1.5 }}>
                          {mine ? "Record cash or a bank transfer here." : canPay ? "UPI · cards · netbanking, through Cashfree." : ending ? "Payments pause while the ending terms are open." : `Settle with ${e.businessName} directly — they record it here.`}
                        </div>
                        {busy && openOrder ? (
                          <button type="button" onClick={() => void confirmPay(openOrder)} style={{ display: "block", margin: "8px auto 0", background: "none", border: "none", color: "var(--sub)", fontSize: 11.5, fontWeight: 800, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
                            Paid already, or stuck? Check my payment
                          </button>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </Surface>

                {/* ── ADDITIONS ── */}
                {adds.length || (mine && acts && projectOn && !ending) ? (
                  <Surface>
                    <Eyebrow>{`ADDITIONS${adds.length ? ` · ${adds.length}` : ""}`}</Eyebrow>
                    <div data-testid="additions">
                      {adds.map((a) => {
                        const revisedBy = adds.find((x) => x.revises === a.id);
                        return (
                          <div key={a.id} data-testid={`addition-${a.n}`} style={{ padding: "9px 0", borderBottom: "1px solid var(--el)", opacity: a.status === "cancelled" || a.status === "superseded" ? 0.6 : 1 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                              <span style={{ fontSize: 9.5, fontWeight: 900, color: "var(--muted)", fontFamily: DOS_MONO }}>#{a.n}</span>
                              <b style={{ fontSize: 14, color: a.costInr < 0 ? "#22C55E" : undefined }}>{a.costInr < 0 ? `${signed(a.costInr)} off` : `+${money(a.costInr)}`}</b>
                              <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 900, color: quoteColour(a, nowIso) }}>{quoteWord(a, nowIso)}</span>
                            </div>
                            {a.revises ? <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>Revised from #{adds.find((x) => x.id === a.revises)?.n ?? "?"}</div> : null}
                            {a.note ? <div style={{ fontSize: 11.5, color: "var(--sub)", marginTop: 3 }}>{a.note}</div> : null}
                            <QuoteLines items={a.items} costInr={a.costInr} />
                            {a.answerReason ? <div style={{ fontSize: 11.5, marginTop: 5 }}>Declined: “{a.answerReason}”</div> : null}
                            {a.status === "sent" && projectOn ? (
                              mine ? (
                                acts ? (
                                  <button type="button" disabled={busy} onClick={() => void run(() => cancelAdditionAction({ quoteId: a.id, enquiryId: e.id }), "Taken back — they have been told")} style={{ ...ghostBtn, marginTop: 8, padding: 9, fontSize: 11.5 }}>
                                    Take it back
                                  </button>
                                ) : null
                              ) : (
                                <>
                                  <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        openAsk({
                                          key: `decline-add-${a.id}`,
                                          title: "Decline this addition",
                                          placeholder: "Why — they can send a revised one",
                                          confirm: "Decline",
                                          danger: true,
                                          run: (reason) => answerQuoteAction({ quoteId: a.id, enquiryId: e.id, answer: "decline", reason }),
                                          done: "Declined — they have been told",
                                        })
                                      }
                                      style={{ ...ghostBtn, flex: 1, padding: 10, fontSize: 12 }}
                                    >
                                      Decline
                                    </button>
                                    <button type="button" disabled={busy} aria-label={`Accept addition #${a.n}`} onClick={() => void run(() => answerQuoteAction({ quoteId: a.id, enquiryId: e.id, answer: "accept", reason: null }), a.costInr > 0 ? `Accepted — ${money(a.costInr)} is due now` : "Accepted — the balance is lower")} style={{ ...greenBtn, flex: 1.4, padding: 10, fontSize: 12 }}>
                                      Accept {a.costInr < 0 ? `${signed(a.costInr)} off` : `+${money(a.costInr)}`}
                                    </button>
                                  </div>
                                  {askBox(`decline-add-${a.id}`)}
                                </>
                              )
                            ) : null}
                            {mine && acts && a.status === "declined" && !revisedBy && projectOn && !ending ? (
                              <button type="button" onClick={() => setComposer({ mode: "addition", revises: a })} style={{ ...ghostBtn, marginTop: 8, padding: 9, fontSize: 11.5 }}>
                                Send a revised addition
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    {!adds.length ? <div style={hint}>Nothing added yet.</div> : null}
                    {mine && acts && projectOn && !ending ? (
                      <button type="button" onClick={() => setComposer({ mode: "addition", revises: null })} style={{ ...bizBtn, marginTop: 10, background: tint, color: "#08060C" }}>
                        Add to the project
                      </button>
                    ) : null}
                  </Surface>
                ) : null}
              </>
            ) : (
              <>
                {mayQuote ? (
                  <button type="button" onClick={() => setComposer({ mode: "quote" })} style={{ ...bizBtn, background: tint, color: "#08060C", marginBottom: 10 }}>
                    {quotes.length ? "Revise the quote" : "Send a quote"}
                  </button>
                ) : null}
                {quoteCard}

                {/* ── QUOTE HISTORY ── every quote and every reason, oldest first */}
                {quotes.length ? (
                  <Surface>
                    <Eyebrow>{`HISTORY · ${quotes.length}`}</Eyebrow>
                    <div data-testid="quote-history">
                      {quotes.map((q, i) => {
                        const prev = quotes[i - 1];
                        const delta = prev ? q.costInr - prev.costInr : 0;
                        const dead = q.status === "superseded";
                        return (
                          <div key={q.id} style={{ display: "flex", gap: 10, opacity: dead ? 0.6 : 1 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 14, flexShrink: 0 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 5, background: quoteColour(q, nowIso), marginTop: 4 }} />
                              {i < quotes.length - 1 ? <span style={{ flex: 1, width: 2, background: "var(--el)", marginTop: 2 }} /> : null}
                            </div>
                            <div data-testid={`quote-${q.n}`} style={{ flex: 1, minWidth: 0, marginBottom: i < quotes.length - 1 ? 10 : 0, background: "var(--solid)", border: "1.5px solid var(--el)", borderRadius: 12, padding: "9px 11px" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                                <span style={{ fontSize: 9.5, fontWeight: 900, color: "var(--muted)", fontFamily: DOS_MONO }}>{i === 0 ? `#${q.n} · FIRST` : `#${q.n} · REVISION ${i}`}</span>
                                <span data-testid={`quote-${q.n}-state`} style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800, color: quoteColour(q, nowIso) }}>
                                  {quoteWord(q, nowIso)}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 3 }}>
                                <b style={{ fontSize: 16, fontFamily: DOS_MONO, textDecoration: dead ? "line-through" : "none" }}>{money(q.costInr)}</b>
                                {delta ? (
                                  <span data-testid={`quote-${q.n}-delta`} style={{ fontSize: 10.5, fontWeight: 900, color: delta < 0 ? "#22C55E" : "#F59E0B" }}>
                                    {delta < 0 ? "▼" : "▲"} {money(Math.abs(delta))}
                                  </span>
                                ) : prev ? (
                                  <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--muted)" }}>no change</span>
                                ) : null}
                                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--sub)", fontWeight: 700 }}>{historyDate(q.createdAt)}</span>
                              </div>
                              <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 2 }}>
                                {q.items.length ? `${q.items.length} line${q.items.length > 1 ? "s" : ""} · ` : ""}
                                {q.advancePct > 0 ? `${money(q.advanceInr)} (${q.advancePct}%) up front` : "No advance"}
                              </div>
                              {q.answerReason ? (
                                <div data-testid={`quote-${q.n}-reason`} style={{ fontSize: 11, marginTop: 5, padding: "6px 8px", borderRadius: 8, background: "var(--el)" }}>
                                  <span style={{ ...smallLabel, display: "block", marginBottom: 2 }}>{q.revisionAskedAt ? "REVISION ASKED" : "REASON"}</span>“{q.answerReason}”
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Surface>
                ) : null}
              </>
            )}
          </>
        ) : null}

        {error && !ask && !composer ? (
          <div role="alert" style={{ fontSize: 11.5, color: "#F87171", marginTop: 8 }}>
            {error}
          </div>
        ) : null}
      </div>

      {/* ── THE QUOTE / ADDITION FORM — a sheet (18 Oct 2026, the user: "quote
          should open like a form when adding or revising") ── */}
      {composer ? (
        <EnquiryFormSheet
          title={composer.mode === "quote" ? (quotes.length ? "Revise the quote" : "Send a quote") : composer.revises ? `Revise addition #${composer.revises.n}` : "Add to the project"}
          onClose={closeComposer}
        >
          {composer.mode === "quote" ? (
            <QuoteComposer
              mode="quote"
              tint={tint}
              todayKey={todayKey}
              start={live ? { items: live.items, costInr: live.costInr, advancePct: live.advancePct, note: live.note } : null}
              busy={busy}
              error={error}
              submitWord={quotes.length ? "Send the revised quote" : "Send quote"}
              onSubmit={(v) => void submitComposer(v)}
              onCancel={closeComposer}
            />
          ) : (
            <QuoteComposer
              mode="addition"
              tint={tint}
              todayKey={todayKey}
              start={composer.revises ? { items: composer.revises.items, costInr: composer.revises.costInr, advancePct: 0, note: composer.revises.note } : null}
              busy={busy}
              error={error}
              submitWord="Send the addition"
              onSubmit={(v) => void submitComposer(v)}
              onCancel={closeComposer}
            />
          )}
        </EnquiryFormSheet>
      ) : null}

      {toast ? (
        <div role="status" aria-live="polite" style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", background: "var(--solid)", border: "1.5px solid #0EA5E9", boxShadow: "0 6px 24px rgba(0,0,0,.45)", color: "var(--text)", padding: "11px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, maxWidth: 360, textAlign: "center", zIndex: 650 }}>
          {toast}
        </div>
      ) : null}
    </div>
  );
}
