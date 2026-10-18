import type { Metadata } from "next";
import { JobPracticeRoute } from "@/features/enquiries/components/JobPracticeRoute";

export const metadata: Metadata = { title: "Practice — DanceOS" };

/** a person's job practice — the page is `JobPracticeRoute`, shared with the
 *  studio's own address (`/business/{id}/practice/job/{id}`, 18 Oct 2026) */
export default async function JobPracticePage({ params }: { params: Promise<{ practiceId: string }> }) {
  const { practiceId } = await params;
  return <JobPracticeRoute practiceId={practiceId} />;
}
