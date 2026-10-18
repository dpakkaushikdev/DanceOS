"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EnqFace } from "@/features/enquiries/components/enquiry-kit";
import { Eyebrow, Surface } from "@/features/inbox/components/inbox-kit";
import { PeoplePicker } from "@/features/people/components/PeoplePicker";
import {
  addEnquiryPersonAction,
  cancelEnquiryPracticeAction,
  checkInEnquiryPracticeAction,
  removeEnquiryPersonAction,
  saveEnquiryPracticeAction,
  type JobActionResult,
} from "@/features/enquiries/server-actions/enquiryTeam";
import { ENQ_PERSON_WORD, istDayKey, type EnquiryJob, type EnquiryPersonKind } from "@/types/enquiry";

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
}: {
  enquiryId: string;
  job: EnquiryJob;
  canWork: boolean;
  closed: boolean;
  nowIso: string;
  tint: string;
}) {
  const { busy, error, run } = useRun();
  const [form, setForm] = useState<null | { practiceId: string | null; date: string; start: string; end: string; place: string; note: string }>(null);
  const [openReg, setOpenReg] = useState<string | null>(null);
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

  const card = (p: EnquiryJob["practices"][number]) => {
    const off = p.status === "cancelled";
    const reg = openReg === p.id;
    return (
      <div key={p.id} data-testid="enquiry-practice" style={{ padding: "10px 0", borderBottom: "1.5px solid var(--el)", opacity: off ? 0.6 : 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <b style={{ fontSize: 13, textDecoration: off ? "line-through" : "none" }}>{dayOf(p.startsAt)}</b>
          <span style={{ fontSize: 12, color: "var(--sub)" }}>
            {clockOf(p.startsAt)}–{clockOf(p.endsAt)}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 900, color: off ? "#F87171" : tint }}>{off ? "CALLED OFF" : `${p.checkedIn.length}/${job.people.length} IN`}</span>
        </div>
        <div style={{ fontSize: 12, marginTop: 2 }}>{p.place}</div>
        {p.note ? <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 2 }}>{p.note}</div> : null}
        {canWork && !off ? (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button type="button" onClick={() => setOpenReg(reg ? null : p.id)} aria-expanded={reg} style={{ ...pill, padding: "6px 11px", fontSize: 11 }}>
              Register
            </button>
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
              style={{ ...ghost, padding: "6px 11px", fontSize: 11 }}
            >
              Edit
            </button>
            <button type="button" disabled={busy} onClick={() => void run(() => cancelEnquiryPracticeAction({ enquiryId, practiceId: p.id }))} style={{ ...ghost, padding: "6px 11px", fontSize: 11, color: "#F87171" }}>
              Call off
            </button>
          </div>
        ) : null}
        {reg ? (
          <div data-testid="enquiry-register" style={{ marginTop: 8 }}>
            {job.people.length === 0 ? <div style={{ fontSize: 11.5, color: "var(--sub)" }}>Add people in Team first.</div> : null}
            {job.people.map((person) => {
              const isIn = p.checkedIn.includes(person.userId);
              return (
                <div key={person.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0" }}>
                  <EnqFace path={person.photoPath} name={person.name} size={26} tint={tint} />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700 }}>{person.name}</span>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={isIn}
                    aria-label={`${isIn ? "Undo" : "Check in"} ${person.name}`}
                    onClick={() => void run(() => checkInEnquiryPracticeAction({ enquiryId, practiceId: p.id, userId: person.userId, on: !isIn }))}
                    style={{ ...(isIn ? { ...pill, background: "#22C55E", color: "#07240F" } : ghost), padding: "5px 11px", fontSize: 11 }}
                  >
                    {isIn ? "✓ In" : "Check in"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
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
