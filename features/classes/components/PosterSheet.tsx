"use client";

import { useState } from "react";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";
import { DOS_DISPLAY, DOS_UI } from "@/lib/design/tokens";
import { PosterBlock, type PosterItem } from "./poster";
import { BTN_RESET_BLOCK } from "@/components/ui/buttonReset";

/** THE POSTER, OPENED — and nothing else on it (29 Sep 2026, the user: "when
 *  clicking on the poster right now we get poster and a qr code for the class
 *  which should not happen — should just open poster in that").
 *
 *  Pressing the poster used to open `PassSheet`: the art, a torn edge, a QR and
 *  an entry code. That sheet carried three jobs at once because on 24 Aug the
 *  poster became the one control for all three ("one place instead of three",
 *  prototype 12001) — and the cost was that the obvious act, *look at the
 *  poster*, was the one thing it did not do. Sharing is a block in the details
 *  now and entry is the person's own profile code, so this sheet has one job.
 *
 *  ⚠ It takes the whole `PosterItem`, so an UPLOADED poster opens as the
 *  picture it is — `PassSheet` typed its own narrower shape and silently drew
 *  the drawn design over somebody's photograph. */
export function PosterSheet({
  posterItem,
  posterK,
  col,
  title,
  styleName,
  levelWord,
  onClose,
}: {
  posterItem: PosterItem;
  posterK: string;
  col: string;
  title: string;
  styleName: string;
  levelWord: string;
  onClose: () => void;
}) {
  useCloseOnBack(onClose);
  /* ⚠ AS BIG AS THE PHONE ALLOWS (18 Oct 2026, the user: "poster should be
     bigger in this view"). The sheet only ever mounts from a press, so the
     window is there to measure; room is kept for the two text lines and Done. */
  const [size] = useState(() =>
    typeof window === "undefined"
      ? 340
      : Math.max(240, Math.min(window.innerWidth - 32, window.innerHeight - 190, 620)),
  );
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 640,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Poster for ${title}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: size,
          boxSizing: "border-box",
          textAlign: "center",
          fontFamily: DOS_UI,
          color: "#fff",
        }}
      >
        {/* ⚠ THE STYLE ONCE AND THE LEVEL ONCE (18 Oct 2026). A class's title
            IS "{style} · {level}" (17 Sep 2026), so the old pill + title +
            sub-line printed the style three times and the level twice. Now:
            the art, then the style, then the level — nothing repeated. */}
        <div style={{ display: "inline-block", lineHeight: 0 }}>
          <span
            style={{
              display: "block",
              lineHeight: 0,
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: `0 24px 70px rgba(0,0,0,.8), 0 0 0 2px ${col}55`,
            }}
          >
            <PosterBlock item={posterItem} design={posterK} size={size} />
          </span>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: -0.6,
            fontFamily: DOS_DISPLAY,
            marginTop: 14,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {styleName || title}
        </div>
        {levelWord && (
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,.66)", marginTop: 3 }}>
            {levelWord}
          </div>
        )}
        <button type="button"
          onClick={onClose}
          style={{ ...BTN_RESET_BLOCK, ...({
            marginTop: 18,
            textAlign: "center",
            padding: "12px",
            borderRadius: 999,
            background: "#fff",
            color: "#0A0A0A",
            fontWeight: 900,
            fontSize: 12.5,
            cursor: "pointer",
          }) }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
