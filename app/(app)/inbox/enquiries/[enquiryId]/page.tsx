import { EnquiryDetailRoute } from "@/features/enquiries/components/EnquiryDetailRoute";

/** One enquiry (prototype S_enqdetail) — the sender's, an artist page's and a
 *  crew's address. A studio's runner is sent on to the studio's own address
 *  (`/business/{id}/inbox/enquiries/{id}`, 18 Oct 2026) — see EnquiryDetailRoute.
 *  ⚠ `?paid=` is how /pay/return brings a phone back from the payment — read for
 *  the banner only; whether it was paid is the quote's own state. */
export default async function EnquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ enquiryId: string }>;
  searchParams: Promise<{ paid?: string; show?: string }>;
}) {
  const { enquiryId } = await params;
  const { paid, show } = await searchParams;
  return <EnquiryDetailRoute enquiryId={enquiryId} paid={paid} show={show} />;
}
