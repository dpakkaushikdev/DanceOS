"use client";

import { useState } from "react";

import { Portal } from "@/components/ui/Portal";
import { QRBlock } from "@/components/ui/QRBlock";
import { CENTER_CARD, CENTER_SCRIM } from "@/components/ui/centerModal";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";
import { SKY } from "@/lib/design/tokens";
import { qrMatrix } from "@/lib/qr/encode";
import { dosKey } from "./ShareSheet";

const DOS_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/** `QRBlock`'s own floor: three screen pixels a module, quiet zone included */
const PX_PER_MODULE = 3;
const QUIET = 4;

/** the smallest square this link can be drawn at and still scan (3 Oct 2026) */
function scannableSize(link: string): number {
  try {
    return Math.ceil((qrMatrix(link).size + QUIET * 2) * PX_PER_MODULE);
  } catch {
    return 124;
  }
}

/** SHARING IS PART OF THE DETAILS (29 Sep 2026, the user: "share should be part
 *  of the details with qr code with link and option to copy the link as well
 *  for the class").
 *
 *  It was behind the poster from 24 Aug — the poster opened a ticket that
 *  carried the art, an entry code AND the booking link, which is why pressing
 *  the poster did not show the poster. Here it is a block like every other
 *  block on the page: the code somebody points a camera at, the address in
 *  words for anybody reading over a shoulder, and two presses — copy it, or
 *  send it.
 *
 *  ⚠ A SHARE BUTTON BESIDE COPY LINK, AND A SMALLER CODE (3 Oct 2026, the user:
 *  "share button in class detail with copy link. smaller qr code in that
 *  section"). Share is the phone's own sheet (`navigator.share` — WhatsApp,
 *  Messages, Mail), the same as a profile's Share chip; a desktop browser has no
 *  such sheet, so it copies and says so rather than doing nothing.
 *
 *  ⚠ THE CODE IS DRAWN AT THE SMALLEST SIZE THAT STILL SCANS, computed from the
 *  link it encodes rather than typed — a live `/c/{slug}` is a version-4 code,
 *  41 modules with the quiet zone, so ~123px where it was a fixed 148. Any
 *  smaller and `QRBlock` would mark itself `data-qr-scannable="small"`, and the
 *  one thing this square exists for is a camera. It sits BESIDE the address and
 *  the two buttons now rather than above them, which is what makes the block
 *  compact.
 *
 *  ⚠ THE QR, THE COPY AND THE SHARE ENCODE THE SAME THING — the one `link` prop
 *  — so none of them can drift into pointing at a different class. */
/** ⚠⚠ TWO BUTTONS UNDER THE CARD, AND NO SHARE BLOCK AT THE FOOT (18 Oct 2026,
 *  the user: "class detail page share copy link and share class should be
 *  combined into 2 buttons below the card on class detail page instead of the
 *  bottom section"). **Copy link** copies at once; **Share class** opens the
 *  code in a sheet — the square somebody points a camera at, the address, and
 *  the phone's own share sheet one press further. The QR is kept (a door scans
 *  it), it is simply no longer a section of the page. */
export function ClassShareButtons({ link, title, col, fire }: { link: string; title: string; col: string; fire?: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useCloseOnBack(() => setOpen(false), open);
  const copy = () => {
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link);
    } catch {
      /* blocked — the sheet shows the address to copy by hand */
    }
    setCopied(true);
    fire?.("🔗 Link copied");
    setTimeout(() => setCopied(false), 1800);
  };
  const pill = (filled: boolean): React.CSSProperties => ({
    flex: "1 1 0",
    minWidth: 0,
    minHeight: 42,
    borderRadius: 999,
    border: filled ? "none" : `1.5px solid ${col}66`,
    background: filled ? col : `${col}14`,
    color: filled ? "#fff" : "var(--text)",
    fontWeight: 900,
    fontSize: 12.5,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    fontFamily: "inherit",
  });
  return (
    <>
      <div data-testid="class-share-buttons" style={{ display: "flex", gap: 8, margin: "10px 0 2px" }}>
        <button type="button" onClick={copy} aria-label="Copy the booking link" style={pill(false)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
            <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
          </svg>
          {copied ? "Copied ✓" : "Copy link"}
        </button>
        <button type="button" onClick={() => setOpen(true)} aria-label="Share class" style={pill(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="2.6" />
            <circle cx="6" cy="12" r="2.6" />
            <circle cx="18" cy="19" r="2.6" />
            <path d="M8.3 10.8 15.7 6.4M8.3 13.2l7.4 4.4" />
          </svg>
          Share class
        </button>
      </div>
      {/* ⚠ PORTALLED (18 Oct 2026): drawn in place, the scrim sat inside the
          class card's stacking context and the room tile below painted over
          its Done button — the 16 Sep lesson. A modal belongs at the root. */}
      {open ? (
        <Portal>
        <div onClick={() => setOpen(false)} style={CENTER_SCRIM}>
          <div role="dialog" aria-modal="true" aria-label={`Share ${title}`} onClick={(e) => e.stopPropagation()} style={{ ...CENTER_CARD, textAlign: "center", animation: "dosPopIn .3s cubic-bezier(.22,1.2,.36,1)" }}>
            <b style={{ fontSize: 17, display: "block", marginBottom: 12 }}>{title}</b>
            <ClassShare link={link} title={title} fire={fire} sheet />
            <button type="button" onClick={() => setOpen(false)} style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 999, background: "var(--card)", border: "1.5px solid var(--el)", color: "var(--text)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Done
            </button>
          </div>
        </div>
        </Portal>
      ) : null}
    </>
  );
}

export function ClassShare({
  link,
  title,
  fire,
  sheet = false,
}: {
  /** the full public address of this class — `{protocol}//{host}/c/{slug}` */
  link: string;
  title: string;
  fire?: (msg: string) => void;
  /** drawn inside `ClassShareButtons`' sheet: a bigger code, no second Copy (the button beside it is that) */
  sheet?: boolean;
}) {
  const [done, setDone] = useState(false);
  /* what a person reads is the address without its scheme — the scheme is
     noise on a phone, and the thing copied is still the whole URL */
  const shown = link.replace(/^https?:\/\//, "");
  const size = sheet ? Math.max(200, scannableSize(link)) : scannableSize(link);

  const copy = () => {
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link);
    } catch {
      /* clipboard blocked — the link is on screen to copy by hand */
    }
    setDone(true);
    fire?.("🔗 Link copied");
    setTimeout(() => setDone(false), 1800);
  };

  const share = async () => {
    /* the device's own sheet first; somebody dismissing it is not an error and
       must not fall through to a second, surprising action */
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: `${title} on DanceOS — book a spot`, url: link });
      } catch {
        /* dismissed */
      }
      return;
    }
    copy();
  };

  const btn = (active: boolean): React.CSSProperties => ({
    textAlign: "center",
    padding: "9px 10px",
    borderRadius: 999,
    background: "var(--solid)",
    border: "1.5px solid var(--el)",
    fontWeight: 800,
    fontSize: 12,
    color: active ? "#22C55E" : SKY,
    cursor: "pointer",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  });

  if (sheet) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ lineHeight: 0, padding: 8, borderRadius: 20, background: "#fff", boxShadow: "0 12px 30px rgba(0,0,0,.18)" }}>
          <QRBlock code={link} size={size} label={`Booking link for ${title}`} />
        </div>
        <div title={link} style={{ fontFamily: DOS_MONO, fontSize: 11, color: "var(--sub)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shown}
        </div>
        <div role="button" tabIndex={0} onKeyDown={dosKey} onClick={() => void share()} aria-label="Share the booking link" style={{ ...btn(false), width: "100%" }}>
          Send it to somebody
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
      <div style={{ lineHeight: 0, flexShrink: 0 }}>
        <QRBlock code={link} size={size} label={`Booking link for ${title}`} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ fontSize: 10.5, color: "var(--sub)", lineHeight: 1.35 }}>Anyone who opens this can book a spot.</div>
        <div
          title={link}
          style={{
            fontFamily: DOS_MONO,
            fontSize: 11,
            color: "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {shown}
        </div>
        <div role="button" tabIndex={0} onKeyDown={dosKey} onClick={copy} aria-label="Copy the booking link" style={btn(done)}>
          {done ? "Copied ✓" : "Copy link"}
        </div>
        <div role="button" tabIndex={0} onKeyDown={dosKey} onClick={() => void share()} aria-label="Share the booking link" style={btn(false)}>
          {/* the share mark every platform draws: a node joined to two others */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="2.6" />
            <circle cx="6" cy="12" r="2.6" />
            <circle cx="18" cy="19" r="2.6" />
            <path d="M8.3 10.8 15.7 6.4M8.3 13.2l7.4 4.4" />
          </svg>
          Share
        </div>
      </div>
    </div>
  );
}
