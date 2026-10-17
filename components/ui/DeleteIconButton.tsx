"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DELETE_RED } from "@/components/ui/trash";

/** ONE DELETE, EVERYWHERE (12 Oct 2026, the user: "these types of delete in
 *  sections should look similar and should just be an icon and ask before
 *  deleting always").
 *
 *  A round trash icon in the danger red on the page's solid ground — the same
 *  36px control on a class page, a routine, a membership, an asset, a room, a
 *  student, a team member and a practice. Its accessible name is the act
 *  ("Delete Bollywood · Beginner"), so a screen reader hears what it does.
 *
 *  `DeleteIcon` is only the trigger, for a screen that already owns its question;
 *  `DeleteIconButton` carries the question itself, so a caller cannot forget to
 *  ask: `onConfirm` runs only after "Delete" is pressed in the dialog, and an
 *  error it returns is printed inside that dialog rather than lost. */

export { DELETE_RED };

/** ONE SIZE (18 Oct 2026, the user: "fix delete button on all cards or cards
 *  detail pages … make it consistent"): 36px everywhere — last on a card's
 *  action bar, top right in a detail page's head. Callers no longer pass a size. */
export const DELETE_SIZE = 36;

/** ⚠⚠ A WORD, NOT A TRASH CAN (18 Oct 2026, the user: "delete and remove should
 *  just be delete button to not be trash can … it looks completly off right
 *  now"). A 36px-tall pill reading **Delete** in the danger red on a soft red
 *  wash — the same control everywhere, whether the act removes a room, a
 *  student or a team member. The accessible name still says WHAT goes
 *  ("Remove Studio A"), so every screen reader and locator keeps its meaning. */
export function DeleteIcon({
  label,
  onClick,
  disabled = false,
  testId,
  style,
  word = "Delete",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  style?: CSSProperties;
  /** the visible word — "Delete" everywhere but a practice, which is called off */
  word?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        flex: "0 0 auto",
        height: DELETE_SIZE,
        padding: "0 14px",
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        /* a solid ground, so the word reads on a poster as well as on a card */
        background: `linear-gradient(${DELETE_RED}1f, ${DELETE_RED}1f), var(--solid)`,
        border: "1.5px solid #DC262688",
        boxShadow: "0 2px 8px rgba(0,0,0,.14)",
        /* #DC2626 clears ~4.5:1 on both the light and the dark ground; the lighter
           DELETE_RED was ~2.8:1 on white */
        color: "#DC2626",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 0.1,
        whiteSpace: "nowrap",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {word}
    </button>
  );
}

export function DeleteIconButton({
  label,
  title,
  body,
  goWord = "Delete",
  onConfirm,
  disabled,
  testId,
  style,
  word,
}: {
  label: string;
  word?: string;
  /** the question — "Delete this room?" */
  title: string;
  body?: ReactNode;
  goWord?: string;
  /** the removal; return an error sentence to keep the dialog open with it */
  onConfirm: () => Promise<string | null | void> | string | null | void;
  disabled?: boolean;
  testId?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <DeleteIcon
        label={label}
        testId={testId}
        style={style}
        word={word}
        disabled={disabled || busy}
        onClick={() => {
          setErr(null);
          setOpen(true);
        }}
      />
      {open ? (
        <ConfirmDialog
          title={title}
          body={body}
          goWord={goWord}
          busy={busy}
          err={err}
          onKeep={() => (busy ? undefined : setOpen(false))}
          onGo={async () => {
            if (busy) return;
            setBusy(true);
            setErr(null);
            const out = await onConfirm();
            setBusy(false);
            if (typeof out === "string" && out) {
              setErr(out);
              return;
            }
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
