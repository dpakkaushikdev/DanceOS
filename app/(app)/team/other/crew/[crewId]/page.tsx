import { notFound, redirect } from "next/navigation";
import { OtherCrewDetail, type OtherCrewShow } from "@/features/staff/components/OtherTeamDetail";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findCrewMembers, findMyMemberCrews } from "@/repositories/crews";
import { findMyCrewPractices, findMyPracticeCheckIns } from "@/repositories/crewPractices";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* the clock, stamped once outside render (react-hooks/purity) */
const stampNow = (): number => Date.now();

/** YOUR WORK WITH A CREW YOU ARE IN (19 Oct 2026). `?show=practices|stats`.
 *
 *  ⚠ A CONFIRMED, NON-LEADING seat is re-checked here — a URL is a request, never
 *  an authority; a crew you lead is your own desk, not "somebody else's team".
 *  No `loading.tsx`: a redirect inside a streamed boundary goes out as a 200. */
export default async function OtherCrewRoute({
  params,
  searchParams,
}: {
  params: Promise<{ crewId: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const [{ crewId }, { show: asked }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(crewId)) {
    notFound();
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const crew = (await findMyMemberCrews(supabase).catch(() => [])).find((c) => c.id === crewId);
  if (!crew) {
    redirect("/team?show=other");
  }

  const [members, all] = await Promise.all([findCrewMembers(supabase, crewId).catch(() => []), findMyCrewPractices(supabase, {})]);
  const mine = members.find((m) => m.userId === user.id && m.status === "confirmed");
  /* `my_crew_practices` is every crew the caller is on — this crew's, said out loud */
  const practices = all.filter((p) => p.crewId === crewId);
  const checkedIn = await findMyPracticeCheckIns(supabase, user.id, practices.map((p) => p.id)).catch(() => new Set<string>());
  const show: OtherCrewShow = asked === "stats" ? "stats" : "practices";

  return <OtherCrewDetail crew={crew} role={mine?.role ?? "member"} since={crew.since} practices={practices} checkedIn={checkedIn} now={stampNow()} show={show} />;
}
