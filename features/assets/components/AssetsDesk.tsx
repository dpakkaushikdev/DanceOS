"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { FigureHead } from "@/components/ui/FigureHead";
import { PhotoLightbox } from "@/features/media/components/PhotoLightbox";
import { photoUrl } from "@/lib/media/photo";
import { DeskBody, DeskTop } from "@/components/ui/DeskSections";
import { ToolActions, ToolBody, ToolCard, ToolFacts, ToolHead, toolBtn } from "@/components/ui/ToolCard";
import { DeleteIcon } from "@/components/ui/DeleteIconButton";
import { removeAssetAction } from "@/features/assets/server-actions/assets";
import { DOS_TOOLS, DeskHero } from "@/features/businesses/components/biz-kit";
import { toast } from "@/components/ui/Toast";
import { DeskAddButton, eyebrow, rupees } from "@/features/settings/components/settings-kit";
import { DOS_UI, INK, LILAC, SUB } from "@/lib/design/tokens";
import { assetCategoryWords, type Asset } from "@/repositories/assets";

/** ASSETS — what a business owns and what it is worth (21 Sep 2026, the user:
 *  "Fix assets for both artist, studio and organization. Make sure to just add
 *  name type of asset and price/ Old asset").
 *
 *  The prototype's S_assets (16791) lifted, and the user's "just" honoured: an
 *  asset is a name, the TYPE from a closed list, and a value — and, since 4 Oct
 *  2026, how many. ⚠ The fields are `AssetForm`, opened over this desk at
 *  `?new=1` since 22 Sep 2026, and at `?edit={asset}` since 4 Oct 2026.
 *
 *  ⚠ "₹0 = OLD ASSET" IS THE PRICE FIELD, not a second control. The prototype's
 *  own placeholder is `₹ (0 = old)` and its row prints "₹0 (legacy)" (16792,
 *  16812) — so an asset the business already had is a value of zero, said in
 *  words on the row. A checkbox beside the number would be the same fact twice
 *  and the two could disagree.
 *
 *  ⚠ AND THE TOTAL IS COUNTED, NEVER STORED — the prototype prints
 *  "INVENTORY · ₹1,72,500 total" over the very rows it adds up, which is Step
 *  25's rule: a figure and the list behind it are the same number.
 *
 *  ⚠⚠ NOTHING IS EDITED ON THE CARD (4 Oct 2026, the user: "edit should not open
 *  like a collapse should only be editable from the form"). Edit used to fold
 *  three inputs, a type picker and a picture picker open under the card; it is a
 *  link to the form now, prefilled, where the picture is changed too. And the
 *  line under the heading ("What {business} owns") is gone (the user: "remove
 *  text between heading and add asset button"). */

const card: CSSProperties = { background: "var(--card)", border: "1.5px solid var(--el)", borderRadius: 16, padding: "13px 14px", marginBottom: 10 };

/** the prototype's own money grammar for this screen: a real value, or the words
 *  that say it is one the business already had (16812) */
const valueWords = (n: number) => (n > 0 ? rupees(n) : "₹0 (Old)");

/** the Assets tool's own colour — the card's face, wash and figures */
const TINT = DOS_TOOLS.assets.c;

/* ⚠ `businessName` stays on the prop and is no longer drawn (4 Oct 2026) — the
   one line that printed it is what the user asked to remove */
export function AssetsDesk({ businessId, assets }: { businessId: string; businessName?: string; assets: Asset[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  /* ⚠ "REMOVED · UNDO" (28 Oct 2026, batch 3): the card goes on the press and
     the real delete runs when the undo window closes; a refusal puts it back.
     (It asked in a dialog from 4 Oct.) An id stays hidden after a successful
     delete — the server's next list no longer carries it anyway. */
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const hide = (id: string, on: boolean) =>
    setHidden((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const shown = assets.filter((a) => !hidden.has(a.id));

  const total = shown.reduce((n, a) => n + a.valueInr, 0);
  const pieces = shown.reduce((n, a) => n + a.quantity, 0);

  const [viewing, setViewing] = useState<Asset | null>(null);
  const viewSrc = viewing ? photoUrl(viewing.photoPath) : null;

  const drop = (a: Asset) => {
    hide(a.id, true);
    toast.undo(
      "Asset removed",
      () => {
        void removeAssetAction({ assetId: a.id, businessId }).then((out) => {
          if (out.error) {
            hide(a.id, false);
            toast.error(out.error);
            return;
          }
          start(() => router.refresh());
        });
      },
      () => hide(a.id, false),
    );
  };

  return (
    <div style={{ background: LILAC, color: INK, maxWidth: 430, margin: "0 auto", fontFamily: DOS_UI, minHeight: "100vh", padding: "0 var(--dos-gutter) 40px", boxSizing: "border-box" }}>
      <DeskTop>
        {/* ⚠ THE TOP SECTION (3 Oct 2026, C116) — the hero and Add */}
        <DeskHero tool="assets" as="h1" margin="0 0 12px" />
        {/* ⚠ "Add Asset", capital A (4 Oct 2026, the user) */}
        <DeskAddButton label="Add Asset" href="?new=1" />
        {/* ⚠ THE FIGURES ARE PART OF THE TOP SECTION (12 Oct 2026, the user: "the
            middle section … should be merged with the top section and should not
            shrink on changing view to list"). COUNTED off the very cards below,
            never stored (Step 25's rule). */}
        <ToolFacts
          tint={TINT}
          style={{ marginTop: 12 }}
          items={[
            { label: shown.length === 1 ? "Asset" : "Assets", value: shown.length, testId: "assets-count" },
            { label: pieces === 1 ? "Item" : "Items", value: pieces, testId: "assets-items" },
            { label: "Total value", value: rupees(total), testId: "assets-total" },
          ]}
        />
      </DeskTop>

      {/* ⚠ THE LOWER SECTION — a card per asset, its picture as the card's face */}
      <DeskBody head={<FigureHead margin="0 0 8px" title={<span style={eyebrow}>INVENTORY</span>} />}>
        {shown.map((a) => (
          /* the app's one card: the picture in its squircle and the name at a
             profile's size, its type over it; how many and what it is worth as
             figures; Edit and Remove on a bar of their own */
          <ToolCard key={a.id} testId="asset-row">
            <ToolHead
              tint={TINT}
              name={a.name}
              photoPath={a.photoPath}
              eyebrow={assetCategoryWords(a.category)}
              icon={<span aria-hidden="true" style={{ fontSize: 24 }}>📦</span>}
              /* ⚠ THE PICTURE OPENS ITSELF (4 Oct 2026, the user: "clicking on asset
                 photo on asset card should open asset photo") — only when there is one */
              onFace={a.photoPath ? () => setViewing(a) : () => router.push(`?edit=${a.id}`, { scroll: false })}
              /* ⚠ A TAP ALWAYS ANSWERS (4 Oct 2026, the user: "asset picture tap not
                 working") — their assets had no picture stored, so the face was not
                 a button and the tap did nothing; without one it opens the form
                 where a picture is added */
              faceLabel={a.photoPath ? `View the picture of ${a.name}` : `Add a picture of ${a.name}`}
            />
            <ToolBody>
              <ToolFacts
                tint={TINT}
                items={[
                  /* ⚠ QUANTITY ON THE CARD (4 Oct 2026, the user: "should also be visible on card") */
                  { label: "Quantity", value: a.quantity, testId: "asset-quantity" },
                  /* ⚠ "Amount", the form's word since 4 Oct 2026, and "₹0 (Old)" for
                     one already had (the user: "should say Old in place of (Legacy)") */
                  { label: "Amount", value: valueWords(a.valueInr), testId: "asset-value", tint: a.valueInr > 0 ? undefined : SUB },
                ]}
              />
            </ToolBody>
            <ToolActions>
              <Link href={`?edit=${a.id}`} scroll={false} aria-label={`Edit ${a.name}`} style={{ ...toolBtn("tinted", TINT), textDecoration: "none" }}>
                Edit
              </Link>
              {/* ⚠ THE APP'S ONE DELETE (18 Oct 2026): last on the bar, asking in
                  the shared dialog — it was the one card that asked in a sheet */}
              <DeleteIcon label={`Remove ${a.name}`} disabled={pending} onClick={() => drop(a)} />
            </ToolActions>
          </ToolCard>
        ))}

        {shown.length === 0 ? (
          <div style={{ ...card, textAlign: "center", fontSize: 12, color: SUB, border: "1.5px dashed var(--el)", lineHeight: 1.5 }}>
            Nothing on the inventory yet. Put ₹0 on something you already had.
          </div>
        ) : null}
      </DeskBody>

      {/* the asset's picture, in the disc crop it was cut in */}
      {viewing && viewSrc ? (
        <PhotoLightbox shots={[{ key: viewing.id, src: viewSrc, alt: viewing.name, signed: false }]} frame="disc" index={0} onIndex={() => {}} onClose={() => setViewing(null)} label={viewing.name} />
      ) : null}
    </div>
  );
}
