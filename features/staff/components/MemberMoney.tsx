"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DeleteIconButton } from "@/components/ui/DeleteIconButton";
import { toolBtn } from "@/components/ui/ToolCard";
import { voidPayoutAction } from "@/features/payouts/server-actions/payouts";
import { TeamPaySheet } from "./TeamPaySheet";
import { sessionDayLabel } from "@/lib/format/session";
import { INK, MUTED, SUB } from "@/lib/design/tokens";
import type { PersonPayLedger } from "@/types/payout";

/** THE MEMBER DETAIL PAGE'S TWO MONEY CONTROLS (19 Oct 2026, the user: "handle
 *  team detail pages better with everything inside that … everything will be
 *  managed from there under right columns").
 *
 *  `MemberToSettle` is the To settle column: what this person taught or worked on
 *  that no payment covers yet, listed ONCE (the Paid column's NOT SETTLED YET fold
 *  points here rather than listing it again), and the Team desk card's own Pay
 *  sheet behind one button. `VoidPayment` sits on a payment in the Paid column. */

const panel: React.CSSProperties = { background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 18, padding: "13px 14px", marginBottom: 12 };
const head: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 1, color: MUTED };

export function MemberToSettle({
  businessId,
  person,
  ledger,
  tint,
}: {
  businessId: string;
  person: { userId: string; name: string; avatarPath: string | null };
  ledger: Pick<PersonPayLedger, "unpaid" | "unpaidEnquiries"> | null;
  tint: string;
}) {
  const router = useRouter();
  /* ⚠ THE TEAM CARD'S PAY LANDS HERE (19 Oct 2026, the user: "cards on team should
     have pay button but first should take you inside detail page"): the card links
     to this column with `pay=1`, and the sheet opens over the person's own page —
     so the money is still only ever shown inside Member Detail. */
  const params = useSearchParams();
  const [open, setOpen] = useState(() => params.get("pay") === "1");
  const [msg, setMsg] = useState<string | null>(null);
  /* take `pay=1` back off the address once the sheet closes, so a reload does not
     re-open it — a plain replaceState, never a router hop (19 Sep: a back() racing
     the router) */
  const dropPayParam = () => {
    const u = new URL(window.location.href);
    if (!u.searchParams.has("pay")) return;
    u.searchParams.delete("pay");
    window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}`);
  };
  const sessions = ledger?.unpaid ?? [];
  const enquiries = ledger?.unpaidEnquiries ?? [];
  const n = sessions.length + enquiries.length;
  return (
    <div data-testid="member-to-settle">
      <div style={panel}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: n ? 8 : 0 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ ...head, display: "block" }}>NOT SETTLED YET · {n}</span>
            <span style={{ display: "block", fontSize: 10.5, color: SUB, marginTop: 2 }}>What each is worth is set when you pay.</span>
          </span>
          <button type="button" onClick={() => setOpen(true)} aria-label={`Pay ${person.name} from their page`} data-testid="member-pay" style={toolBtn("primary", tint)}>
            Pay
          </button>
        </div>
        {n === 0 ? (
          <div style={{ fontSize: 11.5, color: SUB }}>Every session is settled.</div>
        ) : (
          <>
            {sessions.map((s) => (
              <div key={s.sessionId} data-testid="team-to-settle-entry" style={{ display: "flex", gap: 10, padding: "5px 0", borderTop: "1.5px solid var(--el)" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.classTitle}</span>
                <span style={{ flexShrink: 0, fontSize: 11, color: SUB }}>{sessionDayLabel(s.startsAt)}</span>
              </div>
            ))}
            {enquiries.map((e) => (
              <div key={e.enquiryId} data-testid="team-to-settle-entry" style={{ display: "flex", gap: 10, padding: "5px 0", borderTop: "1.5px solid var(--el)" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</span>
                <span style={{ flexShrink: 0, fontSize: 11, color: SUB }}>{e.role ? `As ${e.role}` : "On the team"}</span>
              </div>
            ))}
          </>
        )}
      </div>
      {msg ? (
        <div role="status" style={{ fontSize: 12, fontWeight: 800, color: INK, padding: "0 4px 10px" }}>
          {msg}
        </div>
      ) : null}
      {open ? (
        <TeamPaySheet
          businessId={businessId}
          person={person}
          ledger={ledger}
          tint={tint}
          onClose={() => {
            setOpen(false);
            setTimeout(dropPayParam, 0);
          }}
          onDone={(words) => {
            setOpen(false);
            setTimeout(dropPayParam, 0);
            setMsg(words);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

export function VoidPayment({ payoutId, amountWords }: { payoutId: string; amountWords: string }) {
  const router = useRouter();
  return (
    <DeleteIconButton
      label={`Void the ${amountWords} payment`}
      word="Void"
      title={`Void this ${amountWords} payment?`}
      body="It comes off the ledger and the sessions it covered are back under To settle."
      goWord="Void"
      testId="team-payment-void"
      onConfirm={async () => {
        const out = await voidPayoutAction({ payoutId });
        if (out.error) return out.error;
        router.refresh();
      }}
    />
  );
}
