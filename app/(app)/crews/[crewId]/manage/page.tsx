import { redirect } from "next/navigation";
import { requireLedCrew } from "@/features/crews/server/requireLedCrew";

/** /crews/{crewId}/manage — AN ADDRESS NOW, NOT A PAGE (28 Oct 2026).
 *
 *  It was the crew's home (18 Sep 2026). The user: *"home and public profile are
 *  exactly the same so can combine these pages with edit only visible to the
 *  person who owns the page"* — so the leader's own page is `/crew/{id}`, and this
 *  forwards there (Rule 14: the hub, the Inbox, notifications and bookmarks all
 *  named it). `?edit=1` rides along. The desks under `/manage/…` are unchanged.
 *  ⚠ `requireLedCrew` still runs first, so a member is still sent to the public
 *  page and a stranger to sign-in — exactly as before. */
export default async function CrewManageAddress({ params, searchParams }: { params: Promise<{ crewId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { crewId } = await params;
  const sp = await searchParams;
  await requireLedCrew(crewId);
  const q = new URLSearchParams();
  if (sp.edit === "1") q.set("edit", "1");
  if (sp.welcome) q.set("welcome", sp.welcome);
  redirect(`/crew/${crewId}${q.size > 0 ? `?${q.toString()}` : ""}`);
}
