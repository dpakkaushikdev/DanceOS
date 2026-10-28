"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelCrewPracticeAction, setPracticeAttendanceAction } from "@/features/crews/server-actions/practices";
import { DeleteIconButton } from "@/components/ui/DeleteIconButton";
import { checkInEnquiryPracticeAction } from "@/features/enquiries/server-actions/enquiryTeam";
import { photoUrl } from "@/lib/media/photo";
import { CrewFace } from "./crew-kit";
import { toast } from "@/components/ui/Toast";

/** THE REGISTER ON A PRACTICE'S OWN PAGE (18 Oct 2026) — `/practice/crew/{id}`
 *  and `/practice/job/{id}` draw the same rows: a face, a name, what they are to
 *  it, and Check in / ✓ In. It is the crew desk's register row, lifted out so the
 *  two kinds of practice are run the same way; what differs is only the write. The
 *  database decides who may press it (`check_in_practice` / the enquiry check-in
 *  both re-check the runner), so the page draws it only for the runner and the
 *  write refuses anybody else in words. */

export interface RegisterRow {
  userId: string;
  fullName: string;
  avatarPath: string | null;
  /** what they are to the practice — "Leader", "Your crew", "Participant" */
  sub: string;
  subTint: string;
  present: boolean;
}

/** CALL OFF, ON A CREW PRACTICE'S OWN PAGE (18 Oct 2026) — the leader's, beside
 *  the register; `cancel_crew_practice` refuses anybody else in words */
export function PracticeCallOff({ practiceId, crewId, when }: { practiceId: string; crewId: string; when: string }) {
  const router = useRouter();
  return (
    <DeleteIconButton
      label={`Call off ${when}`}
      title="Call off this practice?"
      body={`${when} — the crew is told.`}
      goWord="Call it off"
      word="Call off"
      onConfirm={async () => {
        const r = await cancelCrewPracticeAction({ practiceId, crewId });
        if (r.error) return r.error;
        router.refresh();
        return null;
      }}
    />
  );
}

export type RegisterTarget = { kind: "crew"; practiceId: string; crewId: string } | { kind: "enquiry"; practiceId: string; enquiryId: string };

export function PracticeRegister({ rows: initial, target, tint, locked = false }: { rows: RegisterRow[]; target: RegisterTarget; tint: string; locked?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [, start] = useTransition();

  const mark = (userId: string, present: boolean) => {
    start(async () => {
      const r =
        target.kind === "crew"
          ? await setPracticeAttendanceAction({ practiceId: target.practiceId, userId, present, crewId: target.crewId })
          : await checkInEnquiryPracticeAction({ enquiryId: target.enquiryId, practiceId: target.practiceId, userId, on: present });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setRows((p) => p.map((x) => (x.userId === userId ? { ...x, present } : x)));
      toast(present ? "Checked in" : "Taken off attendance");
      router.refresh();
    });
  };

  const inCount = rows.filter((r) => r.present).length;
  return (
    <div data-testid="practice-register">
      <div data-testid="practice-register-count" style={{ fontSize: 11, fontWeight: 900, color: "var(--sub)", marginBottom: 6 }}>
        {inCount} of {rows.length} checked in
      </div>
      {rows.length === 0 ? <div style={{ fontSize: 11.5, color: "var(--muted)", padding: "8px 0" }}>Nobody on it yet.</div> : null}
      {rows.map((m) => (
        <div key={m.userId} data-testid="practice-register-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
          {m.avatarPath ? (
            <Image src={photoUrl(m.avatarPath) as string} alt="" width={36} height={36} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} unoptimized />
          ) : (
            <CrewFace name={m.fullName} size={36} grad={[tint, tint]} radius={11} />
          )}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.fullName}</span>
            <span style={{ display: "block", fontSize: 10, color: m.subTint, marginTop: 1, fontWeight: 800 }}>{m.sub}</span>
          </span>
          {locked ? (
            <span style={{ fontSize: 11, fontWeight: 900, color: m.present ? tint : "var(--muted)" }}>{m.present ? "✓ In" : "—"}</span>
          ) : (
            <button
              type="button"
              onClick={() => mark(m.userId, !m.present)}
              aria-pressed={m.present}
              aria-label={m.present ? `Take ${m.fullName} off the register` : `Check ${m.fullName} in`}
              style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${m.present ? tint : "var(--el)"}`, background: m.present ? tint : "transparent", color: m.present ? "#fff" : "var(--sub)" }}
            >
              {m.present ? "✓ In" : "Check in"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
