import { redirect } from "next/navigation";
import { CrewForm } from "@/features/crews/components/CrewForm";
import { CrewsHub } from "@/features/crews/components/CrewsHub";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyLedCrews } from "@/repositories/crews";
import { findProfileById } from "@/repositories/profiles";

/** The Crews hub — the crews you LEAD (18 Oct 2026). The crews you dance in and
 *  the asks to join one moved to Teams › Other Teams with the studio and artist
 *  teams (the user: "crew team and studio team should all be managed within
 *  teams"); the Member column's address forwards there (Rule 14).
 *
 *  ⚠ Practices left this hub on 29 Sep 2026 for its own tile at `/practice`. */
export default async function CrewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (sp.show === "in") redirect("/team");
  const opening = sp.new === "1";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const led = await findMyLedCrews(supabase);
  /* ⚠ THE ONE READ THE FORM NEEDS IS MADE ONLY WHEN THE FORM IS ASKED FOR
     (22 Sep 2026) — behind `?new=1` it costs a round trip on the press and
     nothing on every other visit. */
  const profile = opening ? await findProfileById(supabase, user.id).catch(() => null) : null;
  return (
    <>
      <CrewsHub led={led} />
      {opening && profile ? <CrewForm defaultCity={profile.city} sheet /> : null}
    </>
  );
}
