"use client";

import { useEffect, useRef, useState } from "react";
import type { WelcomeClip } from "@/features/auth/welcomeClips";
import { DOS_DISPLAY, SKY } from "@/lib/design/tokens";

const DARK = "#0A0A0A";

/** THE REEL — three clips, one after another, under a caption and three
 *  progress bars (28 Oct 2026, built to the user's Cult screenshot).
 *
 *  One `<video>` at a time, remounted per clip so its fade-in plays again;
 *  the NEXT clip warms up in a hidden element so the switch does not wait on
 *  the network. The bars print where the reel is: done ones full, the one
 *  playing filling with the clip's own time, the rest empty. Muted and inline,
 *  which is the only way a phone autoplays. If autoplay is refused all the same
 *  (a low-power mode, a browser setting) or motion is reduced, the still stays
 *  and nothing cycles — the screen reads the same.
 *
 *  THE BLEND is the gradient over the clip's lower half: clear at the top so
 *  the picture is the picture, the app's dark by the bottom so the sign-in
 *  below sits on one colour. */
export function WelcomeReel({ clips }: { clips: readonly WelcomeClip[] }) {
  const [at, setAt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [still, setStill] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || still) return;
    /* reduced motion: the still stays, nothing cycles — paused before the first
       frame moves, and `ended` never fires so the reel never advances */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }
    const played = video.play();
    if (played) played.catch(() => setStill(true));
  }, [at, still]);

  const clip = clips[at] ?? clips[0];
  const next = clips[(at + 1) % clips.length];
  const advance = () => setAt((i) => (i + 1) % clips.length);

  return (
    <>
      <video
        key={at}
        ref={videoRef}
        src={clip.src}
        poster={clip.poster}
        muted
        playsInline
        autoPlay={!still}
        preload="auto"
        aria-hidden="true"
        onPlay={() => setProgress(0)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration > 0) setProgress(v.currentTime / v.duration);
        }}
        onEnded={advance}
        /* a missing or broken file skips to the next rather than freezing the reel */
        onError={clips.length > 1 ? advance : undefined}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", animation: "dosReelIn .6s ease both" }}
      />
      {!still && clips.length > 1 ? <video src={next.src} preload="auto" muted playsInline aria-hidden="true" style={{ display: "none" }} /> : null}

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to bottom, rgba(10,10,10,.42) 0%, rgba(10,10,10,0) 20%, rgba(10,10,10,0) 48%, rgba(10,10,10,.82) 76%, ${DARK} 100%)`,
        }}
      />

      <div style={{ position: "absolute", left: 22, right: 22, bottom: 16, textAlign: "center" }}>
        <p
          key={`caption-${at}`}
          data-testid="welcome-caption"
          style={{ margin: 0, fontSize: 23, fontWeight: 900, lineHeight: 1.25, letterSpacing: -0.4, fontFamily: DOS_DISPLAY, color: "#FAFAFA", textShadow: "0 2px 18px rgba(0,0,0,.55)", animation: "dosRise .6s ease both" }}
        >
          {clip.line1}
          <br />
          <span style={{ color: SKY }}>{clip.line2}</span>
        </p>
        <div aria-hidden="true" style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
          {clips.map((_, i) => (
            <span key={i} style={{ width: 30, height: 3, borderRadius: 2, background: "rgba(255,255,255,.28)", overflow: "hidden" }}>
              <span
                style={{
                  display: "block",
                  height: "100%",
                  background: "#FAFAFA",
                  width: i < at ? "100%" : i === at ? `${Math.round(progress * 100)}%` : "0%",
                  transition: i === at ? "width .25s linear" : "none",
                }}
              />
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
