"use client";

import { useRouter } from "next/navigation";
import { deleteMembershipAction } from "@/features/memberships/server-actions/memberships";
import { DeleteIconButton } from "@/components/ui/DeleteIconButton";

/** DELETE A MEMBERSHIP (28 Sep 2026 as "Take it off sale"; 4 Oct 2026, the user:
 *  *"take it off sale to be on top right as a chip and renamed to delete"*).
 *
 *  ⚠ THE WORD CHANGED AND THE ACT DID NOT. `delete_membership`'s own comment:
 *  *"taking it off sale is not taking it back: every pass already bought keeps its
 *  units and keeps working."* So the confirm still says what the database
 *  promises — a seller with live holders deserves to know that before pressing.
 *
 *  ⚠ THE APP'S ONE DELETE (18 Oct 2026, the user: "fix delete button on all cards
 *  or cards detail pages … make it consistent"): it had its own copy of the
 *  dialog; it is `DeleteIconButton` now, the same 36px trash and the same
 *  question every other removal asks in. */
export function MembershipOffSale({ membershipId, name, active, backTo = "/memberships" }: { membershipId: string; name: string; active: number; backTo?: string }) {
  const router = useRouter();
  return (
    <DeleteIconButton
      label={`Delete ${name}`}
      testId="membership-delete"
      title={`Delete ${name}?`}
      body={
        active > 0
          ? `${active} ${active === 1 ? "person holds" : "people hold"} one — theirs keep working. It only stops new ones being bought.`
          : "Nobody holds one. It stops being offered."
      }
      style={{ pointerEvents: "auto" }}
      onConfirm={async () => {
        const out = await deleteMembershipAction({ membershipId });
        if (out.error) return out.error;
        /* back to the desk it was opened from — a beat behind the dialog closing,
           which spends its own history entry first (the 600 ms the other sheets use) */
        setTimeout(() => {
          router.replace(backTo);
          router.refresh();
        }, 600);
        return null;
      }}
    />
  );
}
