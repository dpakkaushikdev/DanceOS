"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EnqFace } from "@/features/enquiries/components/enquiry-kit";
import { Eyebrow, Surface } from "@/features/inbox/components/inbox-kit";
import { PeoplePicker } from "@/features/people/components/PeoplePicker";
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
  const run = async (fn: () => Promise<JobActionResult>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return false;
    }
    router.refresh();
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
}: {
  enquiryId: string;
  job: EnquiryJob;
  canWork: boolean;
  /** the business's own people, offered as Team */
  team: TeamPick[];
  tint: string;
}) {
  const { busy, error, run } = useRun();
  const [role, setRole] = useState("");
  const [adding, setAdding] = useState<EnquiryPersonKind | null>(null);
  if (!job.available) return <Off />;

  const on = new Set(job.people.map((p) => p.userId));
  const freeTeam = team.filter((t) => !on.has(t.userId));
  const groups: EnquiryPersonKind[] = ["team", "participant"];

  const add = async (userId: string, kind: EnquiryPersonKind) => {
    const ok = await run(() => addEnquiryPersonAction({ enquiryId, userId, kind, role: role.trim() || null }));
    if (ok) {
      setRole("");
      setAdding(null);
    }
  };

  return (
    <div data-testid="enquiry-team">
      {groups.map((k) => {
        const rows = job.people.filter((p) => p.kind === k);
        return (
          <Surface key={k}>
            <Eyebrow tint={k === "team" ? tint : undefined}>{`${k === "team" ? "TEAM" : "PARTICIPANTS"} · ${rows.length}`}</Eyebrow>
            {rows.length === 0 ? <div style={{ fontSize: 12, color: "var(--sub)" }}>{k === "team" ? "Nobody yet." : "None yet."}</div> : null}
            {rows.map((p) => (
              <div key={p.id} data-testid="enquiry-person" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1.5px solid var(--el)" }}>
                <EnqFace path={p.photoPath} name={p.name} size={34} tint={tint} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--sub)" }}>{p.role ?? ENQ_PERSON_WORD[p.kind]}</div>
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
                {canWork ? (
                  <button type="button" disabled={busy} aria-label={`Remove ${p.name}`} onClick={() => void run(() => removeEnquiryPersonAction({ enquiryId, personId: p.id }))} style={{ ...ghost, padding: "6px 10px", fontSize: 11 }}>
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            {canWork ? (
              adding === k ? null : (
                <button type="button" onClick={() => setAdding(k)} style={{ ...ghost, marginTop: 10, width: "100%" }}>
                  {k === "team" ? "+ Add team" : "+ Add participant"}
                </button>
              )
            ) : null}
            {canWork && adding === k ? (
              <div style={{ marginTop: 10 }}>
                <label style={label} htmlFor={`role-${k}`}>
                  ROLE
                </label>
                <input id={`role-${k}`} value={role} maxLength={40} onChange={(ev) => setRole(ev.target.value)} placeholder={k === "team" ? "Lead choreographer" : "Dancer"} aria-label="Role" style={{ ...field, marginBottom: 9 }} />
                {k === "team" ? (
                  freeTeam.length ? (
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
                  )
                ) : (
                  <PeoplePicker
                    actionWord="Add ›"
                    actionColor={tint}
                    exclude={[...on]}
                    onPick={(p) => void add(p.id, "participant")}
                    pickLabel={(p) => `Add ${p.fullName} as a participant`}
                  />
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
}: {
  enquiryId: string;
  job: EnquiryJob;
  canWork: boolean;
  closed: boolean;
  nowIso: string;
  tint: string;
  /** whose job it is — the card leads with it */
  hostName: string;
  hostPhotoPath: string | null;
  typeKey: string | null;
}) {
  const router = useRouter();
  const { busy, error, run } = useRun();
  const [form, setForm] = useState<null | { practiceId: string | null; date: string; start: string; end: string; place: string; note: string }>(null);
  if (!job.available) return <Off />;

  const coming = job.practices.filter((p) => p.endsAt >= nowIso);
  const past = job.practices.filter((p) => p.endsAt < nowIso);

  const save = async () => {
    if (!form) return;
    const ok = await run(() =>
      saveEnquiryPracticeAction({ enquiryId, practiceId: form.practiceId, date: form.date, start: form.start, end: form.end, place: form.place, note: form.note.trim() || null }),
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
          practice={{
            id: p.id,
            enquiryId,
            startsAt: p.startsAt,
            endsAt: p.endsAt,
            place: p.place,
            note: p.note,
            status: p.status,
            hostName,
            hostPhotoPath,
            typeKey,
            myPart: canWork ? "runs" : "team",
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
      {canWork && !closed && !form ? (
        <button type="button" onClick={() => setForm({ practiceId: null, date: istDayKey(nowIso), start: "18:00", end: "19:00", place: "", note: "" })} style={{ ...pill, width: "100%", padding: 12, marginBottom: 10 }}>
          + Add practice
        </button>
      ) : null}
      {form ? (
        <Surface tint={tint}>
          <Eyebrow tint={tint}>{form.practiceId ? "EDIT PRACTICE" : "NEW PRACTICE"}</Eyebrow>
          <label style={label} htmlFor="ep-date">
            DATE
          </label>
          <input id="ep-date" type="date" value={form.date} onChange={(ev) => setForm({ ...form, date: ev.target.value })} style={{ ...field, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={label} htmlFor="ep-start">
                STARTS
              </label>
              <input id="ep-start" type="time" value={form.start} onChange={(ev) => setForm({ ...form, start: ev.target.value })} style={field} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label} htmlFor="ep-end">
                ENDS
              </label>
              <input id="ep-end" type="time" value={form.end} onChange={(ev) => setForm({ ...form, end: ev.target.value })} style={field} />
            </div>
          </div>
          <label style={label} htmlFor="ep-place">
            WHERE
          </label>
          <input id="ep-place" value={form.place} maxLength={120} onChange={(ev) => setForm({ ...form, place: ev.target.value })} placeholder="Studio A" style={{ ...field, marginBottom: 8 }} />
          <label style={label} htmlFor="ep-note">
            NOTE
          </label>
          <input id="ep-note" value={form.note} maxLength={280} onChange={(ev) => setForm({ ...form, note: ev.target.value })} placeholder="Optional" style={{ ...field, marginBottom: 10 }} />
          <div style={{ display: "flex", gap: 7 }}>
            <button type="button" onClick={() => setForm(null)} style={{ ...ghost, flex: 1 }}>
              Cancel
            </button>
            <button type="button" disabled={busy || !form.place.trim()} onClick={() => void save()} style={{ ...pill, flex: 1.5 }}>
              {form.practiceId ? "Save" : "Add practice"}
            </button>
          </div>
          <Err text={error} />
        </Surface>
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
  if (!available) return <Off />;

  const add = async () => {
    const ok = await run(() => addEnquiryFileAction({ enquiryId, kind, label: name.trim(), url: url.trim() }));
    if (ok) {
      setName("");
      setUrl("");
    }
  };

  return (
    <div data-testid="enquiry-files">
      {!closed ? (
        <Surface tint={tint}>
          <Eyebrow tint={tint}>ADD A LINK</Eyebrow>
          <div role="group" aria-label="What kind of link" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
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
          <label style={label} htmlFor="ef-name">
            NAME
          </label>
          <input id="ef-name" value={name} maxLength={80} onChange={(ev) => setName(ev.target.value)} placeholder="Final mix" style={{ ...field, marginBottom: 8 }} />
          <label style={label} htmlFor="ef-url">
            LINK
          </label>
          <input id="ef-url" type="url" inputMode="url" value={url} maxLength={600} onChange={(ev) => setUrl(ev.target.value)} placeholder="https://…" style={{ ...field, marginBottom: 10 }} />
          <button type="button" disabled={busy || !name.trim() || !url.trim()} onClick={() => void add()} style={{ ...pill, width: "100%", padding: 11 }}>
            Add link
          </button>
          <Err text={error} />
        </Surface>
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
