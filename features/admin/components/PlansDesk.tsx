"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setPlanPriceAction } from "@/features/admin/server-actions/subscriptions";
import { toast } from "@/components/ui/Toast";
import { DOS_DISPLAY, INK, SUB } from "@/lib/design/tokens";
import type { PlanCatalogRow } from "@/repositories/plans";
import { toolBtn, type ToolBtnKind } from "@/components/ui/ToolCard";
import { DeskHero } from "./desk-kit";

const CARD = "var(--card)";
const EL = "var(--el)";
const MUTED = "var(--muted)";
/* the one button standard (28 Oct 2026): `toolBtn`, at least 40px tall, sized to its words */
const btn = (kind: ToolBtnKind, tint: string): React.CSSProperties => toolBtn(kind, tint, { flex: "0 0 auto", minHeight: 40 });

const KIND_WORDS: Record<PlanCatalogRow["kind"], { who: string; what: string; tone: string }> = {
  artist: { who: "a user", what: "unlocks the artist tools and makes their profile public", tone: "#EC4899" },
  studio: { who: "a person, per studio", what: "puts ONE studio on Discover — two studios need two", tone: "#0E7490" },
  /* ⚠ RETIRED 29 Sep 2026 — organizations went, so nothing can buy this plan.
     The ROW is still on the price list (`plan_catalog` holds `org_monthly`, and
     six granted mandates on production still point at it), so the desk draws it
     and says so rather than hiding a plan the database has. An admin reading
     this screen needs the truth about the catalogue, not a tidier version. */
  org: { who: "nobody — organizations are retired", what: "kept on the price list because granted mandates still name it; it cannot be bought", tone: "#78716C" },
};

/** PLANS (10 Sep 2026) — the user's ask, word for word: "keep the subscription
 *  amount dynamic; admin has the access to change the amount of subscription in
 *  admin console."
 *
 *  Each row is one plan on the price list. Changing a price changes what every
 *  screen prints and what the next order charges — and nothing else: an order
 *  already opened keeps the price it was opened at, because that is what the
 *  person agreed to. Switching a plan off takes it off offer without deleting
 *  it, so the rows that reference it still read. Every change is audited with
 *  the old and the new number. */
export function PlansDesk({ plans }: { plans: PlanCatalogRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [pending, start] = useTransition();

  const fire = (m: string) => toast(m);
  const oops = (m: string) => void toast.error(m);

  const save = (p: PlanCatalogRow, active: boolean) =>
    start(async () => {
      const inr = Number(price.replace(/[^\d]/g, ""));
      if (!Number.isFinite(inr)) return oops("A price is a whole number of rupees");
      const out = await setPlanPriceAction({ key: p.key, priceInr: inr, active });
      if (out.error) return oops(out.error);
      setEditing(null);
      fire(`${p.label} is ₹${inr.toLocaleString("en-IN")} a ${p.period === "monthly" ? "month" : "year"}${active ? "" : " — and off offer"}`);
      router.refresh();
    });

  const toggle = (p: PlanCatalogRow) =>
    start(async () => {
      const out = await setPlanPriceAction({ key: p.key, priceInr: p.priceInr, active: !p.active });
      if (out.error) return oops(out.error);
      fire(p.active ? `${p.label} is off offer — nobody new can take it` : `${p.label} is on offer again`);
      router.refresh();
    });

  return (
    <div style={{ padding: "14px 16px var(--dos-foot, 40px)" }}>
      {/* the page's own `<h1>`, in the one heading standard (DeskTop + HueHead, 28 Oct 2026) */}
      <DeskHero title="Plans" sub="what DanceOS charges, and to whom" tint="#F59E0B" />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {plans.map((p) => {
          const words = KIND_WORDS[p.kind];
          const isEditing = editing === p.key;
          return (
            <div key={p.key} data-testid="plan-row" style={{ background: CARD, border: `1.5px solid ${EL}`, borderLeft: `4px solid ${p.active ? words.tone : MUTED}`, borderRadius: 16, padding: "11px 12px", opacity: p.active ? 1 : 0.75 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: 13 }}>{p.label}</b>
                <span style={{ fontSize: 9.5, fontWeight: 900, padding: "2px 6px", borderRadius: 5, background: "var(--el)", color: SUB, textTransform: "uppercase" }}>{p.period}</span>
                {!p.active ? <span style={{ fontSize: 9.5, fontWeight: 900, padding: "2px 6px", borderRadius: 5, background: "#FEF3C7", color: "#92400E" }}>OFF OFFER</span> : null}
                <span style={{ marginLeft: "auto", fontSize: 19, fontWeight: 900, fontFamily: DOS_DISPLAY, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums", color: INK }} data-testid="plan-price">
                  ₹{p.priceInr.toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ fontSize: 11, color: SUB, marginTop: 4, lineHeight: 1.5 }}>
                For {words.who} — {words.what}. Key <code style={{ fontSize: 10 }}>{p.key}</code>.
              </div>

              {isEditing ? (
                <div style={{ marginTop: 9 }}>
                  <label htmlFor={`price-${p.key}`} style={{ display: "block", fontSize: 9.5, fontWeight: 900, letterSpacing: 1, color: MUTED, marginBottom: 5 }}>
                    NEW PRICE, IN RUPEES, A {p.period === "monthly" ? "MONTH" : "YEAR"}
                  </label>
                  <input
                    id={`price-${p.key}`}
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", background: "var(--bg)", border: `1.5px solid ${EL}`, borderRadius: 10, padding: "9px 10px", fontSize: 15, fontWeight: 800, color: INK, fontFamily: "inherit", fontVariantNumeric: "tabular-nums" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                    <button type="button" disabled={pending} onClick={() => save(p, p.active)} style={btn("primary", words.tone)} aria-label={`Save the price of ${p.label}`}>
                      {pending ? "Saving…" : "Save price"}
                    </button>
                    <button type="button" onClick={() => setEditing(null)} style={btn("secondary", words.tone)}>Cancel</button>
                  </div>
                  <div style={{ fontSize: 10, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>
                    Takes effect for the next order. Anyone who already paid keeps the price they paid; a live period is not
                    changed. The old and new price go in the audit log.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => { setPrice(String(p.priceInr)); setEditing(p.key); }} style={btn("tinted", words.tone)} aria-label={`Change the price of ${p.label}`}>
                    Change price
                  </button>
                  <button type="button" disabled={pending} onClick={() => toggle(p)} style={p.active ? btn("danger", words.tone) : btn("tinted", "#15803D")} aria-label={p.active ? `Take ${p.label} off offer` : `Put ${p.label} on offer`}>
                    {p.active ? "Take off offer" : "Put on offer"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10.5, color: MUTED, marginTop: 16, lineHeight: 1.55, borderTop: `1.5px solid ${EL}`, paddingTop: 12 }}>
        A price of ₹0 makes a plan free: the Subscribe button grants the period without a payment. Anything above zero is
        paid through Cashfree — the amount is read from this list when the order opens, never from the screen.
        Comping somebody a period is on Businesses (a studio) or Accounts (a user), and is a separate, audited decision.
      </div>

    </div>
  );
}
