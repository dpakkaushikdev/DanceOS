import { notFound, redirect } from "next/navigation";
import { DeskHero } from "@/features/businesses/components/biz-kit";
import { RentReceivedList } from "@/features/staff/components/RentReceivedList";
import { FigureHead } from "@/components/ui/FigureHead";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMyMemberships } from "@/repositories/businesses";
import { findClassesHeldByRenter, findRentReceivedByPerson } from "@/repositories/rent";
import { findDisputesFor, latestByTarget } from "@/repositories/disputes";
import { DOS_UI, INK, LILAC, MUTED, SUB } from "@/lib/design/tokens";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* the clock, stamped once outside render (react-hooks/purity) */
const stampNowIso = (): string => new Date().toISOString();
const dateWords = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

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
  const payerName = payments[0]?.payerName ?? "An artist";
  const disputes = Object.fromEntries(latestByTarget(await findDisputesFor(supabase, { rentPaymentIds: payments.map((p) => p.id) })));
  const head: React.CSSProperties = { fontSize: 10, fontWeight: 900, letterSpacing: 1, color: MUTED };

  return (
    <div data-testid="renter-detail" style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "14px var(--dos-gutter) 40px", boxSizing: "border-box" }}>
      <DeskHero tool="rooms" as="h1" margin="0 0 12px" toggle={false} />
      <div style={{ fontSize: 17, fontWeight: 900, margin: "0 2px 10px" }}>{payerName}</div>

      <div data-testid="renter-classes" style={{ background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 18, padding: "13px 14px", marginBottom: 12 }}>
        <FigureHead margin="0 0 8px" title={<span style={head}>CLASSES IN YOUR ROOMS · {classes.length}</span>} />
        {classes.length === 0 ? (
          <div style={{ fontSize: 11.5, color: SUB }}>No class held here now.</div>
        ) : (
          classes.map((c) => (
            <div key={c.classId} style={{ display: "flex", gap: 10, padding: "6px 0", borderTop: "1.5px solid var(--el)" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
              <span style={{ flexShrink: 0, fontSize: 11, color: SUB }}>
                {c.held} held · {c.upcoming} to come{c.nextAt ? ` · next ${dateWords(c.nextAt)}` : ""}
              </span>
            </div>
          ))
        )}
      </div>

      <RentReceivedList payments={payments} payerName={payerName} disputes={disputes} />
    </div>
  );
}
