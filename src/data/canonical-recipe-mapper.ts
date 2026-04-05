import type { Recipe } from '@/data/recipes';
import { RECIPES } from '@/data/recipes';
import { DIET_KEYS, DIET_SLUGS } from '@/data/diet-config';
import { structureRecipeIngredients } from '@/data/recipe-ingredient-build';
import { getRecipeDiets, ingredientLine, isDressingLine } from '@/lib/diet-utils';
import { dressingConceptualSegment } from '@/lib/recipe-utils';
import type { CanonicalIngredient, CanonicalRecipe } from '@/data/canonical-recipe';

function dietsToSlugs(diets: string[]): string[] {
  return diets.map((d) => DIET_SLUGS[d] ?? d.toLowerCase());
}

function dietKeyToSlug(d: string): string {
  return DIET_SLUGS[d] ?? d.toLowerCase();
}

/** Build canonical JSON from the in-app recipe (lossless for ingredient lines). */
export function legacyRecipeToCanonical(r: Recipe): CanonicalRecipe {
  const dressingIng = r.ingredients.find((ing) => isDressingLine(ing));
  const dressingLine = dressingIng ? ingredientLine(dressingIng) : undefined;
  let dressingConceptual: string | undefined;
  if (dressingLine) {
    const seg = dressingConceptualSegment(dressingLine);
    if (seg) dressingConceptual = seg;
  }

  const dressingByDietSlugs: Record<string, string> | undefined = dressingIng?.dressingByDiet
    ? Object.fromEntries(
        (DIET_KEYS as readonly string[]).map((k) => [dietKeyToSlug(k), dressingIng.dressingByDiet![k as keyof typeof dressingIng.dressingByDiet] ?? dressingLine!])
      )
    : undefined;

  const ingredients: CanonicalIngredient[] = r.ingredients.map((ing) => ({
    line: ingredientLine(ing),
    omitFor: ing.omitFor.map(dietKeyToSlug),
  }));

  return {
    id: r.id,
    title: r.name,
    cuisine: r.cuisine,
    imageSlug: r.imageSlug,
    subCuisine: r.subCuisine,
    flavor: r.flavorTags ? [...r.flavorTags] : [],
    season: r.seasons ? [...r.seasons] : [],
    compatibleDiets: dietsToSlugs(getRecipeDiets(r)),
    ingredients,
    steps: [...r.steps],
    dressingSourceLine: dressingLine,
    dressingConceptual,
    dressingByDietSlugs,
  };
}

/** Restore legacy {@link Recipe} from canonical data (same shape the UI already uses). */
export function canonicalToLegacyRecipe(c: CanonicalRecipe): Recipe {
  const lines = c.ingredients.map((i: CanonicalIngredient) => i.line);
  return {
    id: c.id,
    cuisine: c.cuisine,
    name: c.title,
    imageSlug: c.imageSlug,
    subCuisine: c.subCuisine,
    flavorTags: c.flavor.length ? c.flavor : undefined,
    seasons: c.season.length ? c.season : undefined,
    ingredients: structureRecipeIngredients(lines),
    optionalProteins: undefined,
    steps: [...c.steps],
  };
}

export function allRecipesAsCanonical(): CanonicalRecipe[] {
  return RECIPES.map(legacyRecipeToCanonical);
}
