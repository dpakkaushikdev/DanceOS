import type { Tile } from "@/features/home/components/tool-grid";

/** A COUNT ON EVERY TOOL (18 Oct 2026, the user: "give notification with counts
 *  for all tools according to updates in the profile switcher bar").
 *
 *  Every notification already carries the address it opens (Step 24, regrouped
 *  by area on 11 Oct). So an unread one belongs to the tool whose address is the
 *  LONGEST prefix of its own — `/business/{id}/refunds` is that studio's, a
 *  class ask at `/my-classes?tab=todo` is the person's Classes — and one that
 *  points nowhere a tool does falls back to its AREA on the person's own row
 *  (class → Classes, team → Team, crew → Crews, money → Earnings). Enquiries
 *  and DanceOS notices are the Inbox's and the bell's, never a tool's. Each
 *  notification counts ONCE, on one tool. A pure module: the layout runs it,
 *  the drawer draws it. */

export interface UnreadNote {
  id: string;
  kind: string;
  href: string | null;
}

export interface BadgedItem {
  key: string;
  tiles?: (Tile & { count?: number; noteIds?: string[] })[];
  count?: number;
}

const pathOf = (href: string) => href.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";

const AREA_TOOL: Record<string, Tile["k"]> = { class: "classesmod", team: "team", crew: "crews", money: "earn" };

/** where a person-level address belongs when no tool's own address is a prefix */
const personToolOf = (href: string): Tile["k"] | null => {
  const path = pathOf(href);
  const query = href.includes("?") ? href.slice(href.indexOf("?")) : "";
  if (path === "/team" || (path === "/business" && /show=team/.test(query))) return "team";
  if (path === "/business") return "studios";
  if (path.startsWith("/c/")) return "classesmod";
  if (/^\/(invoices|refunds|payments|earnings)/.test(path)) return "earn";
  return null;
};

export function badgeSwitcher<T extends BadgedItem>(items: T[], notes: UnreadNote[]): T[] {
  const counts = new Map<string, string[]>(); // `${itemKey}|${tileK}` → ids
  const add = (itemKey: string, k: string, id: string) => {
    const key = `${itemKey}|${k}`;
    counts.set(key, [...(counts.get(key) ?? []), id]);
  };
  const me = items.find((i) => i.key === "me");
  for (const n of notes) {
    if (n.kind === "enquiry" || n.kind === "danceos") continue;
    const href = n.href ?? "";
    const path = href ? pathOf(href) : "";
    /* 1 · the tool whose address is the longest prefix of this one, on any row */
    let best: { item: string; k: string; len: number } | null = null;
    if (path) {
      for (const item of items) {
        for (const t of item.tiles ?? []) {
          const tp = pathOf(t.href);
          if (tp !== "/" && (path === tp || path.startsWith(`${tp}/`)) && (!best || tp.length > best.len)) best = { item: item.key, k: t.k, len: tp.length };
        }
      }
    }
    if (best) {
      add(best.item, best.k, n.id);
      continue;
    }
    /* 2 · a business's own address with no tool of its own → that business's row, by area */
    const biz = path.match(/^\/business\/([0-9a-f-]{36})/i)?.[1];
    const bizItem = biz ? items.find((i) => i.key === biz) : undefined;
    const areaK = AREA_TOOL[n.kind];
    if (bizItem && areaK && bizItem.tiles?.some((t) => t.k === areaK)) {
      add(bizItem.key, areaK, n.id);
      continue;
    }
    /* 3 · the person's own row, by the address, then by the area */
    if (!me) continue;
    const k = (href && personToolOf(href)) || areaK;
    if (k && me.tiles?.some((t) => t.k === k)) add(me.key, k, n.id);
  }
  return items.map((item) => {
    const tiles = (item.tiles ?? []).map((t) => {
      const ids = counts.get(`${item.key}|${t.k}`) ?? [];
      return ids.length ? { ...t, count: ids.length, noteIds: ids } : t;
    });
    const count = tiles.reduce((s, t) => s + ((t as { count?: number }).count ?? 0), 0);
    return { ...item, tiles, count };
  });
}
