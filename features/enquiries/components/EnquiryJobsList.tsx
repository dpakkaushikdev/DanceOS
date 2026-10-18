"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToolActions, ToolCard, ToolChip, ToolFacts, ToolHead, toolBtn } from "@/components/ui/ToolCard";
import { respondToEnquiryJobAction } from "@/features/enquiries/server-actions/enquiryTeam";
import { ENQ_PERSON_WORD, ENQ_TINT, enquiryTypeLabel, type EnquiryJobAsk } from "@/types/enquiry";

/** JOBS — the enquiry jobs somebody put you on (18 Oct 2026, `20261025090000`).
 *
 *  An owner names a person on an enquiry's Team; until that person says yes they
 *  are ASKED, are told about no practice and are on no register. This is where
 *  they answer: a card per job, Accept · Decline, Decline asking first. The card
 *  says what was answered at once and the list re-reads after. */

const dayWords = (d: string | null) =>
  d ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00+05:30`)) : "—";

export function EnquiryJobsList({ jobs }: { jobs: EnquiryJobAsk[] }) {
  const router = useRouter();
  const [answered, setAnswered] = useState<Record<string, "joined" | "declined">>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [declining, setDeclining] = useState<EnquiryJobAsk | null>(null);

  const answer = async (j: EnquiryJobAsk, accept: boolean) => {
    setBusy(j.id);
    setErr(null);
    const r = await respondToEnquiryJobAction({ personId: j.id, accept });
    setBusy(null);
    if (r.error) {
      setErr(r.error);
      return false;
    }
    setAnswered((a) => ({ ...a, [j.id]: accept ? "joined" : "declined" }));
    router.refresh();
    return true;
  };

  if (jobs.length === 0 && Object.keys(answered).length === 0) {
    return (
      <div data-testid="enquiry-jobs" style={{ background: "var(--card)", border: "1.5px dashed var(--el)", borderRadius: 16, padding: "22px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800 }}>No jobs yet</div>
        <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 3 }}>When a studio puts you on a booking, it lands here.</div>
      </div>
    );
  }

  return (
    <div data-testid="enquiry-jobs" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {jobs.map((j) => {
        const tint = (j.typeKey && ENQ_TINT[j.typeKey as keyof typeof ENQ_TINT]) || "#8B5CF6";
        const done = answered[j.id];
        const status = done === "joined" ? "confirmed" : j.status;
        const kind = enquiryTypeLabel(j.typeKey) ?? "Enquiry";
        return (
          <ToolCard key={j.id} testId="enquiry-job" dim={done === "declined"}>
            <ToolHead
              tint={tint}
              name={j.hostName}
              photoPath={j.hostPhotoPath}
              eyebrow={`${kind} · ${ENQ_PERSON_WORD[j.kind]}`}
              sub={j.role ? `As ${j.role}` : `On the ${ENQ_PERSON_WORD[j.kind].toLowerCase()}`}
              right={
                <span data-testid="enquiry-job-status" data-status={done === "declined" ? "declined" : status}>
                  {done === "declined" ? (
                    <ToolChip word="DECLINED" fg="var(--sub)" bg="var(--el)" />
                  ) : status === "confirmed" ? (
                    <ToolChip word="ON IT" fg="#15803D" bg="#22C55E22" />
                  ) : (
                    <ToolChip word="ASKED" fg="#B45309" bg="#F59E0B22" />
                  )}
                </span>
              }
            />
            <div style={{ padding: "10px 14px 12px", borderTop: "1.5px solid var(--el)" }}>
              <ToolFacts
                tint={tint}
                items={[
                  { label: "Role", value: j.role ?? ENQ_PERSON_WORD[j.kind] },
                  { label: "Kind", value: kind },
                  { label: "Date", value: dayWords(j.firstDate) },
                ]}
              />
            </div>
            <ToolActions>
              {done === "declined" ? (
                <span style={{ fontSize: 11.5, color: "var(--sub)", fontWeight: 700 }}>Declined — {j.hostName} has been told</span>
              ) : status === "asked" ? (
                <>
                  <button type="button" disabled={busy === j.id} aria-label={`Decline the job with ${j.hostName}`} onClick={() => setDeclining(j)} style={toolBtn("secondary", tint)}>
                    Decline
                  </button>
                  <button type="button" disabled={busy === j.id} aria-label={`Accept the job with ${j.hostName}`} onClick={() => void answer(j, true)} style={toolBtn("primary", tint)}>
                    Accept
                  </button>
                </>
              ) : (
                <Link href="/practice?type=enquiry" aria-label={`The practices for the job with ${j.hostName}`} style={toolBtn("secondary", tint)}>
                  Practices ›
                </Link>
              )}
            </ToolActions>
          </ToolCard>
        );
      })}
      {err && !declining ? (
        <div role="alert" style={{ fontSize: 11.5, color: "#F87171", marginTop: 8 }}>
          {err}
        </div>
      ) : null}
      {declining ? (
        <ConfirmDialog
          title="Decline this job?"
          body={`${declining.hostName} is told you said no.`}
          goWord="Decline"
          busy={busy === declining.id}
          err={err}
          onKeep={() => {
            setDeclining(null);
            setErr(null);
          }}
          onGo={() => {
            const j = declining;
            void answer(j, false).then((ok) => {
              if (ok) setDeclining(null);
            });
          }}
        />
      ) : null}
    </div>
  );
}
