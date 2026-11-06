"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "@/components/ui/Toast";
import { setMyUpiIdAction, type UpiSaveOutcome } from "@/features/profiles/server-actions/profile";
import type { UpiForPaying } from "@/repositories/profiles";
import { bizBtn, bizCard, eyebrow } from "./settings-kit";

/** GET PAID BY UPI — the box where a person says the UPI id a studio may pay
 *  them on, IN SETTINGS → PAYMENTS (6 Nov 2026, the user: "i asked you to keep
 *  it in settings payment"). It lived in the contact sheet since 2 Nov — a
 *  dashed "＋ Contact buttons" chip, only in edit mode — where nobody looking
 *  to be paid would think to look. One home: the box is gone from there.
 *
 *  What the line under the box says is what Cashfree said about the id AS
 *  SAVED (`upi`, read through `upi_for_paying`): a green ✓ with the name the
 *  bank holds, or an amber Not verified. A box being edited says nothing
 *  until Save asks again — and an unverified id IS asked again on every Save,
 *  which is how the green appears the day Cashfree enables the check. The
 *  action's answer is also said in the toast. */
export function UpiPayoutCard({ upi }: { upi: UpiForPaying | null }) {
  const router = useRouter();
  const [value, setValue] = useState(upi?.upiId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const trimmed = value.trim();
  const unchanged = trimmed.toLowerCase() === (upi?.upiId ?? "");
  /* an unchanged id that is not verified may be re-asked; a verified one or an empty box has nothing to save */
  const canSave = !pending && (!unchanged || (Boolean(trimmed) && !upi?.verifiedAt));

  const save = () => {
    setError(null);
    start(async () => {
      const out = await setMyUpiIdAction({ upiId: trimmed || null });
      if (out.error) {
        setError(out.error);
        return;
      }
      toast(words(out.outcome));
      router.refresh();
    });
  };

  return (
    <>
      <div style={eyebrow}>GET PAID BY UPI</div>
      <div style={{ ...bizCard, padding: "13px 14px" }} data-testid="upi-payout-card">
        <div style={{ fontSize: 13, fontWeight: 800 }}>Your UPI id</div>
        <div style={{ fontSize: 11, color: "var(--sub)", lineHeight: 1.5, marginTop: 3 }}>So a studio can pay you from its UPI app. Only a studio paying you sees it.</div>
        <input
          aria-label="UPI id"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="name@bank"
          style={{ width: "100%", boxSizing: "border-box", marginTop: 10, background: "var(--el)", color: "var(--text)", border: "1.5px solid var(--el)", borderRadius: 12, padding: "11px 13px", fontSize: 14, outline: "none", fontFamily: "inherit" }}
        />
        {/* what the bank said about the id as saved — only while the box still holds it */}
        {upi && trimmed.toLowerCase() === upi.upiId ? (
          upi.verifiedAt ? (
            <div data-testid="upi-verified" style={{ marginTop: 9, fontSize: 11.5, fontWeight: 800, color: "#22C55E", lineHeight: 1.45 }}>
              ✓ Verified{upi.nameAtBank ? <span style={{ color: "var(--text)", fontWeight: 700 }}> · the bank has it as {upi.nameAtBank}</span> : null}
            </div>
          ) : (
            <div data-testid="upi-unverified" style={{ marginTop: 9, fontSize: 11.5, fontWeight: 800, color: "#F59E0B", lineHeight: 1.45 }}>
              Not verified — a studio paying you will see your name in their UPI app
            </div>
          )
        ) : null}
        {error ? (
          <div role="alert" style={{ marginTop: 9, fontSize: 11.5, fontWeight: 800, color: "#F87171", lineHeight: 1.45 }}>
            {error}
          </div>
        ) : null}
        <button type="button" onClick={save} disabled={!canSave} data-testid="upi-save" style={{ ...bizBtn, marginTop: 11, width: "100%", opacity: canSave ? 1 : 0.45, cursor: canSave ? "pointer" : "default" }}>
          {pending ? "Checking with the bank…" : upi?.upiId && !trimmed ? "Remove UPI id" : upi?.upiId && unchanged && !upi.verifiedAt ? "Check again" : "Save UPI id"}
        </button>
      </div>
    </>
  );
}

/** the toast after a save — the action's outcome in one line */
function words(outcome: UpiSaveOutcome | null): string {
  if (!outcome) return "UPI id saved";
  if (outcome.state === "cleared") return "UPI id removed";
  if (outcome.state === "verified") return `UPI id verified${outcome.nameAtBank ? ` — the bank has it as ${outcome.nameAtBank}` : ""}`;
  return `UPI id saved, not verified: ${outcome.reason}`;
}
