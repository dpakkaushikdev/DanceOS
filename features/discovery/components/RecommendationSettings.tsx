"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Portal } from "@/components/ui/Portal";
import { StylesSheet } from "@/features/profiles/components/StylesSheet";
import { setMyLearnStylesAction } from "@/features/profiles/server-actions/profile";
import { CARD, INK, LINE } from "@/lib/design/tokens";

/** RECOMMENDATION SETTINGS (11 Oct 2026). The user: *"discover should get a
 *  setting icon on top right with option to change the dance styles you want to
 *  learn should be called recommendation settings."*
 *
 *  The list is the one onboarding's "Styles you want to learn" step writes —
 *  `profiles.learn_styles`, private to its owner — and Discover puts whatever is
 *  in those styles first on every shelf (`recommendFirst`). It has no floor:
 *  empty means "recommend nothing", so every Remove is live.
 *
 *  ⚠ Every press saves at once and the sheet keeps its own copy, so the order a
 *  drag leaves is what you see while the round trip is out; a refusal puts the
 *  previous list back and says so. ⚠ The sheet is PORTALLED — Discover's head is
 *  a `TopPanel`, and a fixed child of an animated panel is clipped by it (the
 *  16 Sep stacking-context lesson). */
export function RecommendationSettings({ initial }: { initial: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [styles, setStyles] = useState<string[]>(initial);
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<string | null>(null);

  const save = (next: string[], words: string) => {
    const before = styles;
    setStyles(next);
    start(async () => {
      const res = await setMyLearnStylesAction({ styles: next });
      if (res.error) {
        setStyles(before);
        setSaid(res.error);
        return;
      }
      setSaid(words);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        data-testid="recommendation-settings"
        aria-label="Recommendation settings"
        title="Recommendation settings"
        onClick={() => {
          setSaid(null);
          setOpen(true);
        }}
        /* a GEAR, the app's settings mark (18 Oct 2026, the user: "discover dance
           style recommendation button should look like settings icon") */
        style={{ width: 40, height: 40, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: CARD, border: `1.5px solid ${LINE}`, color: INK, cursor: "pointer", flexShrink: 0 }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open ? (
        <Portal>
          <StylesSheet
            styles={styles}
            onSave={save}
            pending={pending}
            lastWords=""
            allowEmpty
            label="Recommendation settings"
            title="Recommendation settings"
            onClose={() => setOpen(false)}
          />
          {said ? (
            <div role="status" style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 700, background: "var(--text)", color: "var(--solid)", padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, pointerEvents: "none" }}>
              {said}
            </div>
          ) : null}
        </Portal>
      ) : null}
    </>
  );
}
