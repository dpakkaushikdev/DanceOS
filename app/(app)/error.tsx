"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DOS_DISPLAY, INK, SUB } from "@/lib/design/tokens";

/** "TRY AGAIN" (Batch 3, 28 Oct 2026). Until today a page that threw showed
 *  Next's own grey "Application error" with nothing to press. This sits inside
 *  the signed-in chrome, so the top bar and the tab bar stay; it says one plain
 *  sentence and offers the two ways on — this page again, or Discover.
 *  ⚠ An error boundary changes no HTTP status (unlike a loading boundary, which
 *  turns a redirect into a 200 — 19 Sep 2026), which is why this is safe here. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" style={{ padding: "48px var(--dos-gutter, 10px) 24px", textAlign: "center" }}>
      <div style={{ fontFamily: DOS_DISPLAY, fontSize: 22, fontWeight: 900, color: INK, letterSpacing: -0.4 }}>This page didn&apos;t load</div>
      <div style={{ fontSize: 13, color: SUB, fontWeight: 600, marginTop: 8, lineHeight: 1.45 }}>Check your connection and try again.</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
        <button
          type="button"
          onClick={() => retry()}
          style={{ height: 44, padding: "0 22px", borderRadius: 999, border: "none", background: "var(--text)", color: "var(--solid)", fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}
        >
          Try again
        </button>
        <Link
          href="/discover"
          style={{ height: 44, padding: "0 22px", borderRadius: 999, border: "1.5px solid var(--el)", color: INK, fontSize: 14, fontWeight: 800, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
        >
          Go to Discover
        </Link>
      </div>
    </div>
  );
}
