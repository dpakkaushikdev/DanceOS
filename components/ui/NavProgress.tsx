"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** THE THIN LINE AT THE TOP (Batch 3, 28 Oct 2026). Home, the class page, the
 *  profiles, Memberships and Team showed nothing at all between a press and the
 *  next page, so a slow press read as a dead one. A `loading.tsx` per route is
 *  NOT the answer here: once a route streams, a `redirect()` or `notFound()`
 *  inside it goes out as a 200 (19 Sep 2026), and several of these pages rely on
 *  exactly those. So this draws a line the moment an in-app link to ANOTHER page
 *  is pressed, and takes it down when the pathname changes.
 *
 *  ⚠ The visibility is DERIVED (`from === pathname`), never cleared in an effect
 *  — this repo's lint forbids a setState in one. A link that only changes the
 *  query string draws nothing (it is the same page), and a 10 s failsafe takes
 *  the line down if a navigation is cancelled. */
export function NavProgress() {
  const pathname = usePathname();
  const [from, setFrom] = useState<string | null>(null);

  useEffect(() => {
    let failsafe: ReturnType<typeof setTimeout> | null = null;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      setFrom(location.pathname);
      if (failsafe) clearTimeout(failsafe);
      failsafe = setTimeout(() => setFrom(null), 10000);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (failsafe) clearTimeout(failsafe);
    };
  }, []);

  if (from === null || from !== pathname) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="nav-progress"
      style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, zIndex: 9998, overflow: "hidden", pointerEvents: "none" }}
    >
      <div style={{ height: "100%", width: "40%", background: "linear-gradient(90deg, #0EA5E9, #EC4899)", borderRadius: 3, animation: "dosNavProgress 1.1s ease-in-out infinite" }} />
    </div>
  );
}
