"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { DragList } from "@/components/ui/DragList";
import { ToolGlyph, type Tile } from "@/features/home/components/tool-grid";
import { setToolOrderAction } from "@/features/home/server-actions/toolOrder";
import { arrangeTiles, orderOf } from "@/features/home/toolOrder";

/** THE DRAWER'S TOOLS, AND ARRANGING THEM (18 Oct 2026).
 *
 *  The user: *"arrange and reorder tools in profile switcher how we do for dance
 *  styles — do this by giving a arrange button with tools heading."* The tools
 *  left the home grid for the drawer on 12 Oct, and the Arrange control (C56)
 *  went with the grid; this puts it back where the tools are now.
 *
 *  ⚠ The order is the SAME stored order the grid used — `set_my_layout` under
 *  `tools:user` / `tools:artist` / `tools:studio:{id}` / `tools:crew:{id}` — and
 *  the layout already arranges the tiles on the server, so a refresh after Done
 *  is what brings the stored order back as the drawer's own props.
 *
 *  ⚠ The local order is DERIVED, not synced by an effect: it remembers the key
 *  order of the props it was made from (`base`), and stands only while the props
 *  still have that order. Once the refresh lands with the saved order the props
 *  win again — no effect, no flicker back to the old order in between.
 *
 *  ⚠ Every drop saves at once (optimistic, one whole order — the door is atomic);
 *  a refused save puts the list back and says so. Reset sends an EMPTY order,
 *  which is how the door FORGETS the key — the grid's own semantics. */
type DrawerTile = Tile & { count?: number; noteIds?: string[] };

export function DrawerTools({
  heading,
  layoutKey,
  tiles,
  renderLink,
}: {
  heading: string;
  /** which stored order this is, or null when it cannot be keyed (no arranging) */
  layoutKey: string | null;
  tiles: DrawerTile[];
  /** the normal-mode row, drawn by the chrome exactly as before */
  renderLink: (t: DrawerTile) => ReactNode;
}): ReactNode {
  const router = useRouter();
  const [arranging, setArranging] = useState(false);
  const [local, setLocal] = useState<{ base: string; keys: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sig = orderOf(tiles).join("|");
  const shown = local && local.base === sig ? arrangeTiles(tiles, local.keys) : tiles;

  const save = (keys: string[], prev: { base: string; keys: string[] } | null) => {
    if (!layoutKey) return;
    setErr(null);
    start(async () => {
      const res = await setToolOrderAction({ key: layoutKey, order: keys });
      if (res.error) {
        setLocal(prev);
        setErr("Could not save that order — try again.");
      }
    });
  };

  const onReorder = (next: DrawerTile[]) => {
    const prev = local;
    const keys = orderOf(next);
    setLocal({ base: sig, keys });
    save(keys, prev);
  };

  const reset = () => {
    if (!layoutKey) return;
    setErr(null);
    start(async () => {
      const res = await setToolOrderAction({ key: layoutKey, order: [] });
      if (res.error) setErr("Could not reset the order — try again.");
      else {
        setLocal(null);
        router.refresh();
      }
    });
  };

  const toggle = () => {
    if (arranging) {
      setArranging(false);
      router.refresh();
    } else {
      setErr(null);
      setArranging(true);
    }
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 6px 6px" }}>
        <div data-testid="drawer-tools-head" style={{ fontSize: 9.5, fontWeight: 900, letterSpacing: 1.2, color: "var(--muted)", textTransform: "uppercase" }}>
          {heading}
        </div>
        {layoutKey && tiles.length > 1 ? (
          <button
            type="button"
            data-testid="drawer-tools-arrange"
            aria-pressed={arranging}
            onClick={toggle}
            style={{
              background: arranging ? "var(--text)" : "transparent",
              color: arranging ? "var(--solid)" : "var(--text)",
              border: "1.5px solid var(--el)",
              borderRadius: 999,
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.2,
              cursor: "pointer",
              fontFamily: "inherit",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {arranging ? "Done" : "Arrange"}
          </button>
        ) : null}
      </div>

      {arranging ? (
        <div data-testid="drawer-tools-arranging" aria-label="Arrange tools" role="group">
          <DragList
            items={shown}
            keyOf={(t) => t.k}
            nameOf={(t) => t.name}
            gap={4}
            onReorder={onReorder}
            render={(t, grip, dragging) => (
              <div
                data-testid="drawer-tool-arrange-row"
                data-tool={t.k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "3px 0 3px 8px",
                  borderRadius: 14,
                  color: "var(--text)",
                  background: dragging ? "var(--card)" : "var(--el)",
                  border: "1.5px solid var(--el)",
                }}
              >
                <ToolGlyph k={t.k} c={t.c} size={34} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 900, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                {grip}
              </div>
            )}
          />
          {err ? (
            <p role="status" style={{ margin: "8px 6px 0", fontSize: 11, fontWeight: 800, color: "#F87171" }}>
              {err}
            </p>
          ) : null}
          <div style={{ display: "flex", padding: "8px 6px 0" }}>
            <button
              type="button"
              data-testid="drawer-tools-reset"
              onClick={reset}
              disabled={pending}
              style={{
                background: "transparent",
                border: "1.5px solid var(--el)",
                borderRadius: 999,
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: 900,
                color: "var(--text)",
                cursor: pending ? "default" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Reset to default
            </button>
          </div>
        </div>
      ) : (
        <nav aria-label="Tools" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {shown.map((t) => renderLink(t))}
        </nav>
      )}
    </>
  );
}
