"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "@/components/ui/Toast";
import { DragList } from "@/components/ui/DragList";
import { adoptInstagramPhotoAction, disconnectInstagramAction, dismissInstagramPhotoAction } from "@/features/profiles/server-actions/instagram";
import { PLATFORMS, PLATFORM_TINT, handleOf, isPlatform, safeHref, verifiedInstagram } from "@/lib/constants/socials";
import { CARD, INK, LINE, SUB } from "@/lib/design/tokens";
import { FORM_TITLE } from "@/components/ui/formTitle";
import type { SocialLink } from "@/types/profile";
import { useEditMode } from "./EditMode";
import { LINKS_ROW, LinkChipText, linkChip } from "./profile-band";
import { PlatformIcon, Sheet, fieldInput, fieldLabel, sheetBtn } from "./profile-kit";
import { useRecordLists } from "./RecordLists";

/** ONE LINKS ROW, EVERY KIND OF PROFILE (26 Sep 2026).
 *
 *  The user: *"all profiles should have both dance style edits and social media
 *  edit options and option to add multiple."* A studio's row (`StudioLinksRow`,
 *  20 Sep) and a person's (`HomeBand`, 19 Sep) were the same 230 lines with a
 *  different door behind them, and a crew's was about to be the third copy —
 *  this repo's own recurring bill. The row and its one sheet live HERE; what a
 *  caller passes is the list and the DOOR (`save`), which is the only thing that
 *  ever differed.
 *
 *  ⚠ THE ＋ AND THE CHIPS' EDITORS APPEAR WITH THE PENCIL. In read mode a chip
 *  is a link OUT to where it points, exactly as on the public page; while the
 *  home is being edited a chip is a button onto the sheet, opened on that link.
 *
 *  ⚠ ONE SHEET, NOTHING STACKED ON IT (30 Oct 2026, the user: "add a social link
 *  rearrange should be similar to how we do for dance styles and connect
 *  instagram button should be inside this section not outside. when clicking on
 *  a platform opens another part from below so should handle this section
 *  better"). The links DRAG like the styles sheet's rows (`DragList`), a
 *  platform's address is edited IN PLACE under its row or its chip, and Connect
 *  Instagram is the sheet's first block — the chip that stood in the row outside
 *  the pencil is gone. */
/** ⚠ THE LIST IS THE HOME'S, NOT THIS ROW'S (`RecordLists`, 26 Sep 2026). The
 *  contact ⊕ writes the WhatsApp entry into the same `socials` from OUTSIDE
 *  this row, and the styles row beside it sends these links back with every
 *  save of its own. One list on the home, read and adopted by all three. */
/** CONNECT INSTAGRAM (18 Oct 2026) — only a PERSON's own row passes this: the
 *  connection is a person's (`instagram_connections.user_id`), so a studio's
 *  and a crew's rows keep the paste-a-link editor alone. */
export interface InstagramConnectProps {
  /** the username Instagram confirmed for this person, or null */
  connected: string | null;
  /** the word the return from Instagram carried (`?ig=` / `?ig_error=`) */
  returned: { username: string } | { error: string } | null;
  /** Instagram's profile picture, offered as the DanceOS photo straight after a
   *  connect that worked (20 Oct 2026); null when there is nothing to offer */
  photoOffer?: string | null;
}

type Draft = { platform: string; url: string; isNew: boolean };

export function LinksRowEditor({
  canEdit,
  save,
  emptyWords = null,
  instagram = null,
}: {
  canEdit: boolean;
  /** the door: resolves to an error sentence, or null when it landed */
  save: (next: SocialLink[]) => Promise<string | null>;
  /** what an empty row says in read mode, if anything */
  emptyWords?: string | null;
  instagram?: InstagramConnectProps | null;
}) {
  const router = useRouter();
  const { lists, adopt } = useRecordLists();
  const socials = lists.socials;
  const [listOpen, setListOpen] = useState(false);
  /* the one link being typed into, drawn inside the sheet — never a second sheet */
  const [draft, setDraft] = useState<Draft | null>(null);
  const [custom, setCustom] = useState({ label: "", url: "" });
  /* BACK FROM INSTAGRAM: the word the return carried is the first toast */
  const returned = instagram?.returned ?? null;
  const returnedOk = returned && "username" in returned ? `✓ Instagram connected — @${returned.username}` : null;
  const returnedErr = returned && "error" in returned ? returned.error : null;
  const [pending, start] = useTransition();
  const { editing } = useEditMode();
  const canChange = canEdit && editing;
  const ticked = instagram ? verifiedInstagram(socials, instagram.connected) : null;

  /* ...said once, through the global toast, and the word comes off the
     address so a reload does not say it again */
  useEffect(() => {
    if (!returnedOk && !returnedErr) return;
    if (returnedErr) toast.error(returnedErr);
    else toast(returnedOk);
    const url = new URL(window.location.href);
    url.searchParams.delete("ig");
    url.searchParams.delete("ig_error");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [returnedOk, returnedErr]);

  /* "USE YOUR INSTAGRAM PHOTO?" — asked once, on the return from Instagram */
  const [offer, setOffer] = useState<string | null>(instagram?.photoOffer ?? null);
  const takePhoto = () =>
    start(async () => {
      const out = await adoptInstagramPhotoAction();
      if (out.error) return toast.error(out.error);
      setOffer(null);
      router.refresh();
      toast("Your Instagram photo is your profile picture");
    });
  const skipPhoto = () => {
    setOffer(null);
    void dismissInstagramPhotoAction();
  };

  const disconnect = () =>
    start(async () => {
      const out = await disconnectInstagramAction();
      if (out.error) return toast.error(out.error);
      router.refresh();
      toast("Instagram disconnected — the link stays, without the tick");
    });

  const commit = (next: SocialLink[], said: string, after?: () => void) =>
    start(async () => {
      const err = await save(next);
      if (err) {
        toast.error(err);
        return;
      }
      adopt({ ...lists, socials: next });
      after?.();
      toast(said);
    });

  /* a drag is drawn at once and saved behind it — the styles sheet's rule: a
     list that waits for its round trip ignores the next drag (10 Oct 2026) */
  const reorder = (next: SocialLink[]) => {
    const before = socials;
    adopt({ ...lists, socials: next });
    start(async () => {
      const err = await save(next);
      if (err) {
        adopt({ ...lists, socials: before });
        toast.error(err);
        return;
      }
      toast("Order saved");
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    const url = draft.url.trim();
    if (!url) return toast.error("Add a URL first");
    /* the same http(s) rule the database keeps, said before it refuses */
    if (!/^https?:\/\//i.test(url)) return toast.error("A link is a web address — it starts with https://");
    const rest = socials.filter((l) => l.platform !== draft.platform);
    const at = socials.findIndex((l) => l.platform === draft.platform);
    const next = at >= 0 ? [...rest.slice(0, at), { platform: draft.platform, url }, ...rest.slice(at)] : [...rest, { platform: draft.platform, url }];
    commit(next, draft.isNew ? `✓ ${draft.platform} added` : `✓ ${draft.platform} updated`, () => setDraft(null));
  };

  const closeSheet = () => {
    setListOpen(false);
    setDraft(null);
  };

  /* the address box, drawn under the row or the chip it belongs to */
  const draftPanel = (d: Draft) => (
    <div data-testid="link-draft" style={{ marginTop: 8, padding: 12, borderRadius: 14, background: CARD, border: `1.5px solid ${PLATFORM_TINT[d.platform as keyof typeof PLATFORM_TINT] ?? LINE}` }}>
      <div style={{ ...fieldLabel, margin: "0 0 6px" }}>{d.isNew ? `Your ${d.platform}` : `${d.platform} address`}</div>
      <input
        aria-label="URL"
        value={d.url}
        onChange={(e) => setDraft((x) => (x ? { ...x, url: e.target.value } : x))}
        onKeyDown={(e) => {
          if (e.key === "Enter") saveDraft();
        }}
        placeholder="https://…"
        autoFocus
        inputMode="url"
        style={fieldInput}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" onClick={() => setDraft(null)} style={sheetBtn(false)}>Cancel</button>
        <button type="button" disabled={pending} onClick={saveDraft} style={sheetBtn(true)}>{pending ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );

  if (!socials.length && !canChange && !emptyWords && !offer) return null;

  const missing = PLATFORMS.filter((p) => !socials.find((l) => l.platform === p));
  const addingNew = draft?.isNew && !socials.find((l) => l.platform === draft.platform) ? draft : null;

  return (
    <>
      <div style={LINKS_ROW}>
        {socials.map((l) =>
          canChange ? (
            <button
              type="button"
              key={l.platform}
              aria-label={`${l.platform} — ${isPlatform(l.platform) ? handleOf(l.url) : l.platform}`}
              onClick={() => {
                setDraft({ platform: l.platform, url: l.url, isNew: false });
                setListOpen(true);
              }}
              style={linkChip}
            >
              <span style={{ flexShrink: 0, lineHeight: 0 }}>
                <PlatformIcon label={l.platform} size={15} />
              </span>
              <LinkChipText link={l} verifiedInstagram={ticked} />
            </button>
          ) : (
            <a
              key={l.platform}
              href={safeHref(l.url) ?? undefined}
              target="_blank"
              rel="noreferrer"
              aria-label={`${l.platform} — ${isPlatform(l.platform) ? handleOf(l.url) : l.platform}`}
              style={{ ...linkChip, textDecoration: "none" }}
            >
              <span style={{ flexShrink: 0, lineHeight: 0 }}>
                <PlatformIcon label={l.platform} size={15} />
              </span>
              <LinkChipText link={l} verifiedInstagram={ticked} />
            </a>
          )
        )}
        {canChange ? (
          <button
            type="button"
            aria-label="Add a link"
            onClick={() => setListOpen(true)}
            style={{ ...linkChip, background: "transparent", border: "1px dashed var(--el)", fontSize: 12, fontWeight: 800, color: SUB }}
          >
            ＋ Add link
          </button>
        ) : null}
        {!socials.length && !canChange && emptyWords ? <span style={{ fontSize: 11.5, color: SUB, fontWeight: 700 }}>{emptyWords}</span> : null}
      </div>

      {listOpen ? (
        <Sheet label="Add a social link" onClose={closeSheet} maxHeight="86vh">
          <b style={FORM_TITLE}>Social links</b>

          {/* CONNECT INSTAGRAM — inside the section, first (30 Oct 2026). A plain
              link, so the phone can hand instagram.com to the Instagram app
              already signed in on it */}
          {instagram ? (
            ticked ? (
              <div data-testid="instagram-connected" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "11px 13px", borderRadius: 14, background: CARD, border: `1.5px solid ${PLATFORM_TINT.Instagram}` }}>
                <PlatformIcon label="Instagram" size={22} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: INK }}>
                  Connected as <b>@{ticked}</b>
                </span>
                <button type="button" disabled={pending} onClick={disconnect} style={{ fontSize: 12, fontWeight: 800, color: "#EF4444", cursor: "pointer", background: "none", border: "none", fontFamily: "inherit" }}>
                  Disconnect
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/instagram/start"
                data-testid="instagram-connect"
                aria-label="Connect Instagram"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 14, padding: "12px 14px", borderRadius: 14, background: PLATFORM_TINT.Instagram, color: "#fff", fontSize: 14, fontWeight: 800, textDecoration: "none" }}
              >
                <PlatformIcon label="Instagram" size={20} />
                Connect Instagram
              </a>
            )
          ) : null}

          {socials.length ? (
            <>
              <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>Your links</div>
              {/* ⚠ DRAG, NOT ARROWS — the styles sheet's own control */}
              <DragList
                items={socials}
                keyOf={(l) => l.platform}
                nameOf={(l) => l.platform}
                gap={10}
                onReorder={reorder}
                render={(l, grip, dragging) => {
                  const mine = draft && !draft.isNew && draft.platform === l.platform ? draft : null;
                  return (
                    <div data-testid="link-row" style={{ borderRadius: 16, background: "var(--solid)", border: `2px solid ${dragging || mine ? PLATFORM_TINT[l.platform as keyof typeof PLATFORM_TINT] ?? INK : LINE}`, padding: "6px 12px 6px 4px", boxSizing: "border-box" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 46 }}>
                        {grip}
                        <PlatformIcon label={l.platform} size={26} />
                        <button
                          type="button"
                          aria-label={`Edit ${l.platform}`}
                          aria-expanded={!!mine}
                          onClick={() => setDraft(mine ? null : { platform: l.platform, url: l.url, isNew: false })}
                          style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          <b style={{ fontSize: 14.5, color: INK, display: "block" }}>{l.platform}</b>
                          <span style={{ fontSize: 11.5, color: SUB, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {isPlatform(l.platform) ? handleOf(l.url) : l.url}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${l.platform}`}
                          onClick={() => commit(socials.filter((x) => x.platform !== l.platform), `${l.platform} removed`, () => setDraft(null))}
                          style={{ fontSize: 12, fontWeight: 800, color: "#EF4444", cursor: "pointer", flexShrink: 0, background: "none", border: "none", fontFamily: "inherit" }}
                        >
                          Remove
                        </button>
                      </div>
                      {mine ? <div style={{ padding: "0 0 6px 8px" }}>{draftPanel(mine)}</div> : null}
                    </div>
                  );
                }}
              />
            </>
          ) : null}

          {missing.length ? (
            <>
              <div style={{ ...fieldLabel, margin: "18px 0 8px" }}>Add a platform</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {missing.map((p) => {
                  const on = addingNew?.platform === p;
                  return (
                    <button
                      type="button"
                      key={p}
                      aria-label={`Add ${p}`}
                      aria-pressed={on}
                      onClick={() => setDraft(on ? null : { platform: p, url: "", isNew: true })}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, padding: "7px 13px 7px 7px", borderRadius: 999, cursor: "pointer", background: CARD, border: `1.5px solid ${on ? PLATFORM_TINT[p as keyof typeof PLATFORM_TINT] ?? INK : LINE}`, color: INK, fontFamily: "inherit" }}
                    >
                      <PlatformIcon label={p} size={20} />
                      {p}
                    </button>
                  );
                })}
              </div>
              {addingNew ? draftPanel(addingNew) : null}
            </>
          ) : null}

          <div style={{ ...fieldLabel, margin: "18px 0 6px" }}>Something else?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input aria-label="Link label" value={custom.label} onChange={(e) => setCustom((d) => ({ ...d, label: e.target.value }))} placeholder="Label, e.g. Linktree" style={{ ...fieldInput, flex: 1, minWidth: 0, padding: "10px 12px", fontSize: 13 }} />
            <input aria-label="Link URL" value={custom.url} onChange={(e) => setCustom((d) => ({ ...d, url: e.target.value }))} placeholder="https://…" style={{ ...fieldInput, flex: 1, minWidth: 0, padding: "10px 12px", fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="button" onClick={closeSheet} style={sheetBtn(false)}>Close</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!custom.label.trim() || !custom.url.trim()) return toast.error("Add a label and URL first");
                if (!/^https?:\/\//i.test(custom.url.trim())) return toast.error("A link is a web address — it starts with https://");
                commit([...socials, { platform: custom.label.trim(), url: custom.url.trim() }], "✓ Link added", () => setCustom({ label: "", url: "" }));
              }}
              style={sheetBtn(true)}
            >
              Add this link
            </button>
          </div>
        </Sheet>
      ) : null}

      {offer ? (
        <Sheet label="Use your Instagram photo?" onClose={skipPhoto}>
          <b style={FORM_TITLE}>Use your Instagram photo?</b>
          <div style={{ display: "flex", justifyContent: "center", margin: "18px 0 6px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Instagram's CDN address, shown once as a preview; it is stored only on a yes */}
            <img src={offer} alt="Your Instagram profile picture" referrerPolicy="no-referrer" style={{ width: 112, height: 112, borderRadius: "50%", objectFit: "cover", border: `3px solid ${PLATFORM_TINT.Instagram}` }} />
          </div>
          <div style={{ fontSize: 12, color: SUB, fontWeight: 600, textAlign: "center", lineHeight: 1.45 }}>It becomes your DanceOS profile picture. You can change it any time.</div>
          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button type="button" onClick={skipPhoto} style={sheetBtn(false)}>Not now</button>
            <button type="button" disabled={pending} onClick={takePhoto} data-testid="instagram-photo-use" style={sheetBtn(true)}>
              {pending ? "Saving…" : "Use this photo"}
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
