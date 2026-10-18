import { notFound, redirect } from "next/navigation";
import { DeskHero, DOS_TOOLS } from "@/features/businesses/components/biz-kit";
import { RentReceivedList } from "@/features/staff/components/RentReceivedList";
import { ToolCard, ToolHead } from "@/components/ui/ToolCard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyMemberships } from "@/repositories/businesses";
import { findClassesHeldByRenter, findRenters, findRentReceivedByPerson } from "@/repositories/rent";
import { findDisputesFor, latestByTarget } from "@/repositories/disputes";
import { DOS_UI, INK, LILAC } from "@/lib/design/tokens";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* the clock, stamped once outside render (react-hooks/purity) */
const stampNowIso = (): string => new Date().toISOString();

/** ONE ARTIST PAGE THAT RENTS THIS STUDIO'S ROOMS, AND IS NOT ON ITS TEAM (19 Oct
 *  2026, the user: "rent received in studio should also be handled inside the
 *  person whom it is received from"). The classes it holds here, then every rent
 *  payment and the total — the Team desk's Rent received line opens this.
 *
 *  ⚠ THE OWNER'S ALONE, re-checked here (money is the owner's — R79). No
 *  `loading.tsx`: a redirect inside a streamed boundary goes out as a 200. */
export default async function RenterRoute({ params }: { params: Promise<{ businessId: string; payerBusinessId: string }> }) {
  const { businessId, payerBusinessId } = await params;
  if (!UUID_RE.test(businessId) || !UUID_RE.test(payerBusinessId)) {
    notFound();
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const seat = (await findMyMemberships(supabase)).find((m) => m.business.id === businessId);
  if (!seat || seat.memberRole !== "owner" || seat.business.type !== "studio") {
    redirect(`/business/${businessId}/staff`);
  }

  const [payments, classes] = await Promise.all([
    findRentReceivedByPerson(supabase, businessId).then((all) => all.filter((p) => p.payerBusinessId === payerBusinessId)),
    findClassesHeldByRenter(supabase, businessId, payerBusinessId, stampNowIso()).catch(() => []),
  ]);
  if (payments.length === 0 && classes.length === 0) {
    notFound();
  }
  const renter = (await findRenters(supabase, businessId).catch(() => [])).find((r) => r.payerBusinessId === payerBusinessId);
  const payerName = payments[0]?.payerName ?? renter?.payerName ?? "An artist";
  const disputes = Object.fromEntries(latestByTarget(await findDisputesFor(supabase, { rentPaymentIds: payments.map((p) => p.id) })));

  return (
    <div data-testid="renter-detail" style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "14px var(--dos-gutter) 40px", boxSizing: "border-box" }}>
      <DeskHero tool="rooms" as="h1" margin="0 0 12px" toggle={false} />
      <ToolCard testId="renter-card">
        <ToolHead
          tint={DOS_TOOLS.rooms.c}
          name={renter?.ownerName ?? payerName}
          photoPath={renter?.photoPath ?? null}
          href={renter?.ownerUserId ? `/person/${renter.ownerUserId}` : undefined}
          hrefLabel={renter?.ownerUserId ? `${renter?.ownerName ?? payerName} — their profile` : undefined}
          eyebrow="ARTIST · RENTS YOUR ROOMS"
          sub={renter?.ownerName && renter.ownerName !== payerName ? payerName : null}
          size={64}
        />
      </ToolCard>
      <RentReceivedList payments={payments} payerName={payerName} disputes={disputes} classes={classes} />
    </div>
  );
}
