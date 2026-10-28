"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { endSubscriptionAction } from "@/features/admin/server-actions/subscriptions";
import { dateWords } from "@/features/settings/components/settings-kit";
import { toast } from "@/components/ui/Toast";
import { INK, SUB } from "@/lib/design/tokens";
import type { AdminSubscription, SubscriptionStatus } from "@/repositories/subscriptions";
import { agoWords } from "@/types/notification";
import { toolBtn, type ToolBtnKind } from "@/components/ui/ToolCard";
import { DeskHero } from "./desk-kit";

const CARD = "var(--card)";
const EL = "var(--el)";
const MUTED = "var(--muted)";
/* the one button standard (28 Oct 2026): `toolBtn`, at least 40px tall, sized to its words */
const btn = (kind: ToolBtnKind, tint: string): React.CSSProperties => toolBtn(kind, tint, { flex: "0 0 auto", minHeight: 40 });

const STATUS: Record<SubscriptionStatus, { word: string; tone: string }> = {
  pending_auth: { word: "NOT AUTHORISED", tone: "#F59E0B" },
  active: { word: "ACTIVE", tone: "#22C55E" },
  past_due: { word: "PAST DUE", tone: "#EF4444" },
  canceled: { word: "ENDING", tone: "#F59E0B" },
  expired: { word: "ENDED", tone: MUTED },
};

const FILTERS: Array<[SubscriptionStatus | "all", string]> = [
  ["all", "All"],
  ["active", "Active"],
  ["past_due", "Past due"],
  ["canceled", "Ending"],
  ["pending_auth", "Unauthorised"],
  ["expired", "Ended"],
];

/** SUBSCRIPTIONS (10 Sep 2026) — every recurring plan on the platform, the way
 *  a billing desk sees it: who, for what, what it renews at, where it stands,
 *  and why a renewal failed. The one decision here is ENDING one, which is a
 *  sanction — access stops now and the mandate is cancelled — so it demands a
 *  reason the owner reads. Comping a period lives on Businesses (a studio) or
 *  Accounts (a person). Prices live on Plans. */
export function SubscriptionsDesk({ rows, status, nowIso }: { rows: AdminSubscription[]; status: SubscriptionStatus | "all"; nowIso: string }) {
  const router = useRouter();
  const [ending, setEnding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const fire = (m: string) => toast(m);
  const oops = (m: string) => void toast.error(m);

  const end = (s: AdminSubscription) =>
    start(async () => {
      const out = await endSubscriptionAction({ subscriptionId: s.id, reason: reason.trim() });
      if (out.error) return oops(out.error);
      setEnding(null);
      setReason("");
      fire(`${s.kind === "studio" ? s.businessName ?? "The studio" : s.userName}'s subscription has ended — they have been told why`);
      router.refresh();
    });

  const pastDue = rows.filter((r) => r.status === "past_due").length;

  return (
    <div style={{ padding: "14px 16px var(--dos-foot, 40px)" }}>
      {/* the page's own `<h1>`, in the one heading standard (DeskTop + HueHead, 28 Oct 2026) */}
      <DeskHero title="Subscriptions" sub={pastDue > 0 ? `${pastDue} renewal${pastDue === 1 ? "" : "s"} failing` : `${rows.length} shown`} tint={pastDue > 0 ? "#F43F5E" : "#22C55E"} />

      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", scrollbarWidth: "none" }}>
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/admin/subscriptions?status=${k}`} style={{ flex: "0 0 auto", minHeight: 40, boxSizing: "border-box", display: "inline-flex", alignItems: "center", padding: "6px 13px", borderRadius: 999, fontSize: 11, fontWeight: 800, textDecoration: "none", background: status === k ? "var(--text)" : CARD, color: status === k ? "var(--solid)" : SUB, border: `1.5px solid ${status === k ? "var(--text)" : EL}`, whiteSpace: "nowrap" }}>
            {label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ fontSize: 11.5, color: SUB, lineHeight: 1.55 }}>Nothing here.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((s) => {
            const st = STATUS[s.status];
            const who = s.kind === "studio" ? `${s.businessName ?? "a studio"} · ${s.userName}` : s.userName;
            return (
              <div key={s.id} data-testid="admin-subscription" style={{ background: CARD, border: `1.5px solid ${EL}`, borderLeft: `4px solid ${st.tone}`, borderRadius: 16, padding: "11px 12px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <b style={{ fontSize: 13 }}>{who}</b>
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.5, padding: "2px 6px", borderRadius: 5, background: s.kind === "studio" ? "#DBEAFE" : "#FCE7F3", color: s.kind === "studio" ? "#1D4ED8" : "#BE185D" }}>
                    {s.kind === "studio" ? "STUDIO" : "ARTIST"}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.5, padding: "2px 6px", borderRadius: 5, background: `${st.tone}22`, color: st.tone }}>{st.word}</span>
                  {s.granted ? <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.5, padding: "2px 6px", borderRadius: 5, background: "var(--el)", color: SUB }}>GRANTED</span> : null}
                  {s.cancelAtPeriodEnd && s.status === "active" ? <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.5, padding: "2px 6px", borderRadius: 5, background: "#FEF3C7", color: "#92400E" }}>WILL NOT RENEW</span> : null}
                </div>
                <div style={{ fontSize: 10.5, color: SUB, marginTop: 4, lineHeight: 1.5 }}>
                  {s.granted ? "₹0 · granted" : `₹${s.priceInr.toLocaleString("en-IN")} a ${s.period === "yearly" ? "year" : "month"}`}
                  {s.currentPeriodEnd ? ` · paid through ${dateWords(s.currentPeriodEnd)}` : ""}
                  {s.nextChargeOn && s.status === "active" && !s.granted && !s.cancelAtPeriodEnd ? ` · next charge ${dateWords(s.nextChargeOn)}` : ""}
                  {s.providerStatus ? ` · Cashfree says ${s.providerStatus}` : ""}
                  {` · started ${agoWords(s.createdAt, nowIso)}`}
                </div>
                {s.failureReason ? (
                  <div style={{ fontSize: 11, color: "#B42318", marginTop: 6, lineHeight: 1.45, background: "#FEF2F2", borderRadius: 10, padding: "6px 9px" }}>{s.failureReason}</div>
                ) : null}

                {s.status !== "expired" ? (
                  ending === s.id ? (
                    <div style={{ marginTop: 9 }}>
                      <label htmlFor={`end-${s.id}`} style={{ display: "block", fontSize: 9.5, fontWeight: 900, letterSpacing: 1, color: MUTED, marginBottom: 5 }}>WHY — THEY READ THIS</label>
                      <textarea id={`end-${s.id}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} placeholder="Why it is ending now, in a sentence." style={{ width: "100%", boxSizing: "border-box", background: "var(--bg)", border: `1.5px solid ${EL}`, borderRadius: 10, padding: "8px 10px", fontSize: 12, color: INK, fontFamily: "inherit", resize: "vertical" }} />
                      <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                        <button type="button" disabled={pending || reason.trim().length < 3} onClick={() => end(s)} style={{ ...btn("primary", "#EF4444"), opacity: reason.trim().length < 3 ? 0.5 : 1 }} aria-label={`Confirm ending ${who}'s subscription`}>
                          {pending ? "Ending…" : "End it now"}
                        </button>
                        <button type="button" onClick={() => { setEnding(null); setReason(""); }} style={btn("secondary", st.tone)}>Cancel</button>
                      </div>
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 6, lineHeight: 1.45 }}>
                        A sanction: access stops today, not at the period&apos;s end, and the mandate is cancelled so nothing more is charged.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => { setReason(""); setEnding(s.id); }} style={btn("danger", st.tone)} aria-label={`End ${who}'s subscription`}>
                        End now
                      </button>
                      {s.kind === "studio" && s.businessName ? (
                        <Link href={`/admin/businesses?q=${encodeURIComponent(s.businessName)}`} style={btn("secondary", st.tone)}>Open in Businesses</Link>
                      ) : (
                        <Link href={`/admin/accounts?q=${encodeURIComponent(s.userName)}`} style={btn("secondary", st.tone)}>Open in Accounts</Link>
                      )}
                    </div>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 10.5, color: MUTED, marginTop: 16, lineHeight: 1.55, borderTop: `1.5px solid ${EL}`, paddingTop: 12 }}>
        Renewals are raised by Cashfree on the mandate with a day&apos;s notice; a failed one is retried and the owner has
        three days of grace before the studio comes off Discover. A cancellation by the customer keeps what they paid
        for. Comp a period on Businesses or Accounts; change what a plan costs on Plans.
      </div>

    </div>
  );
}
