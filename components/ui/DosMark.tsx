"use client";

import { useId } from "react";

/** The DanceOS mark — lifted from prototype DosMark (DanceOSApp.jsx:1614-1628).
 *  One file since 3 Oct 2026, when the welcome screen began drawing it large in
 *  its middle (the user: "dance os logo on start screen page in the centre");
 *  the top bar draws the same one at 33px, so the two cannot drift. A client
 *  component only for `useId`, which keeps two marks on one page from sharing a
 *  gradient id. */
export function DosMark({ size = 28 }: { size?: number }) {
  const gid = `dm${useId()}`;
  const s = size;
  return (
    <span
      style={{
        display: "inline-flex",
        flexShrink: 0,
        lineHeight: 0,
        width: s,
        height: s,
        borderRadius: s * 0.3,
        alignItems: "center",
        justifyContent: "center",
        /* ⚠ NO PINK (18 Oct 2026, the user: "dont like that white and pink color")
           — the mark wears the wordmark's teal → amber → violet now */
        background: "linear-gradient(145deg,#0B1F1E,#081210)",
        boxShadow: "0 0 0 1px rgba(45,212,191,.32), 0 4px 14px rgba(251,191,36,.22)",
      }}
    >
      <svg width={s * 0.72} height={s * 0.72} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2DD4BF" />
            <stop offset=".55" stopColor="#FBBF24" />
            <stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        <path d="M24.8 7.2A12.4 12.4 0 1 0 27.5 20" stroke={`url(#${gid})`} strokeWidth="3.6" strokeLinecap="round" />
        <path d="M9.6 22.6a8 8 0 1 1 11.2-1.4" stroke={`url(#${gid})`} strokeWidth="3.2" strokeLinecap="round" opacity=".62" />
        <circle cx="26.4" cy="6.2" r="3.5" fill="#FBBF24" />
      </svg>
    </span>
  );
}
