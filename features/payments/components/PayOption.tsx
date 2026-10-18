"use client";

import type { CSSProperties, ReactNode } from "react";

/** ONE WAY TO PAY, ONE SHAPE (18 Oct 2026). Every row on "How are you paying?" —
 *  a membership or UPI · Card · Netbanking — is this card, so no option is
 *  bigger or louder than another: a 40px mark in the option's colour, a title,
 *  one short line, and an optional bar (what is left on a pass). */

export const PAY_LABEL: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.9,
  color: "var(--muted)",
  margin: "0 0 6px 2px",
};

export function PayOption({
  testId,
  tint,
  icon,
  title,
  sub,
  ariaLabel,
  disabled = false,
  meter,
  onPick,
}: {
  testId?: string;
  tint: string;
  icon: ReactNode;
  title: string;
  sub: string;
  ariaLabel: string;
  disabled?: boolean;
  /** 0–100, drawn as a thin bar under the line */
  meter?: number;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={disabled ? undefined : onPick}
      style={{
        width: "100%",
        /* one height for every option, the bar or not — measured: a pass with its bar is 75px */
        minHeight: 76,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 13px",
        marginBottom: 8,
        borderRadius: 16,
        border: "1.5px solid var(--el)",
        background: "var(--card)",
        color: "var(--text)",
        textAlign: "left",
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        boxSizing: "border-box",
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: tint, color: "#fff", boxShadow: `0 5px 12px ${tint}44` }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "block" }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--sub)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
        {meter != null ? (
          <span style={{ display: "block", position: "relative", height: 4, borderRadius: 999, background: "var(--el)", marginTop: 6, overflow: "hidden" }}>
            <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, meter))}%`, background: tint, borderRadius: 999 }} />
          </span>
        ) : null}
      </span>
      <span aria-hidden="true" style={{ flexShrink: 0, color: "var(--muted)", fontSize: 18 }}>›</span>
    </button>
  );
}
