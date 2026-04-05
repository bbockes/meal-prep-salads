import type { DietKey, OptionalProtein } from '@/data/diet-config';

/** Structured ingredient row (Phase 2); `line` is what users saw as a string before. */
export interface RecipeIngredient {
  line: string;
  omitFor: DietKey[];
  /** Precomputed per-diet dressing lines (full `Dressing: …` text). */
  dressingByDiet?: Partial<Record<DietKey, string>>;
}

export interface Recipe {
  id: number;
  cuisine: string;
  name: string;
  imageSlug?: string;
  ingredients: RecipeIngredient[];
  steps: string[];
  subCuisine?: string;
  flavorTags?: string[];
  seasons?: string[];
  /**
   * When set, replaces global OPTIONAL_PROTEINS for this recipe.
   * Omit to keep current global behavior.
   */
  optionalProteins?: OptionalProtein[];
}
