import type { Metadata } from "next";
import { JobPracticeRoute } from "@/features/enquiries/components/JobPracticeRoute";

export const metadata: Metadata = { title: "Practice — DanceOS" };

/** /business/{id}/practice/job/{id} — a studio's job practice under the studio's
 *  own address, so the profile switcher stays on the studio (18 Oct 2026) */
export default async function BusinessJobPracticePage({ params }: { params: Promise<{ businessId: string; practiceId: string }> }) {
  const { businessId, practiceId } = await params;
  return <JobPracticeRoute practiceId={practiceId} scope={businessId} />;
}
