/**
 * Canonical, JSON-serializable recipe shape for tools, AI, and future authoring.
 * The live app continues to use {@link Recipe} + string ingredient lines; use
 * {@link canonicalToLegacyRecipe} / {@link legacyRecipeToCanonical} to convert.
 */

export interface CanonicalDressingVariant {
  name: string;
  /** Plus-separated or free-text component list */
  recipe: string;
}

export interface CanonicalIngredient {
  /** Exact ingredient line shown in the UI today */
  line: string;
  /** Diet slugs (e.g. vegan, keto) for which this line is omitted when that diet is active */
  omitFor: string[];
}

export interface CanonicalRecipe {
  id: number;
  title: string;
  cuisine: string;
  imageSlug?: string;
  subCuisine?: string;
  flavor: string[];
  season: string[];
  /**
   * Diet slugs this recipe is viable for with current omit rules
   * (same logic as browsing / getRecipeDiets).
   */
  compatibleDiets: string[];
  ingredients: CanonicalIngredient[];
  steps: string[];
  /**
   * Full `Dressing: …` ingredient line when present (includes `//` amount variants).
   * Preserved for lossless round-trip and for parsers that expect the legacy format.
   */
  dressingSourceLine?: string;
  /**
   * First conceptual segment before `//` on the dressing line (if any).
   * Handy for summaries without parsing the full line.
   */
  dressingConceptual?: string;
  /**
   * Structured dressing variants for tools — not used by the UI yet.
   * When populated, should align with diet swaps / future authoring.
   */
  dressingVariants?: Partial<
    Record<'default' | 'vegan' | 'vegetarian' | 'keto' | 'paleo', CanonicalDressingVariant>
  >;
  /** Full per-diet `Dressing:` lines as stored for rendering (machine export). */
  dressingByDietSlugs?: Record<string, string>;
}
