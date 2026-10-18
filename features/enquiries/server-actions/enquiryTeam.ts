"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addEnquiryFile,
  addEnquiryPerson,
  cancelEnquiryPractice,
  checkInEnquiryPractice,
  removeEnquiryFile,
  removeEnquiryPerson,
  respondToEnquiryJob,
  saveEnquiryPractice,
} from "@/repositories/enquiryTeam";

/** AN ENQUIRY'S TEAM AND PRACTICES (18 Oct 2026). Shape only — every rule (who
 *  works the enquiry, who counts as team, a closed enquiry takes nobody, the
 *  register is for the job's own people) is the RPC's, and its refusal is
 *  passed through in its own words. */

export interface JobActionResult {
  error: string | null;
}

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

function revalidate(enquiryId: string) {
  revalidatePath(`/inbox/enquiries/${enquiryId}`);
  /* a practice and a job show on these too (18 Oct 2026) */
  revalidatePath("/practice");
  revalidatePath("/calendar");
}

async function guarded(run: () => Promise<void>): Promise<JobActionResult> {
  try {
    await run();
    return { error: null };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : "That did not go through" };
  }
}

const personSchema = z.object({
  enquiryId: z.string().uuid(),
  userId: z.string().uuid(),
  kind: z.enum(["team", "participant"]),
  role: z.string().trim().max(40).nullable(),
});

export async function addEnquiryPersonAction(input: z.input<typeof personSchema>): Promise<JobActionResult> {
  const parsed = personSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the person" };
  const supabase = await signedIn();
  if (!supabase) return { error: "Sign in first" };
  const d = parsed.data;
  const r = await guarded(() => addEnquiryPerson(supabase, d.enquiryId, d.userId, d.kind, d.role || null));
  if (!r.error) revalidate(d.enquiryId);
  return r;
}

const removeSchema = z.object({ enquiryId: z.string().uuid(), personId: z.string().uuid() });

export async function removeEnquiryPersonAction(input: z.input<typeof removeSchema>): Promise<JobActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the person" };
  const supabase = await signedIn();
  if (!supabase) return { error: "Sign in first" };
  const r = await guarded(() => removeEnquiryPerson(supabase, parsed.data.personId));
  if (!r.error) revalidate(parsed.data.enquiryId);
  return r;
}

const practiceSchema = z
  .object({
    enquiryId: z.string().uuid(),
    practiceId: z.string().uuid().nullable(),
    /* an IST wall-clock date and times, as the form's controls give them */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    start: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
    end: z.string().regex(/^\d{2}:\d{2}$/, "Pick an end time"),
    place: z.string().trim().min(1, "Say where").max(120),
    note: z.string().trim().max(280).nullable(),
  })
  .refine((v) => v.end > v.start, { message: "It ends after it starts", path: ["end"] });

export async function saveEnquiryPracticeAction(input: z.input<typeof practiceSchema>): Promise<JobActionResult> {
  const parsed = practiceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the practice" };
  const supabase = await signedIn();
  if (!supabase) return { error: "Sign in first" };
  const d = parsed.data;
  const r = await guarded(() =>
    saveEnquiryPractice(supabase, {
      enquiryId: d.enquiryId,
      practiceId: d.practiceId,
      startsAt: `${d.date}T${d.start}:00+05:30`,
      endsAt: `${d.date}T${d.end}:00+05:30`,
      place: d.place,
      note: d.note || null,
    }),
  );
  if (!r.error) revalidate(d.enquiryId);
  return r;
}

const practiceIdSchema = z.object({ enquiryId: z.string().uuid(), practiceId: z.string().uuid() });

export async function cancelEnquiryPracticeAction(input: z.input<typeof practiceIdSchema>): Promise<JobActionResult> {
  const parsed = practiceIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the practice" };
  const supabase = await signedIn();
  if (!supabase) return { error: "Sign in first" };
  const r = await guarded(() => cancelEnquiryPractice(supabase, parsed.data.practiceId));
  if (!r.error) revalidate(parsed.data.enquiryId);
  return r;
}

const checkInSchema = z.object({ enquiryId: z.string().uuid(), practiceId: z.string().uuid(), userId: z.string().uuid(), on: z.boolean() });

export async function checkInEnquiryPracticeAction(input: z.input<typeof checkInSchema>): Promise<JobActionResult> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the register" };
  const supabase = await signedIn();
  if (!supabase) return { error: "Sign in first" };
  const d = parsed.data;
  const r = await guarded(() => checkInEnquiryPractice(supabase, d.practiceId, d.userId, d.on));
  if (!r.error) {
    revalidate(d.enquiryId);
    revalidatePath(`/practice/job/${d.practiceId}`);
  }
  return r;
}

/* ── A JOB IS ASKED, AND FILES (18 Oct 2026, `20261025090000`) ── */

const answerSchema = z.object({ personId: z.string().uuid(), accept: z.boolean() });

/** the person asked onto an enquiry job answers it — the RPC is theirs alone */
export async function respondToEnquiryJobAction(input: z.input<typeof answerSchema>): Promise<JobActionResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the job" };
  const supabase = await signedIn();
  if (!supabase) return { error: "Sign in first" };
  const r = await guarded(() => respondToEnquiryJob(supabase, parsed.data.personId, parsed.data.accept));
  if (!r.error) {
    revalidatePath("/inbox");
    revalidatePath("/practice");
    revalidatePath("/calendar");
  }
  return r;
}

/** ⚠ a web link and nothing else — `javascript:` and every other scheme are
 *  refused here AND by the RPC, because a link is rendered as an `href` the other
 *  end will press (the 11 Sep `javascript:` lesson) */
const webLink = z
  .string()
  .trim()
  .max(600, "That link is too long")
  .refine((v) => {
    try {
      const u = new URL(v);
      return (u.protocol === "http:" || u.protocol === "https:") && /^https?:\/\/\S+$/i.test(v);
    } catch {
      return false;
    }
  }, "That is not a web link — it must start with http:// or https://");

const fileSchema = z.object({
  enquiryId: z.string().uuid(),
  kind: z.enum(["music", "video", "document", "photo", "link"]),
  label: z.string().trim().min(1, "Give the link a name").max(80, "Keep the name under 80 characters"),
  url: webLink,
});

export async function addEnquiryFileAction(input: z.input<typeof fileSchema>): Promise<JobActionResult> {
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the link" };
  const supabase = await signedIn();
  if (!supabase) return { error: "Sign in first" };
  const d = parsed.data;
  const r = await guarded(() => addEnquiryFile(supabase, d.enquiryId, d.kind, d.label, d.url));
  if (!r.error) revalidatePath(`/inbox/enquiries/${d.enquiryId}`);
  return r;
}

const removeFileSchema = z.object({ enquiryId: z.string().uuid(), fileId: z.string().uuid() });

export async function removeEnquiryFileAction(input: z.input<typeof removeFileSchema>): Promise<JobActionResult> {
  const parsed = removeFileSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the link" };
  const supabase = await signedIn();
  if (!supabase) return { error: "Sign in first" };
  const r = await guarded(() => removeEnquiryFile(supabase, parsed.data.fileId));
  if (!r.error) revalidatePath(`/inbox/enquiries/${parsed.data.enquiryId}`);
  return r;
}
