import { Customization } from "../types";

/**
 * Copy printed on the two faces of the member card.
 *
 * The labels live in the customization row so an admin can change them once
 * and have every rendered card (portal preview, SVG/PDF downloads, member
 * page) pick them up. The table predates this editor, so the six label slots
 * reuse the retired feature-strip columns — that strip was removed from the
 * product, leaving those columns unused. Keeping the mapping in one place
 * means the UI, the React card and the exporters all agree.
 */
export interface CardLabels {
  /** Prefix before the brand on the front headline ("THE"). */
  frontTitle: string;
  /** Second line of the front headline, also the gold caption ("DISCOUNT CARD"). */
  frontSubtitle: string;
  /** First line of the back headline ("SCAN"). */
  backTitle: string;
  /** Second line of the back headline ("TO SAVE"). */
  backSubtitle: string;
  /** Helper sentence under the back headline. */
  backHelp: string;
  /** Small label above the expiry date ("EXPIRES"). */
  backExpiryLabel: string;
}

export const DEFAULT_CARD_LABELS: CardLabels = {
  frontTitle: "THE",
  frontSubtitle: "DISCOUNT CARD",
  backTitle: "SCAN",
  backSubtitle: "TO SAVE",
  backHelp: "Scan the QR code to check where the card can be used",
  backExpiryLabel: "EXPIRES",
};

/** Label key -> customization column used to persist it. */
const LABEL_COLUMNS: Record<keyof CardLabels, keyof Customization> = {
  frontTitle: "feature1_title",
  frontSubtitle: "feature1_desc",
  backTitle: "feature2_title",
  backSubtitle: "feature2_desc",
  backHelp: "feature3_title",
  backExpiryLabel: "feature3_desc",
};

/**
 * Values the retired feature-strip columns shipped with. They must read as
 * "not customised" so existing rows keep showing the real card copy instead
 * of "Partner Outlets" / "Instant Savings" on the card.
 */
const LEGACY_FEATURE_DEFAULTS = new Set([
  "Partner Outlets",
  "Approved merchants across Kigali offer exclusive member discounts.",
  "Instant Savings",
  "Discounts are computed in real-time at the checkout terminal.",
  "Member Cards",
  "Every member gets unique QR credentials.",
]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Resolve the saved card copy, falling back to the built-in defaults. */
export function resolveCardLabels(
  customization?: Partial<Customization> | null,
): CardLabels {
  const labels = { ...DEFAULT_CARD_LABELS };
  if (!customization) return labels;

  (Object.keys(LABEL_COLUMNS) as (keyof CardLabels)[]).forEach((key) => {
    const saved = clean((customization as Record<string, unknown>)[LABEL_COLUMNS[key]]);
    if (saved && !LEGACY_FEATURE_DEFAULTS.has(saved)) labels[key] = saved;
  });

  return labels;
}

/** Shape a label set for `updateCustomization` (the feature columns). */
export function cardLabelUpdates(labels: CardLabels): Partial<Customization> {
  const updates: Partial<Customization> = {};
  (Object.keys(LABEL_COLUMNS) as (keyof CardLabels)[]).forEach((key) => {
    (updates as Record<string, string>)[LABEL_COLUMNS[key]] = clean(labels[key]);
  });
  return updates;
}
