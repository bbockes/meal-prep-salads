import {
  INGREDIENT_OMIT_RULES,
  OPTIONAL_PROTEINS,
  MIN_VIABLE_INGREDIENTS,
  DIET_KEYS,
  OPTIONAL_LINE_PROTEIN_UPSELL_PATTERNS,
  applyDressingSubs,
  type DietKey,
  type IngredientOmitRule,
  type OptionalProtein,
} from '@/data/diet-config';
import type { Recipe, RecipeIngredient } from '@/data/ingredient-types';

export function ingredientLine(ing: string | RecipeIngredient): string {
  return typeof ing === 'string' ? ing : ing.line;
}

export function isDressingLine(text: string | RecipeIngredient): boolean {
  return /^Dressing:\s/i.test(ingredientLine(text));
}

/** Resolved line for display/copy (dressing swaps from structured data or global subs). */
export function resolveIngredientDisplayLine(ing: string | RecipeIngredient, diet: string | null): string {
  const base = ingredientLine(ing);
  if (!diet) return base;
  if (isDressingLine(base)) {
    if (typeof ing === 'object' && ing.dressingByDiet?.[diet as DietKey]) {
      return ing.dressingByDiet[diet as DietKey]!;
    }
    return applyDressingSubs(base, diet);
  }
  return base;
}

export function isOptionalLine(text: string): boolean {
  return /^optional:/i.test(text);
}

export function shouldOmitIngredient(text: string | RecipeIngredient, diet: string): boolean {
  const line = ingredientLine(text);
  if (isDressingLine(line)) return false;
  if (typeof text === 'object' && Array.isArray(text.omitFor)) {
    return text.omitFor.includes(diet as DietKey);
  }
  for (const rule of INGREDIENT_OMIT_RULES) {
    if (rule.diets.includes(diet) && rule.pattern.test(line)) {
      return true;
    }
  }
  return false;
}

export function isSwappableProteinIngredient(text: string | RecipeIngredient): boolean {
  const line = ingredientLine(text);
  if (isDressingLine(line)) return false;
  for (const rule of INGREDIENT_OMIT_RULES) {
    if (rule.swappable && rule.pattern.test(line)) {
      return true;
    }
  }
  return false;
}

/** With no diet filter: hide primary placeholder proteins + optional meat upsells, not base charcuterie. */
export function shouldHideIngredientForDefaultProteinPicker(text: string | RecipeIngredient): boolean {
  const line = ingredientLine(text);
  if (isDressingLine(line)) return false;
  if (isOptionalLine(line)) {
    if (isSwappableProteinIngredient(text)) return true;
    return OPTIONAL_LINE_PROTEIN_UPSELL_PATTERNS.some((re) => re.test(line));
  }
  return isSwappableProteinIngredient(text);
}

export function adaptDressingForDiet(dressingLine: string, diet: string): string {
  return applyDressingSubs(dressingLine, diet);
}

const _recipeDietCache = new Map<number, string[]>();

export function getRecipeDiets(recipe: Recipe): string[] {
  const cached = _recipeDietCache.get(recipe.id);
  if (cached) return cached;

  const diets = (DIET_KEYS as readonly string[]).filter((diet) => {
    const coreIngredients = recipe.ingredients.filter((ing) => {
      if (isDressingLine(ing)) return false;
      if (isOptionalLine(ingredientLine(ing))) return false;
      return true;
    });
    const remaining = coreIngredients.filter((ing) => !shouldOmitIngredient(ing, diet));
    return remaining.length >= MIN_VIABLE_INGREDIENTS;
  });

  _recipeDietCache.set(recipe.id, diets);
  return diets;
}

export function getOptionalProteinsForDiet(diet: string, recipe?: Recipe | null): OptionalProtein[] {
  const pool = recipe?.optionalProteins ?? OPTIONAL_PROTEINS;
  return pool.filter((p) => p.diets.includes(diet));
}

const ORIGINAL_PROTEIN_TO_RECOMMENDED: [RegExp, string][] = [
  [/\bchicken\b/i, 'grilled chicken breast'],
  [/\brotisserie\b/i, 'grilled chicken breast'],
  [/\bturkey\b/i, 'grilled chicken breast'],
  [/\bkaraage\b/i, 'grilled chicken breast'],
  [/\bbeef\b/i, 'steak strips'],
  [/\bsteak\b/i, 'steak strips'],
  [/\bbulgogi\b/i, 'steak strips'],
  [/\bshrimp\b/i, 'grilled shrimp'],
  [/\bcrab\b/i, 'grilled shrimp'],
  [/\bsalmon\b/i, 'grilled salmon'],
  [/\btuna\b/i, 'grilled salmon'],
  [/\banchov/i, 'grilled salmon'],
  [/\bbacon\b/i, 'grilled chicken breast'],
  [/\bprosciutto\b/i, 'steak strips'],
  [/\bham\b/i, 'grilled chicken breast'],
  [/\bsalami\b/i, 'grilled chicken breast'],
  [/\bserrano\b/i, 'steak strips'],
  [/\bpepperoni\b/i, 'grilled chicken breast'],
];

const DEFAULT_TRADITIONAL_BY_CUISINE: Record<string, string> = {
  'American': 'grilled chicken breast',
  'Italian': 'grilled chicken breast',
  'Greek': 'grilled chicken breast',
  'French': 'grilled salmon',
  'Middle Eastern': 'grilled chicken breast',
  'Spanish': 'grilled shrimp',
  'Mexican': 'grilled chicken breast',
  'Indian': 'grilled chicken breast',
  'Thai': 'grilled shrimp',
  'Japanese': 'grilled salmon',
  'Korean': 'steak strips',
  'Vietnamese': 'grilled shrimp',
};

const PLANT_BY_CUISINE: Record<string, string> = {
  'American': 'roasted chickpeas',
  'Italian': 'roasted chickpeas',
  'Greek': 'roasted chickpeas',
  'French': 'pan-fried tofu',
  'Middle Eastern': 'roasted chickpeas',
  'Spanish': 'roasted chickpeas',
  'Mexican': 'pan-fried tofu',
  'Indian': 'roasted chickpeas',
  'Thai': 'pan-fried tofu',
  'Japanese': 'edamame, shelled',
  'Korean': 'pan-fried tofu',
  'Vietnamese': 'pan-fried tofu',
};

export function getRecommendedProteins(recipe: Recipe): { traditional: string; plant: string } {
  let traditionalRec: string | null = null;

  for (const ing of recipe.ingredients) {
    if (isDressingLine(ing)) continue;
    const line = ingredientLine(ing);
    for (const [pattern, recProtein] of ORIGINAL_PROTEIN_TO_RECOMMENDED) {
      if (pattern.test(line)) {
        traditionalRec = recProtein;
        break;
      }
    }
    if (traditionalRec) break;
  }

  if (!traditionalRec) {
    traditionalRec = DEFAULT_TRADITIONAL_BY_CUISINE[recipe.subCuisine || ''] || 'grilled chicken breast';
  }

  const plantRec = PLANT_BY_CUISINE[recipe.subCuisine || ''] || 'roasted chickpeas';

  return { traditional: traditionalRec, plant: plantRec };
}

export function getProteinStepName(fullName: string): string {
  let core = fullName.split(',')[0].trim();
  core = core.replace(/^(grilled|roasted|pan-fried|hard-boiled|baked|fried|sautéed|steamed)\s+/i, '');
  return core;
}

/** UI-only steps that include the selected protein; stripped before diet/protein pattern rules run */
export const SYNTHETIC_SELECTED_PROTEIN_STEP_PREFIX = '\uE000PROTSTEP\uE000';

export function isSyntheticSelectedProteinStep(s: string): boolean {
  return String(s).startsWith(SYNTHETIC_SELECTED_PROTEIN_STEP_PREFIX);
}

export function stripSyntheticProteinStepPrefix(s: string): string {
  return String(s).slice(SYNTHETIC_SELECTED_PROTEIN_STEP_PREFIX.length);
}

function cleanupStepPunctuation(s: string): string {
  let t = s;

  // Orphan "+" before "with" (e.g. "greens + quinoa with" → quinoa removed for Keto)
  t = t.replace(/\s*\+\s*with\b/gi, ' with');
  t = t.replace(/\s*\+\s*$/g, '');
  t = t.replace(/^\s*\+\s*/g, '');
  t = t.replace(/\s*\+\s*([,.;])/g, '$1');

  // Dangling prep words before comma (e.g. "Add sliced steak, …" → "Add sliced , …")
  t = t.replace(
    /\b(thinly\s+)?(sliced|diced|chopped|grilled|roasted|baked|fried|shredded|cubed|crumbled|cooked|marinated)\s*,/gi,
    ','
  );
  t = t.replace(/\bcooked\s+and\s+sliced\s*,/gi, ',');
  t = t.replace(/\bsliced\s+thin\s*,/gi, ',');

  // Dangling adjective before period (e.g. "Top with sliced ." after bulgogi + beef removed)
  t = t.replace(
    /\b(sliced|diced|chopped|grilled|roasted|baked|fried|shredded|cubed)\s*\./gi,
    '.'
  );
  t = t.replace(/\bTop\s+with\s+\./gi, 'Top.');

  // First item removed left "with and" / "Place and" / leading comma after verb
  t = t.replace(/\bwith\s+and\s+/gi, 'with ');
  t = t.replace(/\bTop\s+with\s+and\s+/gi, 'Top with ');
  t = t.replace(/\bPlace\s+and\s+/gi, 'Place ');

  t = t.replace(/\bAdd\s+,/gi, 'Add');
  t = t.replace(/\bTop\s+,/gi, 'Top');
  t = t.replace(/\bPlace\s+,/gi, 'Place');

  t = t.replace(/,\s*and\s*\./g, '.');
  t = t.replace(/\s+and\s*\.\s*$/g, '.');

  // "Add tomatoes, and pickled onions." → "Add tomatoes and pickled onions."
  t = t.replace(/^Add\s+([^.]*?),\s+and\s+/i, 'Add $1 and ');

  // "Add apples, pickled onions." → "Add apples and pickled onions."
  t = t.replace(/^Add\s+([^,]+),\s+([^.]+)\.$/i, (m, a, b) => {
    const rest = String(b).trim();
    if (/,\s/.test(rest)) return m;
    if (/\band\b/i.test(rest)) return m;
    return `Add ${String(a).trim()} and ${rest}.`;
  });

  while (/,\s*,/.test(t)) t = t.replace(/,\s*,/g, ',');
  t = t.replace(/(with|add)\s*,\s*/gi, '$1 ');
  t = t.replace(/,\s*and\s*\./gi, '.');
  t = t.replace(/,\s*\./g, '.');
  t = t.replace(/,\s*$/g, '');
  t = t.replace(/\s+\./g, '.');
  t = t.replace(/\s{2,}/g, ' ');
  return t.trim();
}

function escapeRegExp(s: string): string {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace swappable protein tokens with the selected name, unless that name already
 * appears in the step — then omit those tokens (avoids "eggs, eggs" when eggs are both
 * optional pick and base ingredient).
 */
function applySwappableProteinReplacement(
  s: string,
  rule: IngredientOmitRule,
  replacement: string
): string {
  const global = new RegExp(rule.pattern.source, 'gi');
  if (!replacement) {
    return s.replace(global, '');
  }
  const alreadyNamed = new RegExp(`\\b${escapeRegExp(replacement)}\\b`, 'i').test(s);
  if (alreadyNamed) {
    return s.replace(global, '');
  }
  return s.replace(global, replacement);
}

export function adaptStepForDiet(
  stepText: string,
  recipe: Recipe,
  diet: string,
  selectedProtein: string | null
): string {
  if (isSyntheticSelectedProteinStep(stepText)) {
    return stripSyntheticProteinStepPrefix(stepText);
  }
  const dietRules = INGREDIENT_OMIT_RULES.filter((r) => r.diets.includes(diet));
  const matching = dietRules.filter((r) => r.pattern.test(stepText));
  if (!matching.length) return stepText;

  let s = stepText;
  const replacement = selectedProtein ? getProteinStepName(selectedProtein) : '';
  let didSwap = false;

  for (const rule of matching) {
    const global = new RegExp(rule.pattern.source, 'gi');
    if (rule.swappable && !didSwap) {
      s = applySwappableProteinReplacement(s, rule, replacement);
      didSwap = true;
    } else {
      s = s.replace(global, '');
    }
  }

  return cleanupStepPunctuation(s);
}

export function adaptStepForProteinSwap(
  stepText: string,
  selectedProtein: string | null
): string {
  if (isSyntheticSelectedProteinStep(stepText)) {
    return stripSyntheticProteinStepPrefix(stepText);
  }
  const swappableRules = INGREDIENT_OMIT_RULES.filter((r) => r.swappable);
  const matching = swappableRules.filter((r) => r.pattern.test(stepText));
  if (!matching.length) return stepText;

  let s = stepText;
  const replacement = selectedProtein ? getProteinStepName(selectedProtein) : '';
  let didSwap = false;

  for (const rule of matching) {
    const global = new RegExp(rule.pattern.source, 'gi');
    if (!didSwap) {
      s = applySwappableProteinReplacement(s, rule, replacement);
      didSwap = true;
    } else {
      s = s.replace(global, '');
    }
  }

  return cleanupStepPunctuation(s);
}
