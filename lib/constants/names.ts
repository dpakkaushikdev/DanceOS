import { z } from "zod";

/** ⚠ EVERY NAME IS AT MOST 15 CHARACTERS (18 Oct 2026, the user: "fix word limit
 *  for all kinds of names and should not be more than 15 letters in any case").
 *
 *  One number, read by every form's `maxLength` and every server action's
 *  schema, so a field and the rule behind it cannot disagree. Spaces count —
 *  `maxLength` counts them too, and a limit the box and the server measure
 *  differently is a box that accepts what Save then refuses.
 *
 *  It covers what somebody NAMES: a person, a studio, a crew, a room, an asset,
 *  a membership, a routine, a walk-in, a student and a team invite. Names already
 *  stored longer are kept; they are refused only when somebody saves them again. */
export const NAME_MAX = 15;

export const nameWords = `${NAME_MAX} characters at most`;

/** a required name, trimmed, ≤ NAME_MAX */
export const nameField = (empty: string) =>
  z.string().trim().min(1, empty).max(NAME_MAX, `Keep the name to ${nameWords}`);
