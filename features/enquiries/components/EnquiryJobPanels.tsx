"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EnqFace } from "@/features/enquiries/components/enquiry-kit";
import { Eyebrow, Surface } from "@/features/inbox/components/inbox-kit";
import {
  addEnquiryFileAction,
  addEnquiryPersonAction,
  cancelEnquiryPracticeAction,
  removeEnquiryFileAction,
  removeEnquiryPersonAction,
  saveEnquiryPracticeAction,
  type JobActionResult,
} from "@/features/enquiries/server-actions/enquiryTeam";
import { DeleteIconButton } from "@/components/ui/DeleteIconButton";
import { ToolChip, toolBtn } from "@/components/ui/ToolCard";
import { EnquiryPracticeCard } from "./EnquiryPracticeCard";
import {
  ENQ_FILE_KINDS,
  ENQ_PERSON_STATUS_WORD,
  ENQ_PERSON_WORD,
  istDayKey,
  linkHost,
  type EnquiryFile,
  type EnquiryFileKind,
  type EnquiryJob,
  type EnquiryPersonKind,
} from "@/types/enquiry";
import type { EnquiryJobPerson } from "@/repositories/enquiryTeam";
import { EnquiryFormSheet } from "./EnquiryFormSheet";
import { FORM_INPUT, FORM_LABEL, FormBar, formPrimary, formSecondary } from "@/components/ui/FormPage";

/** THE TEAM AND PRACTICES SEGMENTS of an enquiry (18 Oct 2026). Short words, one
 *  control per act; every rule is the RPC's and its refusal is printed as given.
 *  ⚠ Until `20261024090000` is applied the job reads `available: false` and each
 *  segment says so in one line. */

export interface TeamPick {
  userId: string;
  name: string;
  photoPath: string | null;
  /** the seat's word on the business — "Owner", "Faculty" … */
  seat: string;
}

const pill: React.CSSProperties = {
  padding: "8px 13px",
  borderRadius: 999,
  border: "none",
  background: "var(--text)",
  color: "var(--solid)",
  fontWeight: 900,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};
const ghost: React.CSSProperties = { ...pill, background: "var(--el)", color: "var(--text)", fontWeight: 800 };
const field: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--solid)",
  border: "1.5px solid var(--el)",
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};
const label: React.CSSProperties = { fontSize: 9, fontWeight: 900, letterSpacing: 0.7, color: "var(--muted)", marginBottom: 4, display: "block" };

const OFF_LINE = "Available once switched on";

const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).replace(" ", "").toLowerCase();
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<JobActionResult>, opts: { refreshAfter?: number } = {}): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return false;
    }
    if (opts.refreshAfter) setTimeout(() => router.refresh(), opts.refreshAfter);
    else router.refresh();
    return true;
  };
  return { busy, error, run };
}

const Err = ({ text }: { text: string | null }) =>
  text ? (
    <div role="alert" style={{ fontSize: 11.5, color: "#F87171", marginTop: 8 }}>
      {text}
    </div>
  ) : null;

function Off() {
  return (
    <Surface>
      <div data-testid="job-off" style={{ fontSize: 12.5, color: "var(--sub)", textAlign: "center", padding: "6px 0" }}>
        {OFF_LINE}
      </div>
    </Surface>
  );
}

/* ── TEAM ─────────────────────────────────────────────────────────────────── */

export function EnquiryTeamPanel({
  enquiryId,
  job,
  canWork,
  team,
  tint,
  meId,
  sender,
}: {
  enquiryId: string;
  job: EnquiryJob;
  /** an owner or manager on the business's side — adds and removes anybody */
  canWork: boolean;
  /** the business's own people, offered as Team */
  team: TeamPick[];
  tint: string;
  meId: string;
  /** who sent the enquiry — ⚠ they may add PARTICIPANTS and take off the ones
   *  they added (`20261026090000`); the team is the business's to choose */
  sender: { id: string; name: string };
}) {
  const { busy, error, run } = useRun();
  const [role, setRole] = useState("");
  const [adding, setAdding] = useState<EnquiryPersonKind | null>(null);
  /* ⚠ NO PARTICIPANTS ARE ADDED ANY MORE (19 Oct 2026, the user: "remove adding
     participants in an enquiry"). The Team · Participants columns of 18 Oct are
     gone: the panel is the business's Team, and only the business adds to it.
     Participants already on a job from before stay listed (read only, removable)
     so nobody disappears without a word. */
  if (!job.available) return <Off />;

  const isSender = meId === sender.id;
  const mayAdd = (k: EnquiryPersonKind) => canWork && k === "team";
  const mayRemove = (p: EnquiryJobPerson) => canWork || (isSender && p.kind === "participant" && p.addedBy === meId);
  const people = job.people as EnquiryJobPerson[];
  const on = new Set(people.map((p) => p.userId));
  const freeTeam = team.filter((t) => !on.has(t.userId));
  const groups: EnquiryPersonKind[] = people.some((p) => p.kind === "participant") ? ["team", "participant"] : ["team"];

  const add = async (userId: string, kind: "team") => {
    const ok = await run(() => addEnquiryPersonAction({ enquiryId, userId, kind, role: role.trim() || null }));
    if (ok) {
      setRole("");
      setAdding(null);
    }
  };

  return (
    <div data-testid="enquiry-team">
      {groups.map((k) => {
        const rows = people.filter((p) => p.kind === k);
        return (
          <Surface key={k}>
            <Eyebrow tint={k === "team" ? tint : undefined}>{`${k === "team" ? "TEAM" : "PARTICIPANTS"} · ${rows.length}`}</Eyebrow>
            {rows.length === 0 ? <div style={{ fontSize: 12, color: "var(--sub)" }}>{k === "team" ? "Nobody yet." : "None yet."}</div> : null}
            {rows.map((p) => (
              <div key={p.id} data-testid="enquiry-person" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1.5px solid var(--el)" }}>
                <EnqFace path={p.photoPath} name={p.name} size={34} tint={tint} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--sub)" }}>
                    {p.role ?? ENQ_PERSON_WORD[p.kind]}
                    {p.kind === "participant" && p.addedBy === sender.id ? ` · added by ${p.addedBy === meId ? "you" : sender.name}` : ""}
                  </div>
                </div>
                {/* ⚠ ASKED IS NOT ON IT (18 Oct 2026, `20261025090000`): the person
                    says yes from their Inbox › Jobs before they are told about
                    practices or counted on a register */}
                <span data-testid="enquiry-person-status" data-status={p.status}>
                  <ToolChip
                    word={ENQ_PERSON_STATUS_WORD[p.status].toUpperCase()}
                    fg={p.status === "confirmed" ? "#15803D" : "#B45309"}
                    bg={p.status === "confirmed" ? "#22C55E22" : "#F59E0B22"}
                  />
                </span>
                {mayRemove(p) ? (
                  <button type="button" disabled={busy} aria-label={`Remove ${p.name}`} onClick={() => void run(() => removeEnquiryPersonAction({ enquiryId, personId: p.id }))} style={{ ...ghost, padding: "6px 10px", fontSize: 11 }}>
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            {mayAdd(k) ? (
              adding === k ? null : (
                <button type="button" onClick={() => setAdding(k)} style={{ ...ghost, marginTop: 10, width: "100%" }}>
                  + Add team
                </button>
              )
            ) : null}
            {mayAdd(k) && adding === k ? (
              <div style={{ marginTop: 10 }}>
                <label style={label} htmlFor={`role-${k}`}>
                  ROLE
                </label>
                <input id={`role-${k}`} value={role} maxLength={40} onChange={(ev) => setRole(ev.target.value)} placeholder={k === "team" ? "Lead choreographer" : "Dancer"} aria-label="Role" style={{ ...field, marginBottom: 9 }} />
                {freeTeam.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {freeTeam.map((t) => (
                        <button key={t.userId} type="button" disabled={busy} aria-label={`Add ${t.name} to the team`} onClick={() => void add(t.userId, "team")} style={{ display: "flex", alignItems: "center", gap: 9, padding: 8, borderRadius: 12, border: "1.5px solid var(--el)", background: "var(--card)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                          <EnqFace path={t.photoPath} name={t.name} size={28} tint={tint} />
                          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 800 }}>{t.name}</span>
                          <span style={{ fontSize: 10, color: "var(--sub)", fontWeight: 700 }}>{t.seat}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--sub)" }}>Everyone on your team is on it.</div>
                  )}
                <button type="button" onClick={() => setAdding(null)} style={{ ...ghost, marginTop: 9, width: "100%", color: "var(--sub)" }}>
                  Done
                </button>
              </div>
            ) : null}
            <Err text={adding === k ? error : null} />
          </Surface>
        );
      })}
      {!adding ? <Err text={error} /> : null}
    </div>
  );
}

/* ── PRACTICES ────────────────────────────────────────────────────────────── */

export function EnquiryPracticesPanel({
  enquiryId,
  job,
  canWork,
  closed,
  nowIso,
  tint,
  hostName,
  hostPhotoPath,
  typeKey,
  myPart,
  linked,
  practiceHrefBase = "/practice/job",
}: {
  enquiryId: string;
  job: EnquiryJob;
  canWork: boolean;
  closed: boolean;
  /** what the reader is to the job — the card's chip */
  myPart: "runs" | "team" | "participant" | "sender";
  /** where a practice's page lives — a studio's own enquiry links under the
   *  studio, so opening a practice never switches profile (18 Oct 2026) */
  practiceHrefBase?: string;
  /** the card opens the practice's own page — only for somebody that page admits
   *  (the business's side and the job's confirmed people); the sender reads it here */
  linked: boolean;
  nowIso: string;
  tint: string;
  /** whose job it is — the card leads with it */
  hostName: string;
  hostPhotoPath: string | null;
  typeKey: string | null;
}) {
  const router = useRouter();
  const { busy, error, run } = useRun();
  const [form, setForm] = useState<null | { practiceId: string | null; date: string; start: string; end: string; place: string; placeUrl: string; note: string }>(null);
  if (!job.available) return <Off />;

  const coming = job.practices.filter((p) => p.endsAt >= nowIso);
  const past = job.practices.filter((p) => p.endsAt < nowIso);

  const linkBad = (u: string) => Boolean(u.trim()) && !/^https?:\/\/\S+$/i.test(u.trim());
  const save = async () => {
    if (!form || !form.place.trim() || form.end <= form.start || linkBad(form.placeUrl)) return;
    /* ⚠ close FIRST, refresh after: the sheet spends its history entry on close,
       and a `back()` racing a refresh is the 19 Sep race (the forms' own 600 ms) */
    const ok = await run(
      () => saveEnquiryPracticeAction({ enquiryId, practiceId: form.practiceId, date: form.date, start: form.start, end: form.end, place: form.place, placeUrl: form.placeUrl.trim() || null, note: form.note.trim() || null }),
      { refreshAfter: 600 },
    );
    if (ok) setForm(null);
  };

  /* ⚠ THE CARD IS THE ONE PRACTICE CARD, AND IT OPENS THE PRACTICE'S OWN PAGE
     (18 Oct 2026) — the register lives there, not inline: two registers for one
     practice is the two-doors shape this repo has paid for twice */
  const confirmed = job.people.filter((x) => x.status === "confirmed").length;
  const now = new Date(nowIso).getTime();
  const card = (p: EnquiryJob["practices"][number]) => {
    const off = p.status === "cancelled";
    const ended = p.endsAt < nowIso;
    return (
      <div key={p.id} data-testid="enquiry-practice">
        <EnquiryPracticeCard
          now={now}
          linked={linked}
          hrefBase={practiceHrefBase}
          practice={{
            id: p.id,
            enquiryId,
            startsAt: p.startsAt,
            endsAt: p.endsAt,
            place: p.place,
            placeUrl: p.placeUrl ?? null,
            note: p.note,
            status: p.status,
            hostName,
            hostPhotoPath,
            typeKey,
            myPart,
            people: confirmed,
            checkedIn: p.checkedIn.length,
          }}
          actions={
            canWork && !off && !ended ? (
              <>
                <button
              type="button"
              onClick={() =>
                setForm({
                  practiceId: p.id,
                  date: istDayKey(p.startsAt),
                  start: new Date(new Date(p.startsAt).getTime() + 330 * 60_000).toISOString().slice(11, 16),
                  end: new Date(new Date(p.endsAt).getTime() + 330 * 60_000).toISOString().slice(11, 16),
                  place: p.place,
                  placeUrl: p.placeUrl ?? "",
                  note: p.note ?? "",
                })
              }
              style={toolBtn("secondary", tint)}
              aria-label={`Edit the practice on ${dayOf(p.startsAt)}`}
            >
              Edit
            </button>
                <DeleteIconButton
                  label={`Call off the practice on ${dayOf(p.startsAt)}`}
                  title="Call off this practice?"
                  body={`${dayOf(p.startsAt)}, ${clockOf(p.startsAt)} — everybody on the job is told it is off.`}
                  goWord="Call it off"
                  word="Call off"
                  onConfirm={async () => {
                    const r = await cancelEnquiryPracticeAction({ enquiryId, practiceId: p.id });
                    if (r.error) return r.error;
                    router.refresh();
                    return null;
                  }}
                />
              </>
            ) : null
          }
        />
      </div>
    );
  };

  return (
    <div data-testid="enquiry-practices">
      {canWork && !closed ? (
        <button type="button" onClick={() => setForm({ practiceId: null, date: istDayKey(nowIso), start: "18:00", end: "19:00", place: "", placeUrl: "", note: "" })} style={{ ...pill, width: "100%", padding: 12, marginBottom: 10 }}>
          + Add practice
        </button>
      ) : null}
      {/* ⚠ A FORM SHEET (18 Oct 2026, the user: "add a practice should open a form
          in enquiry as well") — the app's one form anatomy, not an inline card */}
      {form ? (
        <EnquiryFormSheet title={form.practiceId ? "Edit practice" : "Add practice"} onClose={() => setForm(null)}>
          <label style={{ ...FORM_LABEL, display: "block" }} htmlFor="ep-date">
            DATE
          </label>
          <input id="ep-date" type="date" value={form.date} onChange={(ev) => setForm({ ...form, date: ev.target.value })} style={FORM_INPUT} />
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...FORM_LABEL, display: "block" }} htmlFor="ep-start">
                STARTS
              </label>
              <input id="ep-start" type="time" value={form.start} onChange={(ev) => setForm({ ...form, start: ev.target.value })} style={FORM_INPUT} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...FORM_LABEL, display: "block" }} htmlFor="ep-end">
                ENDS
              </label>
              <input id="ep-end" type="time" value={form.end} onChange={(ev) => setForm({ ...form, end: ev.target.value })} style={FORM_INPUT} />
            </div>
          </div>
          <label style={{ ...FORM_LABEL, display: "block" }} htmlFor="ep-place">
            WHERE · PLACE NAME
          </label>
          <input id="ep-place" value={form.place} maxLength={120} onChange={(ev) => setForm({ ...form, place: ev.target.value })} placeholder="Studio A" style={FORM_INPUT} />
          <label style={{ ...FORM_LABEL, display: "block" }} htmlFor="ep-link">
            WHERE · MAP LINK
          </label>
          <input id="ep-link" type="url" inputMode="url" value={form.placeUrl} maxLength={500} onChange={(ev) => setForm({ ...form, placeUrl: ev.target.value })} placeholder="https://maps.app.goo.gl/…" style={FORM_INPUT} />
          <label style={{ ...FORM_LABEL, display: "block" }} htmlFor="ep-note">
            NOTE
          </label>
          <input id="ep-note" value={form.note} maxLength={280} onChange={(ev) => setForm({ ...form, note: ev.target.value })} placeholder="Optional" style={FORM_INPUT} />
          <Err text={error} />
          <FormBar>
            <button type="button" onClick={() => setForm(null)} style={formSecondary}>
              Cancel
            </button>
            <button type="button" disabled={busy} onClick={() => void save()} style={formPrimary(Boolean(form.place.trim()) && form.end > form.start && !linkBad(form.placeUrl))}>
              {!form.place.trim() ? "Name the place" : form.end <= form.start ? "End after the start" : linkBad(form.placeUrl) ? "The link starts with https://" : form.practiceId ? "Save" : "Add practice"}
            </button>
          </FormBar>
        </EnquiryFormSheet>
      ) : null}
      <Surface>
        <Eyebrow>{`COMING UP · ${coming.length}`}</Eyebrow>
        {coming.length ? coming.map(card) : <div style={{ fontSize: 12, color: "var(--sub)" }}>No practice yet.</div>}
      </Surface>
      {past.length ? (
        <Surface>
          <Eyebrow>{`DONE · ${past.length}`}</Eyebrow>
          {past.slice().reverse().map(card)}
        </Surface>
      ) : null}
      {!form ? <Err text={error} /> : null}
    </div>
  );
}

/* ── FILES ────────────────────────────────────────────────────────────────── */

const FILE_ICON: Record<EnquiryFileKind, string> = { music: "♪", video: "▶", document: "▤", photo: "◩", link: "↗" };

/** LINKS SHARED ON AN ENQUIRY (18 Oct 2026, `20261025090000`) — music, a video, a
 *  document, photos; ⚠ never an upload, only a web link, refused unless it is
 *  http(s) here, in the action and in the RPC. Either end adds; whoever added a
 *  link, or whoever works the enquiry, takes it down. */
export function EnquiryFilesPanel({
  enquiryId,
  available,
  files,
  meId,
  canWork,
  closed,
  tint,
}: {
  enquiryId: string;
  available: boolean;
  files: EnquiryFile[];
  meId: string;
  canWork: boolean;
  closed: boolean;
  tint: string;
}) {
  const router = useRouter();
  const { busy, error, run } = useRun();
  const [kind, setKind] = useState<EnquiryFileKind>("music");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  /* A FORM SHEET (18 Oct 2026, the user: "files add link should be like a
     form") — the practice form's anatomy: "+ Add link" opens it, the bar's
     button names what is missing, Cancel closes it */
  const [open, setOpen] = useState(false);
  if (!available) return <Off />;

  const okUrl = /^https?:\/\/\S+\.\S+/i.test(url.trim());
  const add = async () => {
    const ok = await run(() => addEnquiryFileAction({ enquiryId, kind, label: name.trim(), url: url.trim() }));
    if (ok) {
      setName("");
      setUrl("");
      setOpen(false);
    }
  };

  return (
    <div data-testid="enquiry-files">
      {!closed ? (
        <button type="button" data-testid="enquiry-file-add" onClick={() => setOpen(true)} style={{ ...pill, width: "100%", padding: 12, marginBottom: 10 }}>
          + Add link
        </button>
      ) : null}
      {open ? (
        <EnquiryFormSheet title="Add link" onClose={() => setOpen(false)}>
          <span style={{ ...FORM_LABEL, display: "block" }}>KIND</span>
          <div role="group" aria-label="What kind of link" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {ENQ_FILE_KINDS.map(([k, word]) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                style={{ ...(kind === k ? { ...pill, background: tint, color: "#fff" } : ghost), padding: "6px 11px", fontSize: 11.5 }}
              >
                <span aria-hidden="true" style={{ marginRight: 5 }}>
                  {FILE_ICON[k]}
                </span>
                {word}
              </button>
            ))}
          </div>
          <label style={{ ...FORM_LABEL, display: "block" }} htmlFor="ef-name">
            NAME
          </label>
          <input id="ef-name" value={name} maxLength={80} onChange={(ev) => setName(ev.target.value)} placeholder="Final mix" style={FORM_INPUT} />
          <label style={{ ...FORM_LABEL, display: "block" }} htmlFor="ef-url">
            LINK
          </label>
          <input id="ef-url" type="url" inputMode="url" value={url} maxLength={600} onChange={(ev) => setUrl(ev.target.value)} placeholder="https://…" style={FORM_INPUT} />
          <Err text={error} />
          <FormBar>
            <button type="button" onClick={() => setOpen(false)} style={formSecondary}>
              Cancel
            </button>
            <button type="button" disabled={busy || !name.trim() || !okUrl} onClick={() => void add()} style={formPrimary(Boolean(name.trim()) && okUrl)}>
              {!name.trim() ? "Name the link" : !okUrl ? "Paste a web link" : busy ? "Adding…" : "Add link"}
            </button>
          </FormBar>
        </EnquiryFormSheet>
      ) : null}
      <Surface>
        <Eyebrow>{`LINKS · ${files.length}`}</Eyebrow>
        {files.length === 0 ? <div style={{ fontSize: 12, color: "var(--sub)" }}>Nothing shared yet.</div> : null}
        {files.map((f) => {
          const mayRemove = f.createdBy === meId || canWork;
          const word = ENQ_FILE_KINDS.find(([k]) => k === f.kind)?.[1] ?? "Link";
          return (
            <div key={f.id} data-testid="enquiry-file" data-kind={f.kind} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1.5px solid var(--el)" }}>
              <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, background: `${tint}1f`, color: tint, fontWeight: 900, fontSize: 15 }}>
                {FILE_ICON[f.kind]}
              </span>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${f.label} — ${word}, ${linkHost(f.url)}`}
                style={{ flex: 1, minWidth: 0, color: "var(--text)", textDecoration: "none" }}
              >
                <span style={{ display: "block", fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
                <span style={{ display: "block", fontSize: 10.5, color: "var(--sub)", marginTop: 1 }}>
                  {word} · {linkHost(f.url)}
                </span>
              </a>
              {mayRemove ? (
                <DeleteIconButton
                  label={`Remove ${f.label}`}
                  title="Remove this link?"
                  body={`${f.label} — the other end will no longer see it.`}
                  goWord="Remove"
                  word="Remove"
                  onConfirm={async () => {
                    const r = await removeEnquiryFileAction({ enquiryId, fileId: f.id });
                    if (r.error) return r.error;
                    router.refresh();
                    return null;
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </Surface>
    </div>
  );
}
