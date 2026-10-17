"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DELETE_RED, TrashGlyph } from "@/components/ui/trash";

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

export { DELETE_RED, TrashGlyph };

/** ONE SIZE (18 Oct 2026, the user: "fix delete button on all cards or cards
 *  detail pages … make it consistent"): 36px everywhere — last on a card's
 *  action bar, top right in a detail page's head. Callers no longer pass a size. */
export const DELETE_SIZE = 36;

export function DeleteIcon({
  label,
  onClick,
  disabled = false,
  testId,
  style,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  style?: CSSProperties;
}) {
  const size = DELETE_SIZE;
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
        width: size,
        height: size,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        background: "var(--solid)",
        border: `1.5px solid ${DELETE_RED}55`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: "0 2px 8px rgba(0,0,0,.18)",
        ...style,
      }}
    >
      <TrashGlyph size={Math.round(size * 0.46)} />
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
}: {
  label: string;
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
