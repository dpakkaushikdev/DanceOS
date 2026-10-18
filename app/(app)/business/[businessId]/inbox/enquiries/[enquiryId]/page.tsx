import { EnquiryDetailRoute } from "@/features/enquiries/components/EnquiryDetailRoute";

/** A studio's enquiry at the studio's own address (18 Oct 2026), so the profile
 *  switcher stays on the studio. Not found unless the enquiry is THIS studio's and
 *  the viewer runs it (owner or manager) and is not its sender. */
export default async function BusinessEnquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string; enquiryId: string }>;
  searchParams: Promise<{ paid?: string; show?: string }>;
}) {
  const { businessId, enquiryId } = await params;
  const { paid, show } = await searchParams;
  return <EnquiryDetailRoute enquiryId={enquiryId} paid={paid} show={show} scope={businessId} />;
}
