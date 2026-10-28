"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { postSupportMessageAction, setSupportThreadStatusAction } from "@/features/support/server-actions/support";
import { toast } from "@/components/ui/Toast";
import { DOS_UI, INK, LILAC, SUB } from "@/lib/design/tokens";
import type { SupportMessage, SupportThread } from "@/repositories/support";
import { agoWords } from "@/types/notification";
import { DeskTop } from "@/components/ui/DeskSections";
import { toolBtn } from "@/components/ui/ToolCard";
import { HueHead } from "@/features/businesses/components/biz-kit";

const CARD = "var(--card)";
const EL = "var(--el)";
const MUTED = "var(--muted)";

/** ONE CONVERSATION, both sides (10 Sep 2026). The same component serves the
 *  account at /support/[id] and the admin at /admin/support/[id]: what differs
 *  is only which side of the thread is "mine" and whether the Close control is
 *  drawn. The transcript reads DanceOS on one side and the account on the
 *  other from `fromAdmin`, which the database stamped when each message was
 *  written — so an admin who is later removed does not turn their old replies
 *  into somebody else's.
 *
 *  A verification thread carries a line back to the decision it is about, so
 *  "why was I rejected" is answered in the place the rejection was said. */
export function SupportConversation({
  thread,
  messages,
  isAdmin,
  nowIso,
}: {
  thread: SupportThread;
  messages: SupportMessage[];
  /** the viewer is a platform admin: their messages are the DanceOS side */
  isAdmin: boolean;
  nowIso: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const foot = useRef<HTMLDivElement | null>(null);

  /* a transcript is read from the bottom — the newest line is the point */
  useEffect(() => {
    foot.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    start(async () => {
      const out = await postSupportMessageAction({ threadId: thread.id, body });
      if (out.error) return void toast.error(out.error);
      toast("Message sent");
      setDraft("");
      router.refresh();
    });
  };

  const setStatus = (status: "open" | "closed") =>
    start(async () => {
      const out = await setSupportThreadStatusAction({ threadId: thread.id, status });
      if (out.error) return void toast.error(out.error);
      toast(status === "closed" ? "Conversation closed" : "Reopened");
      router.refresh();
    });

  const closed = thread.status === "closed";
  const back = isAdmin ? "/admin/support" : "/support";

  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", paddingBottom: "var(--dos-foot, 40px)" }}>
      <div style={{ padding: "14px var(--dos-gutter) 0" }}>
        {/* who this is with, and what it is about */}
        {/* the page's own `<h1>` — the chrome no longer prints a drill page's name
            (28 Sep 2026). A conversation's name IS its subject, which is why the
            subject is the heading rather than the word "Conversation". The one
            heading standard (DeskTop + HueHead, 28 Oct 2026); who it is with
            leads the line under it. */}
        <DeskTop style={{ margin: "0 0 12px" }}>
          <HueHead
            title={thread.subject}
            color="#0EA5E9"
            bottom="4px"
            sub={
              <>
                {isAdmin ? thread.accountName : "DanceOS support"} · {closed ? "closed" : "open"} · started {agoWords(thread.createdAt, nowIso)}
                {thread.kind === "verification" ? " · about your verification" : ""}
              </>
            }
          />
        </DeskTop>

        {thread.kind === "verification" && thread.requestId ? (
          <Link href={isAdmin ? "/admin/verifications" : "/business"} style={{ display: "block", background: CARD, border: `1.5px solid ${EL}`, borderLeft: "4px solid #F59E0B", borderRadius: 14, padding: "10px 12px", marginBottom: 12, textDecoration: "none", color: INK }}>
            <div style={{ fontSize: 11.5, fontWeight: 800 }}>This is about a verification decision</div>
            <div style={{ fontSize: 10.5, color: SUB, marginTop: 2 }}>{isAdmin ? "Open the verification queue ›" : "See where your studio stands ›"}</div>
          </Link>
        ) : null}

        {/* ── the transcript ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {messages.map((m) => {
            const mine = m.fromAdmin === isAdmin;
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "84%", borderRadius: 16, padding: "9px 12px", background: mine ? "var(--text)" : CARD, color: mine ? "var(--solid)" : INK, border: mine ? "none" : `1.5px solid ${EL}` }}>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, opacity: 0.7, marginBottom: 3 }}>
                    {m.fromAdmin ? "DANCEOS" : isAdmin ? thread.accountName.toUpperCase() : "YOU"}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                  <div style={{ fontSize: 9.5, opacity: 0.6, marginTop: 4 }}>{agoWords(m.createdAt, nowIso)}</div>
                </div>
              </div>
            );
          })}
          <div ref={foot} />
        </div>

        {/* ── the reply box ── */}
        {closed && !isAdmin ? (
          <div style={{ background: CARD, border: `1.5px solid ${EL}`, borderRadius: 14, padding: "11px 13px", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: SUB, lineHeight: 1.55 }}>
              DanceOS closed this conversation. Write again below and it reopens.
            </div>
          </div>
        ) : null}
        <label htmlFor="support-reply" style={{ display: "block", fontSize: 9.5, fontWeight: 900, letterSpacing: 1, color: MUTED, margin: "2px 0 6px" }}>
          YOUR REPLY
        </label>
        <textarea
          id="support-reply"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
          rows={4}
          placeholder={isAdmin ? `Reply to ${thread.accountName}…` : "Write to DanceOS…"}
          style={{ width: "100%", boxSizing: "border-box", background: CARD, border: `1.5px solid ${EL}`, borderRadius: 14, padding: "11px 12px", fontSize: 13, color: INK, fontFamily: "inherit", resize: "vertical", lineHeight: 1.55 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={send}
            style={toolBtn("primary", "#0EA5E9", { minWidth: 130, minHeight: 42, opacity: draft.trim() ? 1 : 0.5, cursor: draft.trim() ? "pointer" : "default" })}
          >
            {pending ? "Sending…" : "Send"}
          </button>
          {isAdmin ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus(closed ? "open" : "closed")}
              style={toolBtn("secondary", "#0EA5E9", { flex: "0 0 auto", minHeight: 42 })}
            >
              {closed ? "Reopen" : "Close"}
            </button>
          ) : null}
          <Link href={back} style={toolBtn("secondary", "#0EA5E9", { flex: "0 0 auto", minHeight: 42 })}>
            All conversations
          </Link>
        </div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 6 }}>{draft.length} / 4000</div>
      </div>

    </div>
  );
}
