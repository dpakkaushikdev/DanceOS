import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StorageScreen } from "@/features/settings/components/StorageScreen";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActingAs } from "@/repositories/actingAs";
import { findProfileById } from "@/repositories/profiles";
import { measureStorage, type StorageSubject } from "@/repositories/storage";

export const metadata: Metadata = { title: "Storage — DanceOS" };

/** /storage — how much of DanceOS the profile you are in takes up (30 Oct 2026).
 *  `?as=` names a studio or `crew-{id}`; ⚠ A POINTER IS NEVER AN AUTHORITY, so
 *  it is resolved against the businesses this account RUNS and the crews it
 *  LEADS, and anything else means yourself. Only then does the service role
 *  measure — keyed on the id just proven, handing back sizes and counts. */
export default async function StoragePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { as } = await searchParams;
  const acting = await resolveActingAs(supabase, as ?? null);

  let subject: StorageSubject;
  let whose: string;
  if (acting) {
    subject = { kind: acting.kind, id: acting.id };
    whose = acting.name;
  } else {
    subject = { kind: "me", id: user.id };
    const me = await findProfileById(supabase, user.id).catch(() => null);
    whose = me?.fullName ?? "Your account";
  }

  const report = await measureStorage(createSupabaseAdminClient(), subject);
  return <StorageScreen report={report} whose={whose} />;
}
