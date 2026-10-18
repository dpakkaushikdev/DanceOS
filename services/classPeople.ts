import type { SupabaseClient } from "@supabase/supabase-js";
import { askClassPerson, findClassPeopleByClass, withdrawClassAsk } from "@/repositories/classPeople";

/** What the class form says about WHO IS TAKING IT. Since 18 Sep 2026 that is
 *  the only person the form names: the teacher, anyone on DanceOS (the RPC
 *  refuses an organization account and re-checks the caller is the owner).
 *  Assistants are not the form's business any more — they are added from the
 *  class page, by the owner or the teacher.
 *
 *  ⚠ NO RATE, ANYWHERE (18 Oct 2026, the user: *"no other way to set price from
 *  somewhere else it should happen only from the team section when going to pay
 *  that particular person or studio"*). An ask carries no pay; what a session is
 *  worth is typed in the Team desk's pay sheet, line by line, when it is paid. */
export interface ClassPeopleIntent {
  artistUserId: string | null;
}

/** Make the class's TEACHER match what the form asked for.
 *
 *  The form states an intent; the classPerson is the record. Reconciling rather than
 *  re-asking matters because a classPerson carries CONSENT: somebody who already said
 *  yes must not be asked again just because the owner re-saved the form. So:
 *    · the same person still named keeps their answer
 *    · a different person named: the old ask is withdrawn, the new person ASKED
 *    · nobody named: the old ask is withdrawn (the class waits for a teacher)
 *
 *  ⚠⚠ UNLESS THE CLASS ITSELF CHANGED (11 Oct 2026, the user: "if anything has
 *  been edited should send a new request for confirmation"). A yes was a yes to
 *  a time and a place; when one moves, `reconfirm` is true and everybody on the
 *  class who is not the person saving it is ASKED AGAIN — the teacher with their
 *  register job, every assistant with their powers. `ask_class_person` closes the
 *  old row and opens a fresh one, so consent is never inherited and each of them
 *  is notified. */
export async function reconcileClassPeople(
  supabase: SupabaseClient,
  classId: string,
  intent: ClassPeopleIntent | null,
  opts: { reconfirm?: boolean; meId?: string } = {}
): Promise<void> {
  const current = await findClassPeopleByClass(supabase, classId);
  const teacher = current.find((c) => c.kind === "artist") ?? null;
  const reask = (p: (typeof current)[number]) =>
    askClassPerson(supabase, {
      classId,
      userId: p.userId,
      kind: p.kind,
      canAttendance: p.canAttendance,
      canRefunds: p.canRefunds,
    });

  if (opts.reconfirm) {
    for (const a of current.filter((c) => c.kind === "assistant" && c.userId !== opts.meId && c.status !== "rejected")) {
      await reask(a);
    }
  }

  if (!intent) {
    if (opts.reconfirm && teacher && teacher.userId !== opts.meId) await reask(teacher);
    return;
  }

  if (teacher && teacher.userId === intent.artistUserId) {
    if (opts.reconfirm && teacher.userId !== opts.meId) await reask(teacher);
    return;
  }
  if (teacher) {
    await withdrawClassAsk(supabase, teacher.id);
  }
  if (intent.artistUserId) {
    await askClassPerson(supabase, {
      classId,
      userId: intent.artistUserId,
      kind: "artist",
      /* the teacher takes the register by default; the owner may take it back on the class page */
      canAttendance: true,
      canRefunds: false,
    });
  }
}
