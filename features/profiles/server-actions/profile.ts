"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { nameField } from "@/lib/constants/names";
import { verifyUpiId } from "@/lib/cashfree/verifyUpi";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UPI_ID_ERROR, normaliseUpiId } from "@/lib/upi/link";
import { findPhones, findUpiForPaying, setMyLearnStyles, setMyUpiId, setUpiIdVerified, updateMyProfile } from "@/repositories/profiles";

/** The Profile tab's one write (S_profiletab: Edit profile 11364, the links
 *  sheet 11161, the styles sheet 11217 — three sheets, one record). Zod checks
 *  the shape; the RPC re-checks it and scopes the write to the caller. */

const schema = z.object({
  fullName: nameField("Add your name"),
  city: z.string().trim().min(1, "Add your city").max(120),
  age: z.number().int().min(13).max(99).nullable(),
  /* THE DATE OF BIRTH (19 Sep 2026): an ISO date; undefined leaves it as it is.
     The RPC checks it is 13 to 99 years ago and works the age out from it. */
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "a date of birth is a date")
    .nullable()
    .optional(),
  socials: z
    .array(
      z.object({
        platform: z.string().trim().min(1).max(40),
        url: z.string().trim().url().max(300),
      })
    )
    .max(12),
  /* no limit on dance styles (10 Oct 2026) — 100 is the database's safety ceiling */
  styles: z.array(z.string().trim().min(1).max(40)).max(100),
  /* the same shape the business phone takes (settings slice) — an empty box is
     null, which is how a person TAKES THEIR NUMBER DOWN without asking anyone */
  /* ⚠ OMITTED = LEAVE IT AS IT IS (6 Oct 2026, decision 4): the number is its own
     read now, and only the contact sheet edits it — so the styles and links rows
     and Edit details send none, and the server keeps the stored one rather than
     trusting a copy the page may never have held. */
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ]{7,17}$/, "a phone number is 8 to 18 digits")
    .nullable()
    .optional(),
  /* THE CONTACT EMAIL (19 Sep 2026) — the Mail button's address. Omitted, the
     column is left alone (the styles and links sheets never carry it); null
     clears it; the database keeps the same shape as a CHECK */
  contactEmail: z.string().trim().email("that is not an email address").max(254).nullable().optional(),
  /* CALL IS A TOGGLE (push 2, 19 Sep 2026): omitted, the switch is left alone */
  phonePublic: z.boolean().optional(),
});

export type MyProfileInput = z.infer<typeof schema>;

/* ⚠ `setMyPlaceAction` IS GONE (26 Sep 2026): it wrote `set_my_place` on the
   organization LOGIN's row, and both the login and the RPC are retired. An
   organization's pin is its business row's, through `set_business_location`. */

export async function updateMyProfileAction(input: MyProfileInput): Promise<{ error: string | null }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first ? `${first.path.join(".") || "profile"}: ${first.message}` : "Something went wrong — please try again." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  try {
    /* the RPC takes the whole profile, so an omitted number is filled from the
       one on record — never sent as null, which would take it down */
    const phone =
      parsed.data.phone === undefined
        ? ((await findPhones(supabase, [user.id], { strict: true })).get(user.id) ?? null)
        : parsed.data.phone || null;
    await updateMyProfile(supabase, {
      ...parsed.data,
      city: parsed.data.city || null,
      phone,
    });
    revalidatePath("/");
    revalidatePath(`/person/${user.id}`);
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not save your profile" };
  }
}

const upiSchema = z.object({ upiId: z.string().trim().max(300).nullable() });

/** What the editor shows under the box once a save has answered. */
export type UpiSaveOutcome =
  | { state: "cleared" }
  | { state: "verified"; nameAtBank: string | null }
  | { state: "unverified"; reason: string };

/** THE UPI ID A STUDIO MAY PAY YOU ON (2 Nov 2026) — its own door, like the
 *  learn styles: the column is private (not in the profiles column grant) and
 *  `update_my_profile` takes the public profile. Null clears; a shape that is
 *  not name@bank is refused here with the same words the RPC uses.
 *
 *  ⚠ VERIFIED WITH CASHFREE BEFORE IT IS STORED (6 Nov 2026, the user: "how
 *  will it be verified if user entered right UPI id … do real verification").
 *  The order is the point:
 *    1. Cashfree is asked first. An id it says does NOT exist is refused here
 *       and nothing changes — the previous id, verified or not, stays.
 *    2. An id it confirms is stored WITH the name at the bank through the
 *       service-role door, so the row never says "verified" about an id it
 *       does not hold (`set_upi_id_verified` sets both together).
 *    3. An id Cashfree could not be asked about — second factor not passing,
 *       the route not on the account, a network fault — is stored UNVERIFIED
 *       through the person's own door, and the reason is handed back to be
 *       said. A person is never locked out of being paid by a fault on our
 *       side; the owner's sheet shows "not verified" and tells them to read
 *       the name their UPI app shows.
 *  The same id, already verified, is not asked about again: Cashfree charges
 *  per lookup and rate-limits, and a verification is of the id, not the save. */
export async function setMyUpiIdAction(input: { upiId: string | null }): Promise<{ error: string | null; outcome: UpiSaveOutcome | null }> {
  const parsed = upiSchema.safeParse(input);
  if (!parsed.success) return { error: UPI_ID_ERROR, outcome: null };
  const raw = parsed.data.upiId;
  const upiId = raw === null || raw === "" ? null : normaliseUpiId(raw);
  if (raw && !upiId) return { error: UPI_ID_ERROR, outcome: null };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const done = (outcome: UpiSaveOutcome) => {
    revalidatePath("/");
    revalidatePath(`/person/${user.id}`);
    return { error: null, outcome };
  };

  try {
    if (!upiId) {
      await setMyUpiId(supabase, null);
      return done({ state: "cleared" });
    }

    /* the same id, already confirmed: nothing to ask, nothing to change */
    const current = await findUpiForPaying(supabase, user.id, null).catch(() => null);
    if (current && current.upiId === upiId && current.verifiedAt) {
      return done({ state: "verified", nameAtBank: current.nameAtBank });
    }

    const verdict = await verifyUpiId({ userId: user.id, upiId });
    if (verdict.outcome === "invalid") {
      return { error: verdict.reason, outcome: null };
    }
    if (verdict.outcome === "verified") {
      await setUpiIdVerified(createSupabaseAdminClient(), { userId: user.id, upiId, nameAtBank: verdict.nameAtBank, reference: verdict.reference });
      return done({ state: "verified", nameAtBank: verdict.nameAtBank });
    }
    /* unavailable: stored, said, and the sheet on the other side says it too */
    await setMyUpiId(supabase, upiId);
    return done({ state: "unverified", reason: verdict.reason });
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not save your UPI id", outcome: null };
  }
}

const learnSchema = z.object({ styles: z.array(z.string().trim().min(1).max(40)).max(100) });

/** THE STYLES SOMEBODY WANTS TO LEARN (11 Oct 2026) — onboarding's first styles
 *  step and Discover's Recommendation settings. Its own door, because the
 *  column is private and `update_my_profile` takes the public profile. */
export async function setMyLearnStylesAction(input: { styles: string[] }): Promise<{ error: string | null; styles?: string[] }> {
  const parsed = learnSchema.safeParse(input);
  if (!parsed.success) return { error: "Those styles could not be saved — check the names and try again" };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  try {
    const styles = await setMyLearnStyles(supabase, parsed.data.styles);
    revalidatePath("/discover");
    return { error: null, styles };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "Could not save your styles" };
  }
}
