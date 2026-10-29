import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BeatText } from "@/components/ui/BeatText";
import { InvertedPanel } from "@/components/ui/InvertedPanel";
import { TopPanel } from "@/components/ui/TopPanel";
import { BoardsBrowser } from "@/features/stats/components/BoardsBrowser";
import { loadBoard, type BoardQuery } from "@/features/stats/server/loadBoard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DOS_UI, INK, TAB_TITLE } from "@/lib/design/tokens";

export const metadata: Metadata = { title: "Rankings — DanceOS" };

/** /rankings — DANCEOS'S BOARDS, AND NOTHING ABOUT YOU (29 Oct 2026, the user:
 *  "overall rankings should take to page with just browse the boards with proper
 *  heading on the page just to view overall rankings in dance os not your own").
 *  Pulse's Overall rankings opens it. Signed-in only, because `dance_chart` is
 *  (Step 25); the board's state is the address, as everywhere else. */
export default async function RankingsPage({ searchParams }: { searchParams: Promise<BoardQuery> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/rankings")}`);

  const board = await loadBoard(supabase, await searchParams, "dancer");
  const tint = "#7C3AED";

  return (
    <div style={{ background: "var(--bg)", color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "12px var(--dos-gutter) 40px", boxSizing: "border-box" }}>
      <TopPanel tint={tint}>
        <h1 data-testid="rankings-title" style={{ ...TAB_TITLE, color: INK, margin: 0 }}>
          <BeatText text="Rankings" />
        </h1>
        {/* no sub-heading (29 Oct 2026, the user: "no sub heading on rankings page which says everybody on dance os") */}
      </TopPanel>
      <InvertedPanel ground="page" style={{ marginTop: 12 }}>
        <BoardsBrowser chart={board.chart} segment={board.segment} metric={board.metric} city={board.city} cities={board.cities} basePath="/rankings" label="THE BOARDS" />
      </InvertedPanel>
    </div>
  );
}
