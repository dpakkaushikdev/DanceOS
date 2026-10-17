"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";
import { DISC_RADIUS, DOS_UI, HERO_HEAD_H, HERO_HEAD_RADIUS, HERO_HEAD_W } from "@/lib/design/tokens";

/** A PICTURE, FULL SIZE (16 Sep 2026, the user: "show the header picture
 *  section as an image gallery where user can click over a picture and expand
 *  and see it").
 *
 *  ⚠⚠ RE-CUT 18 Oct 2026 (the user: "photos when viewing should have a better
 *  way, should be swipable, should appear bigger when clicked upon, should not
 *  have text below them"):
 *   · THE PICTURE FILLS THE SCREEN — as wide as the phone and as tall as the
 *     screen allows, where it was a framed 86vw card;
 *   · A FINGER SWIPES between pictures, the picture following the finger and
 *     springing back if the swipe was short; ‹ › and the arrow keys still page;
 *   · DOUBLE-TAP (or double-click) ZOOMS to 2.5× at the point tapped, and two
 *     fingers PINCH; while zoomed one finger moves the picture instead of
 *     paging, and a double-tap puts it back;
 *   · NO TEXT UNDER IT — "Picture 2 of 5" is gone; dots say where you are.
 *
 *  What does not move, and why (the history of this file, kept short):
 *   1. IT SHOWS THE CROP AND NOTHING ELSE (28 Sep 2026: "view the pic in the
 *      cropped way only") — the frame is the page's own: the banner's 3:2 or
 *      the round disc, covered.
 *   2. IT IS PORTALLED TO `document.body` — opened from inside `IdentityHero`'s
 *      stacking context (zIndex 3) it would otherwise sit under the top bar
 *      (400) whatever its own z-index says.
 *   3. `useCloseOnBack` — the system back gesture closes it.
 *   4. NEVER `aria-hidden` on the backdrop (the 24 Aug 2026 bottom-sheet bug). */

export interface LightboxShot {
  key: string;
  src: string | null;
  alt: string;
  /** a signed private-bucket URL must bypass the Next optimizer, which would
   *  re-fetch it server-side without the signature and get a 400 */
  signed: boolean;
}

const round: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  border: "1.5px solid rgba(255,255,255,.22)",
  background: "rgba(0,0,0,.45)",
  color: "#fff",
  fontSize: 18,
  lineHeight: 1,
  padding: 0,
  fontFamily: "inherit",
  backdropFilter: "blur(6px)",
};

const ZOOM = 2.5;
const MAX_ZOOM = 4;

export function PhotoLightbox({
  shots,
  index,
  onIndex,
  onClose,
  label,
  frame = "banner",
}: {
  shots: LightboxShot[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  label: string;
  /** the shape the PAGE draws this picture in, so the viewer shows the same crop.
   *  Defaults to the banner, which is every poster, header and proof photo; a
   *  profile picture passes "disc". */
  frame?: "banner" | "disc";
}) {
  useCloseOnBack(onClose);
  const many = shots.length > 1;
  const at = Math.min(Math.max(index, 0), Math.max(0, shots.length - 1));
  const shot = shots[at];
  /* which way the last page turn went, so the next picture slides in from that side */
  const [dir, setDir] = useState<1 | -1>(1);

  const step = useCallback(
    (by: 1 | -1) => {
      if (!many) return;
      setDir(by);
      onIndex((at + by + shots.length) % shots.length);
    },
    [at, many, onIndex, shots.length]
  );

  useEffect(() => {
    if (!many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [many, step]);

  /* the portal target is a browser object; this is only ever mounted from a press */
  if (!shot || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 700,
        background: "rgba(0,0,0,.94)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        animation: "dosFadeIn .18s ease",
        fontFamily: DOS_UI,
        touchAction: "none",
        overscrollBehavior: "contain",
      }}
    >
      <button type="button" aria-label="Close the picture" onClick={onClose} style={{ ...round, position: "absolute", top: "calc(14px + env(safe-area-inset-top, 0px))", right: 14, zIndex: 3 }}>
        ✕
      </button>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${label} — picture ${at + 1} of ${shots.length}`}
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}
      >
        {/* keyed per picture, so the zoom and the drag start fresh on every turn */}
        <Stage key={shot.key} shot={shot} frame={frame} dir={dir} many={many} onStep={step} onClose={onClose} />
        {many ? (
          <>
            <button type="button" aria-label="Previous picture" onClick={() => step(-1)} style={{ ...round, position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", zIndex: 2 }}>
              ‹
            </button>
            <button type="button" aria-label="Next picture" onClick={() => step(1)} style={{ ...round, position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", zIndex: 2 }}>
              ›
            </button>
          </>
        ) : null}
      </div>

      {/* where you are — dots, not words (18 Oct 2026) */}
      {many ? (
        <div aria-hidden="true" data-testid="lightbox-dots" style={{ position: "absolute", bottom: "calc(22px + env(safe-area-inset-bottom, 0px))", display: "flex", gap: 6 }}>
          {shots.map((s, i) => (
            <span key={s.key} style={{ width: i === at ? 18 : 6, height: 6, borderRadius: 3, background: i === at ? "#fff" : "rgba(255,255,255,.35)", transition: "width .2s ease" }} />
          ))}
        </div>
      ) : null}
    </div>,
    document.body
  );
}

type Pt = { x: number; y: number };

function Stage({
  shot,
  frame,
  dir,
  many,
  onStep,
  onClose,
}: {
  shot: LightboxShot;
  frame: "banner" | "disc";
  dir: 1 | -1;
  many: boolean;
  onStep: (by: 1 | -1) => void;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 });
  const [drag, setDrag] = useState<Pt>({ x: 0, y: 0 });
  const [live, setLive] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const g = useRef<{
    start: Pt;
    last: Pt;
    pinch: { d: number; s: number } | null;
    tapAt: number;
    moved: boolean;
  }>({ start: { x: 0, y: 0 }, last: { x: 0, y: 0 }, pinch: null, tapAt: 0, moved: false });

  const clampPan = (s: number, x: number, y: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return { x, y };
    const mx = ((s - 1) * r.width) / 2;
    const my = ((s - 1) * r.height) / 2;
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };

  /** double-tap: zoom in at the point tapped, or back out */
  const toggleZoom = (clientX: number, clientY: number) => {
    if (zoom.s > 1) {
      setZoom({ s: 1, x: 0, y: 0 });
      return;
    }
    const r = box.current?.getBoundingClientRect();
    if (!r) return setZoom({ s: ZOOM, x: 0, y: 0 });
    const cx = clientX - (r.left + r.width / 2);
    const cy = clientY - (r.top + r.height / 2);
    setZoom({ s: ZOOM, ...clampPan(ZOOM, -cx * (ZOOM - 1), -cy * (ZOOM - 1)) });
  };

  const dist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    const gg = g.current;
    if (e.touches.length === 2) {
      gg.pinch = { d: dist(e.touches), s: zoom.s };
      return;
    }
    const t = e.touches[0];
    gg.start = { x: t.clientX, y: t.clientY };
    gg.last = gg.start;
    gg.moved = false;
    setLive(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const gg = g.current;
    if (e.touches.length === 2 && gg.pinch) {
      const s = Math.max(1, Math.min(MAX_ZOOM, (gg.pinch.s * dist(e.touches)) / gg.pinch.d));
      setZoom((z) => ({ s, ...clampPan(s, z.x, z.y) }));
      gg.moved = true;
      return;
    }
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - gg.start.x;
    const dy = t.clientY - gg.start.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) gg.moved = true;
    if (zoom.s > 1) {
      /* zoomed: one finger moves the picture */
      const mx = t.clientX - gg.last.x;
      const my = t.clientY - gg.last.y;
      gg.last = { x: t.clientX, y: t.clientY };
      setZoom((z) => ({ s: z.s, ...clampPan(z.s, z.x + mx, z.y + my) }));
      return;
    }
    /* not zoomed: the picture follows the finger sideways (paging), or down (closing) */
    setDrag({ x: many ? dx : dx * 0.25, y: Math.abs(dy) > Math.abs(dx) && dy > 0 ? dy : 0 });
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const gg = g.current;
    if (gg.pinch) {
      if (e.touches.length === 0) gg.pinch = null;
      if (zoom.s < 1.05) setZoom({ s: 1, x: 0, y: 0 });
      return;
    }
    setLive(false);
    const { x, y } = drag;
    setDrag({ x: 0, y: 0 });
    if (zoom.s === 1) {
      if (many && x < -60) return onStep(1);
      if (many && x > 60) return onStep(-1);
      if (y > 110) return onClose();
    }
    if (!gg.moved) {
      const now = Date.now();
      const t = e.changedTouches[0];
      if (now - gg.tapAt < 300) {
        gg.tapAt = 0;
        toggleZoom(t.clientX, t.clientY);
      } else {
        gg.tapAt = now;
      }
    }
  };

  /* the size: as wide as the phone, as tall as the screen allows, in the page's own shape */
  const width =
    frame === "disc"
      ? "min(calc(100vw - 20px), calc(100dvh - 150px), 640px)"
      : `min(calc(100vw - 12px), calc((100dvh - 150px) * ${HERO_HEAD_W / HERO_HEAD_H}), 1100px)`;

  return (
    <div
      ref={box}
      data-testid="lightbox-stage"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={(e) => toggleZoom(e.clientX, e.clientY)}
      onWheel={(e) => {
        const s = Math.max(1, Math.min(MAX_ZOOM, zoom.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        setZoom((z) => (s === 1 ? { s: 1, x: 0, y: 0 } : { s, ...clampPan(s, z.x, z.y) }));
      }}
      style={{
        position: "relative",
        overflow: "hidden",
        width,
        aspectRatio: frame === "disc" ? "1 / 1" : `${HERO_HEAD_W} / ${HERO_HEAD_H}`,
        borderRadius: frame === "disc" ? `${DISC_RADIUS * 100}%` : HERO_HEAD_RADIUS,
        boxShadow: "0 24px 70px rgba(0,0,0,.6)",
        transform: `translate(${drag.x}px, ${drag.y}px) scale(${1 - Math.min(drag.y, 300) / 1500})`,
        opacity: 1 - Math.min(drag.y, 300) / 600,
        transition: live ? "none" : "transform .25s cubic-bezier(.2,.8,.2,1), opacity .25s ease",
        animation: `${dir === 1 ? "dosLbFromRight" : "dosLbFromLeft"} .28s cubic-bezier(.2,.8,.2,1)`,
        cursor: zoom.s > 1 ? "zoom-out" : "zoom-in",
        touchAction: "none",
      }}
    >
      {shot.src ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`,
            transition: live ? "none" : "transform .22s ease",
          }}
        >
          <Image src={shot.src} alt={shot.alt} fill sizes="100vw" unoptimized={shot.signed} draggable={false} style={{ objectFit: "cover", userSelect: "none" }} />
        </div>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, color: "rgba(255,255,255,.7)", fontSize: 12.5, textAlign: "center", background: "rgba(255,255,255,.05)" }}>
          This picture could not be loaded. Close and reopen the page to sign it again.
        </div>
      )}
    </div>
  );
}
