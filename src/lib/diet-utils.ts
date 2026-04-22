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
  [/\b(hard-boiled|soft-boiled|poached)\s+eggs?\b/i, 'hard-boiled eggs'],
  [/^\d+\s+eggs?$/i, 'hard-boiled eggs'],
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

const RECOMMENDED_PROTEIN_OVERRIDE_BY_RECIPE_ID: Partial<
  Record<number, { traditional?: string; plant?: string }>
> = {
  // Honey Crunch is designed as a "pick your protein" salad; steak is the canonical pairing.
  15: { traditional: 'steak strips' },
};

export function getRecommendedProteins(recipe: Recipe): { traditional: string; plant: string } {
  const ovr = RECOMMENDED_PROTEIN_OVERRIDE_BY_RECIPE_ID[recipe.id];
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

  return {
    traditional: ovr?.traditional || traditionalRec,
    plant: ovr?.plant || plantRec,
  };
}

/** Heuristic pairing strength for ordering proteins after the starred recommendation. */
function proteinPairingScore(recipe: Recipe, proteinName: string): number {
  const blob = recipe.ingredients.map((i) => ingredientLine(i)).join(' ').toLowerCase();
  const title = recipe.name.toLowerCase();
  const sc = recipe.subCuisine || '';
  const cu = recipe.cuisine;

  switch (proteinName) {
    case 'grilled chicken breast': {
      let s = 0;
      if (/\b(chicken|turkey|buffalo|bbq|ranch|cobb|bacon|ham|karaage|tandoori|lemongrass)\b/.test(blob)) s += 6;
      if (/\b(pepperoni|salami|chorizo)\b/.test(blob)) s += 4;
      if (/\b(prosciutto|serrano)\b/.test(blob)) s += 3;
      if (cu === 'American') s += 2;
      if (sc === 'Indian' || sc === 'Korean') s += 3;
      return s;
    }
    case 'grilled salmon': {
      let s = 0;
      if (/\b(salmon|tuna|fish|anchov)\b/.test(blob)) s += 6;
      if (/\b(ni[cs]oise|nicoise)\b/.test(title) || /\b(ni[cs]oise|nicoise)\b/.test(blob)) s += 5;
      if (/\b(sesame|miso|baja|taco|smoke)\b/.test(blob)) s += 4;
      if (cu === 'French' || cu === 'Mediterranean') s += 2;
      if (sc === 'Japanese') s += 2;
      return s;
    }
    case 'grilled shrimp': {
      let s = 0;
      if (/\b(shrimp|prawn|crab)\b/.test(blob)) s += 6;
      if (/\b(citrus|lime|coconut|papaya|snap pea|watermelon|jicama)\b/.test(blob)) s += 4;
      if (sc === 'Thai' || sc === 'Vietnamese' || sc === 'Spanish') s += 3;
      if (cu === 'Asian' && /(crunch|sesame|ginger|sunomono)/.test(title)) s += 2;
      return s;
    }
    case 'steak strips': {
      let s = 0;
      if (/\b(beef|steak|bulgogi)\b/.test(blob)) s += 6;
      if (/\bcobb\b/.test(title)) s += 5;
      if (/\bhoney\s+crunch\b/.test(title)) s += 5;
      if (sc === 'Korean' || /\bgochujang|kimchi|sesame\s+oil\b/.test(blob)) s += 3;
      if (/\b(pepperoni|salami|prosciutto|serrano)\b/.test(blob)) s += 3;
      return s;
    }
    case 'hard-boiled eggs': {
      let s = 0;
      if (/\b(hard-boiled|soft-boiled|poached)\s+eggs?\b/.test(blob) || /\b\d+\s+eggs?\b/.test(blob)) s += 6;
      if (/\b(ni[cs]oise|nicoise)\b/.test(title)) s += 5;
      if (/\b(bibimbap|lyonnaise|chicory)\b/.test(title) || /\beggs?\b/.test(blob)) s += 4;
      return s;
    }
    case 'roasted chickpeas': {
      let s = 0;
      if (/\b(chickpea|hummus|falafel|chaat|lentil|tabbouleh)\b/.test(blob)) s += 6;
      if (sc === 'Indian' || sc === 'Middle Eastern' || sc === 'Greek') s += 4;
      if (cu === 'Mediterranean') s += 3;
      return s;
    }
    case 'pan-fried tofu': {
      let s = 0;
      if (/\b(tofu|miso|sesame|bibimbap|kimchi|elote|chipotle|edamame)\b/.test(blob)) s += 6;
      if (sc === 'Japanese' || sc === 'Korean' || sc === 'Thai') s += 3;
      if (cu.includes('Mexican')) s += 3;
      return s;
    }
    case 'tempeh, sliced': {
      let s = 0;
      if (/\b(shroom|peanut|tamari|ginger|crunch)\b/.test(blob)) s += 4;
      if (/\b(kale|spinach|quinoa|grain|slaw)\b/.test(blob)) s += 2;
      return s;
    }
    case 'edamame, shelled': {
      let s = 0;
      if (/\bedamame\b/.test(blob)) s += 6;
      if (sc === 'Japanese') s += 5;
      if (/\b(miso|sesame|soy)\b/.test(blob)) s += 2;
      return s;
    }
    case 'hemp seeds': {
      let s = 0;
      if (/\b(hemp|chia|seed)\b/.test(blob)) s += 4;
      if (/\b(kale|super green|spinach)\b/.test(blob) || /super green/i.test(title)) s += 2;
      return s;
    }
    default:
      return 0;
  }
}

function compareProteinNamesForRecipe(recipe: Recipe, a: string, b: string): number {
  const d = proteinPairingScore(recipe, b) - proteinPairingScore(recipe, a);
  return d !== 0 ? d : a.localeCompare(b);
}

const DEFAULT_TOP_PROTEINS = 3;

/** Optional add-on proteins to hide per recipe (e.g. Cobb already includes eggs in the bowl). */
const OMIT_OPTIONAL_PROTEIN_NAMES_BY_RECIPE_ID: Record<number, ReadonlySet<string>> = {
  6: new Set(['hard-boiled eggs']),
};

function recipeAlreadyHasProtein(recipe: Recipe, proteinName: string): boolean {
  const blob = recipe.ingredients
    .filter((ing) => !isDressingLine(ing) && !isOptionalLine(ingredientLine(ing)))
    .map((i) => ingredientLine(i))
    .join(' ')
    .toLowerCase();

  switch (proteinName) {
    case 'grilled chicken breast':
      return /\bchicken\b/.test(blob) || /\brotisserie\b/.test(blob) || /\bturkey\b/.test(blob);
    case 'grilled salmon':
      return /\b(salmon|tuna|fish)\b/.test(blob) || /\banchov/.test(blob);
    case 'grilled shrimp':
      return /\b(shrimp|prawn|crab)\b/.test(blob);
    case 'steak strips':
      return /\b(steak|beef)\b/.test(blob) || /\bbulgogi\b/.test(blob);
    case 'hard-boiled eggs':
      return /\beggs?\b/.test(blob);
    case 'roasted chickpeas':
      return /\b(chickpeas?|chickpea|garbanzo)\b/.test(blob);
    case 'pan-fried tofu':
      return /\btofu\b/.test(blob);
    case 'tempeh, sliced':
      return /\btempeh\b/.test(blob);
    case 'edamame, shelled':
      return /\bedamame\b/.test(blob);
    case 'hemp seeds':
      return /\bhemp seeds?\b/.test(blob);
    default:
      return false;
  }
}

/**
 * Up to `limit` options: starred `recName` first when it appears in `pool`, then the next-best
 * pairings for this recipe (so Traditional / Plant columns differ per salad).
 */
export function pickTopOptionalProteinsForDisplay(
  recipe: Recipe,
  pool: OptionalProtein[],
  recName: string | null,
  limit = DEFAULT_TOP_PROTEINS
): OptionalProtein[] {
  const omit = OMIT_OPTIONAL_PROTEIN_NAMES_BY_RECIPE_ID[recipe.id];
  const usable0 = omit ? pool.filter((p) => !omit.has(p.name)) : pool;
  const usable = usable0.filter((p) => !recipeAlreadyHasProtein(recipe, p.name));
  if (usable.length === 0) return [];

  const byName = new Map(usable.map((p) => [p.name, p]));
  const allNames = [...byName.keys()];
  const sortedByScore = [...allNames].sort((a, b) => compareProteinNamesForRecipe(recipe, a, b));

  const selected: string[] = [];
  if (recName && byName.has(recName)) {
    selected.push(recName);
  }
  for (const n of sortedByScore) {
    if (selected.length >= limit) break;
    if (!selected.includes(n)) selected.push(n);
  }

  const rec = recName && selected.includes(recName) ? recName : null;
  const tail = selected.filter((n) => n !== rec);
  tail.sort((a, b) => compareProteinNamesForRecipe(recipe, a, b));
  const orderedNames = rec ? [rec, ...tail] : tail;
  return orderedNames.map((n) => byName.get(n)!).filter(Boolean);
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
  t = t.replace(/\bToss\s+,/gi, 'Toss');
  t = t.replace(/\bMix\s+,/gi, 'Mix');
  t = t.replace(/\bCoat\s+,/gi, 'Coat');

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
