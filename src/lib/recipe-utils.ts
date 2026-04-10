// @ts-nocheck
import { ACCENT, FLAVOR_KEYS, SEASON_KEYS, FLAVOR_ACCENTS, SEASON_ACCENTS } from '@/data/constants';
import { Recipe, RECIPES } from '@/data/recipes';
import {
  shouldOmitIngredient,
  isDressingLine,
  isOptionalLine,
  adaptDressingForDiet,
  adaptStepForDiet,
  adaptStepForProteinSwap,
  shouldHideIngredientForDefaultProteinPicker,
  getProteinStepName,
  SYNTHETIC_SELECTED_PROTEIN_STEP_PREFIX,
  isSyntheticSelectedProteinStep,
  getRecipeDiets,
  ingredientLine,
  resolveIngredientDisplayLine,
} from '@/lib/diet-utils';

// Mutable format state - updated by React components before calling formatting functions
export const formatState = {
  showAmounts: false,
  unitMode: 'us' as 'us' | 'metric',
  recipePortions: 2,
  mealPlanPortions: 2,
  mealPlanShowAmounts: false,
  mealPlanUnitMode: 'us' as 'us' | 'metric',
  activeDiet: null as string | null,
  selectedProteinByRecipe: {} as Record<number, string>,
};

export const SCALING_BASE_PORTIONS = 2;

// ── HTML helpers ──────────────────────────────────────────────────────────────

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

/** Normalize common punctuation spacing artifacts from authored strings. */
export function normalizeTextPunctuation(s) {
  let t = String(s ?? '');
  // Remove space before commas, ensure single space after commas.
  t = t.replace(/\s+,/g, ',');
  t = t.replace(/,(?!\s|$)/g, ', ');
  t = t.replace(/,\s{2,}/g, ', ');
  // Collapse accidental multi-spaces.
  t = t.replace(/\s{2,}/g, ' ');
  return t.trim();
}

export function recipeCardImageSlug(name, imageSlug) {
  if (imageSlug) return imageSlug;
  const base = String(name).replace(/\s+Salad$/i, '').trim();
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Cuisine / sub-cuisine helpers ─────────────────────────────────────────────

export function isDistinctSubCuisine(r) {
  if (!r.subCuisine) return false;
  return r.subCuisine.trim().toLowerCase() !== String(r.cuisine).trim().toLowerCase();
}

export function detailMetaBadgesHtml(r, browseMode) {
  return `<span class="cuisine-badge">${escapeHtml(r.subCuisine || r.cuisine)}</span>`;
}

// ── Navigation helpers ────────────────────────────────────────────────────────

export function getNavTabs(browseMode) {
  if (browseMode === 'cuisine') return ['All', ...Object.keys(ACCENT)];
  if (browseMode === 'flavor') return ['All', ...FLAVOR_KEYS];
  return ['All', ...SEASON_KEYS];
}

export function accentForNavCat(cat, browseMode) {
  if (browseMode === 'cuisine') return ACCENT[cat] || '#4a5568';
  if (browseMode === 'flavor') return FLAVOR_ACCENTS[cat] || '#4a5568';
  return SEASON_ACCENTS[cat] || '#4a5568';
}

// ── Overlap / Smart Picks constants ───────────────────────────────────────────

export const OVERLAP_NAV_CAT = 'Smart Picks';
export const OVERLAP_TAB_TIP_COPY =
  "Smart Picks ranks recipes not already in your meal plan by how many ingredients they share with recipes in your plan (excluding dressings and sauces).\u00A0Use it to find recipes that overlap with what you've already chosen—so you can minimize waste and use ingredients efficiently.";

// ── Visible recipes ───────────────────────────────────────────────────────────

export function getVisibleRecipes(browseMode, activeCategory, dietScope) {
  let base;
  if (browseMode === 'cuisine') {
    base = activeCategory === 'All' ? RECIPES : RECIPES.filter((r) => r.subCuisine === activeCategory);
  } else if (browseMode === 'flavor') {
    if (activeCategory === 'All') base = RECIPES;
    else base = RECIPES.filter((r) => r.flavorTags.includes(activeCategory));
  } else if (activeCategory === 'All') {
    base = RECIPES;
  } else {
    base = RECIPES.filter((r) => r.seasons.includes(activeCategory));
  }
  if (dietScope) {
    return base.filter((r) => getRecipeDiets(r).includes(dietScope));
  }
  return base;
}

/** Sort by ingredient overlap with the meal plan (highest first); ties use cuisine browse order. */
export function sortRecipesByPlanOverlap(recipes, mealPlanIds) {
  const planKeys = mealPlanOverlapIngredientKeys(mealPlanIds);
  return recipes
    .map((r) => ({ r, s: overlapMatchCount(planKeys, r) }))
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      return compareRecipesForCuisineBrowse(a.r, b.r);
    })
    .map((x) => x.r);
}

export function recipesForCardStrip(
  browseMode,
  activeCategory,
  dietScope,
  mealPrepMode,
  mealPlanIds,
  smartPicksEnabled = false
) {
  const raw = getVisibleRecipes(browseMode, activeCategory, dietScope);
  const smartOn = smartPicksEnabled && mealPrepMode && mealPlanIds.length > 0;
  if (smartOn) {
    const inPlan = new Set(mealPlanIds);
    const filtered = raw.filter((r) => !inPlan.has(r.id));
    return sortRecipesByPlanOverlap(filtered, mealPlanIds);
  }
  return raw.slice().sort(compareRecipesForCuisineBrowse);
}

// ── Sorting helpers ───────────────────────────────────────────────────────────

export const CUISINE_SORT_ORDER = Object.keys(ACCENT);

export function cuisineSortIndex(subCuisine) {
  const i = CUISINE_SORT_ORDER.indexOf(subCuisine);
  return i === -1 ? 999 : i;
}

export function compareRecipesForCuisineBrowse(a, b) {
  const byIdx = cuisineSortIndex(a.subCuisine) - cuisineSortIndex(b.subCuisine);
  if (byIdx !== 0) return byIdx;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

// ── Unit conversion constants ─────────────────────────────────────────────────

export const ML_PER_US_TSP = 4.92892159375;
export const ML_PER_US_TBSP = 14.78676478125;
export const ML_PER_US_CUP = 236.5882365;
export const ML_PER_US_PINT = 473.176473;
export const ML_PER_US_QT = 946.352946;
export const G_PER_OZ = 28.349523125;

// ── Unit aliases & unicode fractions ──────────────────────────────────────────

export const UNIT_ALIASES = [
  ['tablespoons', 'tbsp'],
  ['tablespoon', 'tbsp'],
  ['teaspoons', 'tsp'],
  ['teaspoon', 'tsp'],
  ['cups', 'cup'],
  ['ounces', 'oz'],
  ['ounce', 'oz'],
  ['pounds', 'lb'],
  ['pound', 'lb'],
  ['lbs', 'lb'],
  ['milliliters', 'ml'],
  ['milliliter', 'ml'],
  ['millilitres', 'ml'],
  ['millilitre', 'ml'],
  ['liters', 'l'],
  ['liter', 'l'],
  ['litres', 'l'],
  ['litre', 'l'],
  ['quarts', 'qt'],
  ['quart', 'qt'],
  ['pints', 'pint'],
  ['heads', 'head'],
  ['bunches', 'bunch'],
  ['cloves', 'clove'],
  ['slices', 'slice'],
  ['strips', 'strip'],
  ['pieces', 'piece'],
  ['sprigs', 'sprig'],
  ['cans', 'can'],
  ['packages', 'package'],
  ['pouches', 'pouch'],
  ['scoops', 'scoop'],
  ['handfuls', 'handful'],
  ['pinches', 'pinch'],
  ['dashes', 'dash'],
  ['sheets', 'sheet'],
  ['pkgs', 'pkg'],
];

export const UNICODE_FRAC = {
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};

// ── Quantity parsing ──────────────────────────────────────────────────────────

export function parseSingleQuantity(numPart) {
  let s = String(numPart).trim();
  if (!s) return null;
  let total = 0;
  const uf = s.match(/[¼½¾⅓⅔⅛⅜⅝⅞]/);
  if (uf) {
    total += UNICODE_FRAC[uf[0]] || 0;
    s = s.replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, '').trim();
  }
  const fracOnly = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracOnly) {
    const a = parseInt(fracOnly[1], 10);
    const b = parseInt(fracOnly[2], 10);
    if (b) return total + a / b;
    return null;
  }
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const a = parseInt(mixed[2], 10);
    const b = parseInt(mixed[3], 10);
    if (b) return total + whole + a / b;
    return null;
  }
  if (/^\d/.test(s)) {
    const n = parseFloat(s.replace(/[^\d.]/g, ''));
    if (!Number.isNaN(n)) return total + n;
  }
  if (total) return total;
  return null;
}

export function parseQuantityValue(numPart) {
  const trimmed = String(numPart).trim();
  const rangeSep = /[–\-]/;
  if (rangeSep.test(trimmed)) {
    const parts = trimmed.split(rangeSep).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      const a = parseSingleQuantity(parts[0]);
      const b = parseSingleQuantity(parts[1]);
      if (a != null && b != null) return [Math.min(a, b), Math.max(a, b)];
    }
  }
  const one = parseSingleQuantity(trimmed);
  return one == null ? null : one;
}

export function normalizeUnitToken(unitRaw) {
  let u = String(unitRaw).toLowerCase().replace(/\.$/, '');
  for (const [long, short] of UNIT_ALIASES) {
    if (u === long) return short;
  }
  return u;
}

export function splitAmountNumberAndUnit(amountStr) {
  const s = String(amountStr).trim();
  const sorted = [
    'tablespoons',
    'tablespoon',
    'teaspoons',
    'teaspoon',
    'milliliters',
    'milliliter',
    'millilitres',
    'millilitre',
    'packages',
    'package',
    'pouches',
    'pouch',
    'cups',
    'cup',
    'quarts',
    'quart',
    'pounds',
    'pound',
    'ounces',
    'ounce',
    'pints',
    'pint',
    'bunches',
    'bunch',
    'heads',
    'head',
    'cloves',
    'clove',
    'slices',
    'slice',
    'strips',
    'strip',
    'pieces',
    'piece',
    'sprigs',
    'sprig',
    'cans',
    'can',
    'scoops',
    'scoop',
    'handfuls',
    'handful',
    'pinches',
    'pinch',
    'dashes',
    'dash',
    'sheets',
    'sheet',
    'pkgs',
    'pkg',
    'tbsp',
    'tsp',
    'lbs',
    'lb',
    'kg',
    'oz',
    'ml',
    'qt',
    'g',
    'l',
  ];
  const lower = s.toLowerCase();
  for (const tok of sorted) {
    if (lower.endsWith(tok)) {
      const num = s.slice(0, s.length - tok.length).trim();
      const next = s[s.length - tok.length - 1];
      if (num && (next === ' ' || next === undefined)) {
        return { numPart: num, unit: normalizeUnitToken(tok) };
      }
    }
  }
  return null;
}

// ── Portion scaling ───────────────────────────────────────────────────────────

export function effectiveRecipePortions() {
  return formatState.recipePortions;
}

export function portionScaleFactor() {
  return effectiveRecipePortions() / SCALING_BASE_PORTIONS;
}

// ── Volume normalization ──────────────────────────────────────────────────────

export function cupWordFromNumeric(cups) {
  if (!Number.isFinite(cups)) return 'cup';
  if (cups > 1 + 1e-6) return 'cups';
  return 'cup';
}

export function normalizeTbspEndpoint(v) {
  const rounded = Math.round(v * 1000) / 1000;
  if (Math.abs(v - rounded) > 0.001) return { kind: 'tbsp', txt: formatQuantityForDisplay(v) };
  const n = rounded;
  if (n < 4) return { kind: 'tbsp', txt: formatQuantityForDisplay(n) };
  if (n % 4 === 0 || n >= 16) {
    const cups = n / 16;
    return { kind: 'cup', txt: formatQuantityForDisplay(cups), nCups: cups };
  }
  return { kind: 'tbsp', txt: formatQuantityForDisplay(n) };
}

export function normalizeTspEndpoint(v) {
  const rounded = Math.round(v * 1000) / 1000;
  if (Math.abs(v - rounded) > 0.001) return { kind: 'tsp', txt: formatQuantityForDisplay(v) };
  const n = rounded;
  if (n >= 12) {
    const cups = n / 48;
    return { kind: 'cup', txt: formatQuantityForDisplay(cups), nCups: cups };
  }
  if (n >= 3 && n % 3 === 0) {
    return normalizeTbspEndpoint(n / 3);
  }
  return { kind: 'tsp', txt: formatQuantityForDisplay(n) };
}

export function normalizeScaledUsVolume(amountStr) {
  const sp = splitAmountNumberAndUnit(amountStr);
  if (!sp || (sp.unit !== 'tbsp' && sp.unit !== 'tsp')) return amountStr;
  const q = parseQuantityValue(sp.numPart);
  if (q == null) return amountStr;
  const trimmed = String(amountStr).trim();
  const np = sp.numPart.trim();
  const idx = trimmed.startsWith(np) ? 0 : trimmed.indexOf(np);
  const afterNum = idx >= 0 ? trimmed.slice(idx + np.length).trim() : '';
  if (afterNum && !/^(tbsp|tsp|tablespoons?|teaspoons?)\.?$/i.test(afterNum)) return amountStr;

  const pair = (lo, hi, unit) => {
    const a = unit === 'tbsp' ? normalizeTbspEndpoint(lo) : normalizeTspEndpoint(lo);
    const b = unit === 'tbsp' ? normalizeTbspEndpoint(hi) : normalizeTspEndpoint(hi);
    if (a.kind === 'cup' && b.kind === 'cup') {
      return `${a.txt}–${b.txt} ${cupWordFromNumeric(Math.max(a.nCups, b.nCups))}`;
    }
    if (a.kind === 'tbsp' && b.kind === 'tbsp') return `${a.txt}–${b.txt} tbsp`;
    if (a.kind === 'tsp' && b.kind === 'tsp') return `${a.txt}–${b.txt} tsp`;
    return null;
  };

  if (Array.isArray(q)) {
    const ranged = pair(q[0], q[1], sp.unit);
    return ranged || amountStr;
  }
  const one = sp.unit === 'tbsp' ? normalizeTbspEndpoint(q) : normalizeTspEndpoint(q);
  if (one.kind === 'cup') return `${one.txt} ${cupWordFromNumeric(one.nCups)}`;
  const u = one.kind === 'tbsp' ? 'tbsp' : 'tsp';
  return `${one.txt} ${u}`;
}

// ── Quantity display ──────────────────────────────────────────────────────────

export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function formatQuantityForDisplay(n) {
  if (!Number.isFinite(n) || n < 0) return String(n);
  const rounded = Math.round(n * 10000) / 10000;
  const symFracs = [
    [0.125, '⅛'],
    [0.25, '¼'],
    [0.333, '⅓'],
    [0.3333, '⅓'],
    [0.375, '⅜'],
    [0.5, '½'],
    [0.625, '⅝'],
    [0.666, '⅔'],
    [0.6667, '⅔'],
    [0.75, '¾'],
    [0.875, '⅞'],
  ];
  for (let i = 0; i < symFracs.length; i++) {
    if (Math.abs(rounded - symFracs[i][0]) < 0.051) return symFracs[i][1];
  }
  const w = Math.floor(rounded);
  const frac = rounded - w;
  if (w >= 1) {
    for (let i = 0; i < symFracs.length; i++) {
      const fv = symFracs[i][0];
      if (Math.abs(frac - fv) < 0.051) {
        if (fv < 0.001) return String(w);
        return `${w}${symFracs[i][1]}`;
      }
    }
  }
  if (w >= 1 && Math.abs(frac - 0.5) < 0.06) return `${w}½`;
  if (w >= 1 && Math.abs(frac - 0.25) < 0.06) return `${w}¼`;
  if (w >= 1 && Math.abs(frac - 0.75) < 0.06) return `${w}¾`;
  const S48 = Math.round(rounded * 48);
  if (S48 > 0 && Math.abs(rounded * 48 - S48) < 0.0001) {
    const wholeCup = Math.floor(S48 / 48);
    const rem = S48 % 48;
    if (rem === 0) {
      const x = S48 / 48;
      if (x < 0.001) return '0';
      if (x === Math.floor(x)) return String(Math.floor(x));
      return formatQuantityForDisplay(x);
    }
    const g2 = gcd(rem, 48);
    const nn = rem / g2;
    const dd = 48 / g2;
    const fracStr = `${nn}/${dd}`;
    const cupFracUnicode = {
      '1/8': '⅛',
      '1/4': '¼',
      '3/8': '⅜',
      '1/2': '½',
      '5/8': '⅝',
      '3/4': '¾',
      '7/8': '⅞',
      '1/3': '⅓',
      '2/3': '⅔',
    };
    const sym = cupFracUnicode[fracStr];
    if (wholeCup === 0) return sym || fracStr;
    return sym ? `${wholeCup}${sym}` : `${wholeCup} ${fracStr}`;
  }
  const ri = Math.round(rounded);
  if (Math.abs(rounded - ri) < 0.06) return String(ri);
  const t = Math.round(rounded * 100) / 100;
  if (Math.abs(t - Math.round(t)) < 0.001) return String(Math.round(t));
  const s = String(t);
  return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

// ── Amount scaling ────────────────────────────────────────────────────────────

export function scaleAmountString(amountStr, factor) {
  const sp = splitAmountNumberAndUnit(amountStr);
  if (!sp) return amountStr;
  const q = parseQuantityValue(sp.numPart);
  if (q == null) return amountStr;
  const trimmed = String(amountStr).trim();
  const np = sp.numPart.trim();
  const idx = trimmed.startsWith(np) ? 0 : trimmed.indexOf(np);
  const tail = idx >= 0 ? trimmed.slice(idx + np.length).trim() : '';
  let scaledNum;
  if (!Number.isFinite(factor) || Math.abs(factor - 1) < 1e-9) {
    if (Array.isArray(q)) {
      scaledNum = `${formatQuantityForDisplay(q[0])}–${formatQuantityForDisplay(q[1])}`;
    } else {
      scaledNum = formatQuantityForDisplay(q);
    }
  } else if (Array.isArray(q)) {
    scaledNum = `${formatQuantityForDisplay(q[0] * factor)}–${formatQuantityForDisplay(q[1] * factor)}`;
  } else {
    scaledNum = formatQuantityForDisplay(q * factor);
  }
  const out = tail ? `${scaledNum} ${tail}` : scaledNum;
  return normalizeScaledUsVolume(out);
}

// ── Metric formatting ─────────────────────────────────────────────────────────

export function formatMetricMl(ml) {
  if (ml >= 1000) {
    const L = ml / 1000;
    const t = L >= 10 ? L.toFixed(0) : L.toFixed(1).replace(/\.0$/, '');
    return `${t} L`;
  }
  if (ml < 10) return `${Math.round(ml * 10) / 10} ml`.replace(/\.0$/, '');
  return `${Math.round(ml)} ml`;
}

export function formatMetricG(g) {
  if (g >= 1000) {
    const kg = g / 1000;
    const t = kg >= 10 ? kg.toFixed(1).replace(/\.0$/, '') : kg.toFixed(2).replace(/\.?0+$/, '');
    return `${t} kg`;
  }
  if (g < 10) return `${Math.round(g * 10) / 10} g`.replace(/\.0$/, '');
  return `${Math.round(g)} g`;
}

// ── Ingredient classification for metric conversion ───────────────────────────

export function gramsPerMlForLiquid(rest) {
  const r = String(rest).toLowerCase();
  if (/\b(honey|molasses)\b/.test(r)) return 1.42;
  if (/\bmaple syrup\b/.test(r)) return 1.37;
  if (/\bagave\b/.test(r)) return 1.36;
  if (/\bsyrup\b/.test(r)) return 1.3;
  if (/\b(oil|olive oil|sesame oil|truffle oil)\b/.test(r)) return 0.92;
  if (/\b(mayo|mayonnaise)\b/.test(r)) return 0.91;
  if (/\bcoconut milk\b/.test(r)) return 1.02;
  if (/\b(milk|almond milk|oat milk|soy milk|buttermilk)\b/.test(r)) return 1.03;
  if (/\b(cream|half-and-half|whipping cream|heavy cream)\b/.test(r)) return 0.99;
  if (/\b(yogurt|greek yogurt)\b/.test(r)) return 1.05;
  if (/\b(sour cream|crema|crème fraîche|crème fraiche)\b/.test(r)) return 1.0;
  if (/\b(soy sauce|tamari|fish sauce|oyster sauce|worcestershire)\b/.test(r)) return 1.15;
  if (/\b(ketchup|hot sauce|sriracha|chili crisp)\b/.test(r)) return 1.05;
  if (/\bpesto\b/.test(r)) return 0.95;
  if (/\b(tahini|hummus)\b/.test(r)) return 1.05;
  if (/\b(vinegar|rice vinegar|cider vinegar|balsamic)\b/.test(r)) return 1.01;
  if (/\b(wine|sherry|vermouth|mirin)\b/.test(r)) return 0.99;
  if (/\b(juice|broth|stock|brine|pickle juice)\b/.test(r)) return 1.0;
  return 1.0;
}

export function isIngredientLiquid(rest) {
  const r = String(rest).toLowerCase();
  if (/\bcream cheese|cottage cheese|ricotta\b/.test(r)) return false;
  if (/\bwatermelon\b/.test(r)) return false;
  if (/\b(crumbled|crumbles)\b.*\b(feta|goat|blue)\b|\bfeta crumb|goat cheese|blue cheese crumb\b/.test(r)) return false;

  return (
    /\b(sauce|dressing|vinaigrette|gravy|glaze|marinade|aioli)\b/.test(r) ||
    /\b(oil|vinegar|balsamic)\b/.test(r) ||
    /\b(juice)\b/.test(r) ||
    /\b(milk|coconut milk|almond milk|oat milk|soy milk)\b/.test(r) ||
    /\b(buttermilk|half-and-half|heavy cream|whipping cream)\b/.test(r) ||
    /\b(mayo|mayonnaise|yogurt|greek yogurt)\b/.test(r) ||
    /\b(sour cream|crema|crème fraîche|crème fraiche)\b/.test(r) ||
    /\b(honey|syrup|molasses|agave)\b/.test(r) ||
    /\b(broth|stock)\b/.test(r) ||
    /\b(wine|sherry|vermouth)\b/.test(r) ||
    /\b(tamari|soy sauce|fish sauce|oyster sauce)\b/.test(r) ||
    /\b(worcestershire|hot sauce|sriracha|ketchup|chili crisp)\b/.test(r) ||
    /\b(bbq|ranch\b|caesar\b|italian dressing|sesame dressing|peanut sauce|nuoc cham|ponzu|hoisin|gochujang|buffalo)\b/.test(r) ||
    /\b(mirin|rice vinegar|apple cider vinegar|cider vinegar)\b/.test(r) ||
    /\b(pesto|tahini|hummus)\b/.test(r) ||
    /\b(in adobo|from adobo|chipotle.*adobo)\b/.test(r) ||
    /\b(pickle juice|brine)\b/.test(r) ||
    /\b(maple syrup|sesame oil|olive oil|truffle oil)\b/.test(r) ||
    /\b(mustard\b.*dressing|dijon vinaigrette)\b/.test(r)
  );
}

export function gramsPerUsCupForSolid(rest) {
  const r = String(rest).toLowerCase();
  if (/\b(lettuce|romaine|kale|spinach|arugula|spring mix|mixed greens|butter lettuce|endive|frisée|frisee|radicchio|mesclun)\b/.test(r)) return 40;
  if (/\b(cilantro|parsley|basil|mint|dill|chives|thyme|oregano|rosemary|tarragon|microgreens)\b/.test(r)) return 20;
  if (/\b(scallion|green onion)\b/.test(r)) return 55;
  if (/\b(chips|croutons|tortilla strips|wonton strips|ramen|pita chips|papdi|breadcrumbs|panko)\b/.test(r)) return 40;
  if (/\b(chicken|turkey|beef|pork|steak|salmon|tuna|shrimp|bacon|ham|rotisserie|prosciutto|serrano|deli ham)\b/.test(r)) return 140;
  if (/\b(tofu|tempeh|karaage|fried chicken)\b/.test(r)) return 140;
  if (/\b(feta|parmesan|mozzarella|cheddar|halloumi|manchego|pecorino|cotija|provolone|gouda|swiss cheese|pearl mozzarella)\b/.test(r)) return 115;
  if (/\b(beans\b|chickpeas|black beans|kidney beans|lentils|edamame)\b/.test(r)) return 180;
  if (/\b(quinoa|rice|farro|orzo|pasta|wild rice|barley|vermicelli|noodles? cooked|glass noodles)\b/.test(r)) return 185;
  if (/\b(egg|eggs|hard-boiled|soft-boiled|poached egg)\b/.test(r)) return 140;
  if (/\b(walnuts|pecans|almonds|peanuts|pepitas|pistachios|cashews|pine nuts|marcona|candied pecans)\b/.test(r)) return 120;
  if (/\b(cabbage|carrot|broccoli|cauliflower|cucumber|tomato|pepper|bell pepper|onion|shallot|apple|pear|peach|berries|grapes|potato|squash|beet|zucchini|jalapeño|jalapeno|poblano|corn kernels|peas|snap pea|sugar snap|radish|celery|mushroom|daikon|jicama|asparagus|green bean|beans,|bean sprouts)\b/.test(r)) return 100;
  if (/\b(avocado)\b/.test(r)) return 150;
  if (/\b(beets?|potatoes?|sweet potato)\b/.test(r)) return 165;
  return 110;
}

export function ingredientDescriptorForClassification(rest) {
  const parts = splitPlusAtDepthZero(String(rest).trim());
  return parts.length ? parts[0].trim() : String(rest).trim();
}

// ── Metric conversion ─────────────────────────────────────────────────────────

export function convertQuantityToMetric(value, unit, rest) {
  const restStr = rest == null ? '' : String(rest);
  const classifyOn = ingredientDescriptorForClassification(restStr);
  const toRangeStr = (fmt, lo, hi) => {
    if (typeof lo === 'number' && typeof hi === 'number' && lo !== hi) {
      return `${fmt(lo)}–${fmt(hi)}`;
    }
    const v = typeof lo === 'number' ? lo : hi;
    return fmt(v);
  };

  const formatLiquidGrams = (mlLo, mlHi) => {
    const d = gramsPerMlForLiquid(classifyOn);
    return toRangeStr(formatMetricG, mlLo * d, mlHi * d);
  };

  const volToMetric = () => {
    const liquid = isIngredientLiquid(classifyOn);
    if (liquid) {
      if (unit === 'tsp') {
        const toMl = (v) => v * ML_PER_US_TSP;
        if (Array.isArray(value)) return formatLiquidGrams(toMl(value[0]), toMl(value[1]));
        const m = toMl(value);
        return formatLiquidGrams(m, m);
      }
      if (unit === 'tbsp') {
        const toMl = (v) => v * ML_PER_US_TBSP;
        if (Array.isArray(value)) return formatLiquidGrams(toMl(value[0]), toMl(value[1]));
        const m = toMl(value);
        return formatLiquidGrams(m, m);
      }
      if (unit === 'cup') {
        const toMl = (v) => v * ML_PER_US_CUP;
        if (Array.isArray(value)) return formatLiquidGrams(toMl(value[0]), toMl(value[1]));
        const m = toMl(value);
        return formatLiquidGrams(m, m);
      }
      if (unit === 'pint') {
        const toMl = (v) => v * ML_PER_US_PINT;
        if (Array.isArray(value)) return formatLiquidGrams(toMl(value[0]), toMl(value[1]));
        const m = toMl(value);
        return formatLiquidGrams(m, m);
      }
      if (unit === 'qt') {
        const toMl = (v) => v * ML_PER_US_QT;
        if (Array.isArray(value)) return formatLiquidGrams(toMl(value[0]), toMl(value[1]));
        const m = toMl(value);
        return formatLiquidGrams(m, m);
      }
    }
    const gPerCup = gramsPerUsCupForSolid(classifyOn);
    const gPerTbsp = gPerCup / 16;
    const gPerTsp = gPerCup / 48;
    if (unit === 'tsp') {
      const toG = (v) => v * gPerTsp;
      if (Array.isArray(value)) return toRangeStr(formatMetricG, toG(value[0]), toG(value[1]));
      return formatMetricG(toG(value));
    }
    if (unit === 'tbsp') {
      const toG = (v) => v * gPerTbsp;
      if (Array.isArray(value)) return toRangeStr(formatMetricG, toG(value[0]), toG(value[1]));
      return formatMetricG(toG(value));
    }
    if (unit === 'cup') {
      const toG = (v) => v * gPerCup;
      if (Array.isArray(value)) return toRangeStr(formatMetricG, toG(value[0]), toG(value[1]));
      return formatMetricG(toG(value));
    }
    if (unit === 'pint') {
      const toG = (v) => v * gPerCup * 2;
      if (Array.isArray(value)) return toRangeStr(formatMetricG, toG(value[0]), toG(value[1]));
      return formatMetricG(toG(value));
    }
    if (unit === 'qt') {
      const toG = (v) => v * gPerCup * 4;
      if (Array.isArray(value)) return toRangeStr(formatMetricG, toG(value[0]), toG(value[1]));
      return formatMetricG(toG(value));
    }
    return null;
  };

  if (unit === 'tsp' || unit === 'tbsp' || unit === 'cup' || unit === 'pint' || unit === 'qt') {
    return volToMetric();
  }
  if (unit === 'oz') {
    const toG = (v) => v * G_PER_OZ;
    if (Array.isArray(value)) return toRangeStr(formatMetricG, toG(value[0]), toG(value[1]));
    return formatMetricG(toG(value));
  }
  if (unit === 'lb') {
    const toG = (v) => v * 453.592;
    if (Array.isArray(value)) return toRangeStr(formatMetricG, toG(value[0]), toG(value[1]));
    return formatMetricG(toG(value));
  }
  if (unit === 'g') {
    const id = (v) => v;
    if (Array.isArray(value)) return toRangeStr(formatMetricG, id(value[0]), id(value[1]));
    return formatMetricG(id(value));
  }
  if (unit === 'kg') {
    const toG = (v) => v * 1000;
    if (Array.isArray(value)) return toRangeStr(formatMetricG, toG(value[0]), toG(value[1]));
    return formatMetricG(toG(value));
  }
  if (unit === 'ml') {
    if (isIngredientLiquid(classifyOn)) {
      if (Array.isArray(value)) return formatLiquidGrams(value[0], value[1]);
      return formatLiquidGrams(value, value);
    }
    if (Array.isArray(value)) return toRangeStr(formatMetricMl, value[0], value[1]);
    return formatMetricMl(value);
  }
  if (unit === 'l') {
    const toMl = (v) => v * 1000;
    if (isIngredientLiquid(classifyOn)) {
      if (Array.isArray(value)) return formatLiquidGrams(toMl(value[0]), toMl(value[1]));
      const m = toMl(value);
      return formatLiquidGrams(m, m);
    }
    if (Array.isArray(value)) return toRangeStr(formatMetricMl, toMl(value[0]), toMl(value[1]));
    return formatMetricMl(toMl(value));
  }
  return null;
}

// ── Display amount helpers ────────────────────────────────────────────────────

export function displayAmountText(amountStr, restHint) {
  if (formatState.unitMode === 'us') return amountStr;
  const sp = splitAmountNumberAndUnit(amountStr);
  if (!sp) return amountStr;
  const q = parseQuantityValue(sp.numPart);
  if (q == null) return amountStr;
  const value = Array.isArray(q) ? q : q;
  const converted = convertQuantityToMetric(value, sp.unit, restHint == null ? '' : restHint);
  if (!converted) return amountStr;
  return converted;
}

export function formatAmountForDisplay(amountStr, restHint) {
  const scaled = scaleAmountString(amountStr, portionScaleFactor());
  return displayAmountText(scaled, restHint);
}

// ── Ingredient parsing ────────────────────────────────────────────────────────

export function parseIngredient(str) {
  const match = str.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞\/\-–. ]*(tbsp|tsp|cup|cups|oz|lb|lbs|g|kg|ml|l|bunch|head|can|cans|pouch|pkg|package|clove|cloves|slice|slices|strip|strips|piece|pieces|sprig|sprigs|handful|pinch|dash|scoop|scoops|qt|pint)?\.?)\s+(.+)$/i);
  if (match && match[1].trim()) {
    return { amount: match[1].trim(), rest: match[3].trim() };
  }
  return { amount: null, rest: str };
}

/** Strip leading amounts from each top-level ` + ` segment (e.g. "3 cups romaine + 1 cup cabbage" → "romaine + cabbage"). */
export function ingredientLineWithoutAmounts(str) {
  const trimmed = String(str || '').trim();
  if (!trimmed) return trimmed;
  const chunks = splitPlusAtDepthZero(trimmed);
  const parts = chunks.map((chunk) => {
    const c = chunk.trim();
    if (!c) return '';
    const { amount, rest } = parseIngredient(c);
    if (amount && rest) return rest.trim();
    return c;
  });
  return parts.filter(Boolean).join(' + ');
}

// ── Dressing handling ─────────────────────────────────────────────────────────

export const DRESSING_VARIANT_SPLIT = /\s+\/\/\s+/;

export function dressingVariantBodies(fullDressingLine) {
  const line = ingredientLine(fullDressingLine);
  const m = line.match(/^Dressing:\s*(.*)$/i);
  if (!m) return [];
  return m[1]
    .split(DRESSING_VARIANT_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function pickDressingBodyFromLine(fullDressingLine) {
  const parts = dressingVariantBodies(fullDressingLine);
  if (parts.length >= 2) return formatState.showAmounts ? parts[parts.length - 1] : parts[0];
  return parts[0] || '';
}

export function orderIngredientsDressingLast(ingredients) {
  const dressing = [];
  const other = [];
  for (const ing of ingredients) {
    const line = ingredientLine(ing);
    let outLine = line;
    let outIng = ing;
    if (!/^Dressing:\s*/i.test(outLine)) {
      const { amount, rest } = parseIngredient(outLine);
      if (amount && /\b(dressing|vinaigrette)\b/i.test(rest)) {
        outLine = 'Dressing: ' + outLine;
        outIng = typeof ing === 'object' ? { ...ing, line: outLine } : outLine;
      }
    }
    if (/^Dressing:\s*/i.test(outLine)) {
      dressing.push(outIng);
    } else {
      other.push(outIng);
    }
  }
  return other.concat(dressing);
}

// Initialize recipe ingredient ordering
RECIPES.forEach((r) => {
  r.ingredients = orderIngredientsDressingLast(r.ingredients);
});

// ── Plus-splitting & paren helpers ────────────────────────────────────────────

export function splitPlusAtDepthZero(s) {
  const parts = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (depth === 0 && s.slice(i, i + 3) === ' + ') {
      parts.push(buf.trim());
      buf = '';
      i += 2;
      continue;
    }
    buf += c;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

export function relocateTrailingDressingParen(amountsBody) {
  const trimmed = String(amountsBody || '').trim();
  if (!trimmed) return trimmed;
  const chunks = splitPlusAtDepthZero(trimmed);
  if (chunks.length < 2) return trimmed;
  const last = chunks[chunks.length - 1];
  const region = findFirstBalancedParenRegion(last);
  if (!region || region.pIdx <= 0) return trimmed;
  const beforeParen = last.slice(0, region.pIdx).trim();
  const inner = last.slice(region.pIdx + 1, region.end);
  const first = chunks[0];
  if (findFirstBalancedParenRegion(first)) return trimmed;
  const newFirst = `${first} (${inner})`;
  const out = [newFirst];
  for (let i = 1; i < chunks.length - 1; i++) out.push(chunks[i]);
  if (beforeParen) out.push(beforeParen);
  return out.join(' + ');
}

// ── Dressing rendering (HTML) ─────────────────────────────────────────────────

export function boldCompositeDressingBody(body) {
  body = normalizeTextPunctuation(body).trim();
  if (!body) return '';

  const { amount, rest } = parseIngredient(body);
  if (amount) {
    const disp = formatAmountForDisplay(amount, rest);
    const needsOf = /^(pinch|pinches|dash|dashes|handful|handfuls)$/i.test(String(amount).trim());
    return `<span class="amount">${escapeHtml(disp)}</span> ${needsOf ? 'of ' : ''}${boldCompositeDressingBody(rest)}`;
  }

  if (body.startsWith('(')) {
    let depth = 0;
    let end = -1;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '(') depth++;
      if (body[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end > 0) {
      const inner = body.slice(1, end);
      const after = body.slice(end + 1).trim();
      return (
        boldCompositeDressingBody(inner) + (after ? ' ' + boldCompositeDressingBody(after) : '')
      );
    }
  }

  const pIdx = body.indexOf('(');
  if (pIdx > 0) {
    let depth = 0;
    let end = -1;
    for (let i = pIdx; i < body.length; i++) {
      if (body[i] === '(') depth++;
      if (body[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end > 0) {
      const before = body.slice(0, pIdx);
      const inner = body.slice(pIdx + 1, end);
      const after = body.slice(end + 1).trim();
      const head = escapeHtml(before.trimEnd());
      const mid = boldCompositeDressingBody(inner);
      const tail = after ? ' ' + boldCompositeDressingBody(after) : '';
      return (head ? head + ' ' : '') + mid + tail;
    }
  }

  const chunks = splitPlusAtDepthZero(body);
  if (chunks.length > 1) {
    return chunks
      .map((ch, i) => {
        let c = ch;
        if (i === 0 && /^or\s+/i.test(c)) c = c.replace(/^or\s+/i, '');
        const part = boldCompositeDressingBody(c);
        return (i > 0 ? ' + ' : '') + part;
      })
      .join('');
  }

  return escapeHtml(body);
}

function renderDressingTermsWithAmountsHtml(body: string): string {
  const trimmed = String(body || '').trim();
  if (!trimmed) return '';
  const chunks = splitPlusAtDepthZero(trimmed);
  const out: string[] = [];
  const seenKeys = new Set<string>();

  const isHerbLike = (t: string) =>
    /\b(parsley|cilantro|coriander leaves|dill|chives|basil|mint|oregano|thyme|rosemary|tarragon|herbs?)\b/i.test(
      t
    );

  const defaultAmountForUnquantified = (t: string): string | null => {
    const s = String(t || '').trim().toLowerCase();
    if (!s) return null;
    if (isHerbLike(s)) return null;
    if (/\bgarlic\b/.test(s)) return '1 clove';
    if (/\bshallot\b/.test(s)) return '1 tbsp';
    if (/\b(dijon|mustard)\b/.test(s)) return '1 tsp';
    if (/\bsoy sauce\b/.test(s)) return '1 tsp';
    if (/\b(tamari)\b/.test(s)) return '1 tsp';
    if (/\b(worcestershire)\b/.test(s)) return '1 tsp';
    if (/\b(parmesan|pecorino|nutritional yeast)\b/.test(s)) return '2 tbsp';
    if (/\b(miso)\b/.test(s)) return '1 tsp';
    if (/\b(honey|maple syrup|monk fruit)\b/.test(s)) return '1 tsp';
    if (/\b(vinegar|lemon juice|lime juice)\b/.test(s)) return '1 tbsp';
    if (/\b(olive oil|sesame oil|oil)\b/.test(s)) return '1 tbsp';
    if (/\b(hot sauce|buffalo|sriracha|chili crisp)\b/.test(s)) return '1 tbsp';
    if (/\b(salt|pepper)\b/.test(s)) return '¼ tsp';
    return '1 tsp';
  };

  for (let i = 0; i < chunks.length; i++) {
    let c = String(chunks[i] || '').trim();
    if (!c) continue;
    if (i === 0 && /^or\s+/i.test(c)) c = c.replace(/^or\s+/i, '');
    // Preserve per-term highlighting inside parentheticals (e.g. "ranch (½ tbsp mayo + …)").
    // `boldCompositeDressingBody` already highlights any nested amounts.
    if (findFirstBalancedParenRegion(c)) {
      out.push(boldCompositeDressingBody(c));
      continue;
    }
    const { amount, rest } = parseIngredient(c);
    if (amount && rest) {
      // De-dupe common near-synonyms (e.g. "extra-virgin olive oil" vs "olive oil").
      const k0 = normalizeIngredientRestForKey(rest)
        .replace(/\bextra-virgin\s+olive\s+oil\b/g, 'olive oil')
        .trim();
      if (k0 && seenKeys.has(k0)) continue;
      if (k0) seenKeys.add(k0);
      const disp = formatAmountForDisplay(amount, rest);
      const needsOf = /^(pinch|pinches|dash|dashes|handful|handfuls)$/i.test(
        String(amount).trim()
      );
      out.push(
        `<span class="amount">${escapeHtml(disp)}</span>${needsOf ? ' of ' : ''}${boldCompositeDressingBody(rest)}`
      );
      continue;
    }
    // No explicit amount: for herbs, show the term as-is; otherwise, inject a reasonable default amount.
    const amt = defaultAmountForUnquantified(c);
    if (!amt) {
      const k0 = normalizeIngredientRestForKey(c)
        .replace(/\bextra-virgin\s+olive\s+oil\b/g, 'olive oil')
        .trim();
      if (k0 && seenKeys.has(k0)) continue;
      if (k0) seenKeys.add(k0);
      out.push(escapeHtml(c));
    } else {
      const k0 = normalizeIngredientRestForKey(c)
        .replace(/\bextra-virgin\s+olive\s+oil\b/g, 'olive oil')
        .trim();
      if (k0 && seenKeys.has(k0)) continue;
      if (k0) seenKeys.add(k0);
      const needsOf = /^(pinch|pinches|dash|dashes|handful|handfuls)$/i.test(String(amt).trim());
      const disp = formatAmountForDisplay(amt, c);
      out.push(
        `<span class="amount">${escapeHtml(disp)}</span>${needsOf ? ' of ' : ''}${escapeHtml(c)}`
      );
    }
  }
  const termSpans = out.map((html) => `<span class="dressing-diy-term">${html}</span>`);
  return termSpans.join(' <span class="dressing-diy-plus" aria-hidden="true">+</span> ');
}

export function stripCompositeDressingAmounts(body) {
  body = body.trim();
  if (!body) return '';
  if (/^of\s+/i.test(body)) {
    return stripCompositeDressingAmounts(body.replace(/^of\s+/i, ''));
  }

  const { amount, rest } = parseIngredient(body);
  if (amount) {
    return stripCompositeDressingAmounts(rest);
  }

  if (body.startsWith('(')) {
    let depth = 0;
    let end = -1;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '(') depth++;
      if (body[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end > 0) {
      const inner = body.slice(1, end);
      const after = body.slice(end + 1).trim();
      return '(' + stripCompositeDressingAmounts(inner) + ')' + (after ? ' ' + stripCompositeDressingAmounts(after) : '');
    }
  }

  const pIdx = body.indexOf('(');
  if (pIdx > 0) {
    let depth = 0;
    let end = -1;
    for (let i = pIdx; i < body.length; i++) {
      if (body[i] === '(') depth++;
      if (body[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end > 0) {
      const before = body.slice(0, pIdx);
      const inner = body.slice(pIdx + 1, end);
      const after = body.slice(end + 1).trim();
      return before + '(' + stripCompositeDressingAmounts(inner) + ')' + (after ? ' ' + stripCompositeDressingAmounts(after) : '');
    }
  }

  const chunks = splitPlusAtDepthZero(body);
  if (chunks.length > 1) {
    return chunks
      .map((ch, i) => {
        let c = ch;
        if (i === 0 && /^or\s+/i.test(c)) c = c.replace(/^or\s+/i, '');
        return (i > 0 ? ' + ' : '') + stripCompositeDressingAmounts(c);
      })
      .join('');
  }

  return body;
}

export function findFirstBalancedParenRegion(s) {
  const pIdx = s.indexOf('(');
  if (pIdx <= 0) return null;
  let depth = 0;
  for (let i = pIdx; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return { pIdx, end: i };
    }
  }
  return null;
}

export function displayComboSegmentLabel(raw) {
  const t = String(raw).trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function displayDressingPartLabel(raw) {
  const t = String(raw || '').trim();
  if (!t) return t;
  // Prefer nice-looking acronyms for short labels like bbq, blt, etc.
  if (/^[a-z]{2,4}$/.test(t)) return t.toUpperCase();
  return displayComboSegmentLabel(t.toLowerCase());
}

export function titleCaseWordsPreservingAcronyms(raw) {
  const s = String(raw || '').trim();
  if (!s) return s;
  return s
    .split(/\s+/g)
    .map((token) => {
      if (!token) return token;
      if (/^[A-Z0-9]{2,}$/.test(token)) return token;
      return token
        .split('-')
        .map((part) => {
          if (!part) return part;
          if (/^[A-Z0-9]{2,}$/.test(part)) return part;
          const lower = part.toLowerCase();
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('-');
    })
    .join(' ');
}

export function dressingChunkLabel(chunk) {
  let c = String(chunk).trim();
  if (!c) return c;
  const region = findFirstBalancedParenRegion(c);
  const namePart = region ? c.slice(0, region.pIdx).trim() : c;
  if (!namePart) return c;
  const { amount, rest } = parseIngredient(namePart);
  const base = (amount && rest ? rest : namePart).trim();
  return base || namePart;
}

export function renderSingleDressingBlockHtml(chunk) {
  let c = String(chunk).trim();
  if (/^or\s+/i.test(c)) c = c.replace(/^or\s+/i, '');
  const region = findFirstBalancedParenRegion(c);
  if (!region) {
    return (
      '<span class="dressing-heading dressing-heading-single">' +
      '<span class="dressing-prefix">dressing:</span> ' +
      `<span class="dressing-single-name">${boldCompositeDressingBody(c)}</span></span>`
    );
  }
  const { pIdx, end } = region;
  const label = c.slice(0, pIdx).trim();
  const inner = c.slice(pIdx + 1, end);
  const after = c.slice(end + 1).trim();
  if (!label) {
    return (
      '<span class="dressing-heading dressing-heading-single">' +
      '<span class="dressing-prefix">dressing:</span> ' +
      `<span class="dressing-single-name">${boldCompositeDressingBody(c)}</span></span>`
    );
  }
  const innerForDisplay = formatState.showAmounts ? keepOnlyQuantifiedDressingTerms(inner) : inner;
  const afterForDisplay = formatState.showAmounts ? keepOnlyQuantifiedDressingTerms(after) : after;
  let body = '';
  if (innerForDisplay) {
    body += `<span class="dressing-recipe dressing-recipe-below">${boldCompositeDressingBody(innerForDisplay)}</span>`;
  }
  if (afterForDisplay) body += `<span class="dressing-tail"> ${boldCompositeDressingBody(afterForDisplay)}</span>`;
  if (!body) {
    return (
      '<span class="dressing-heading dressing-heading-single">' +
      '<span class="dressing-prefix">dressing:</span> ' +
      `<span class="dressing-single-name">${boldCompositeDressingBody(label)}</span></span>`
    );
  }
  return (
    '<span class="dressing-heading dressing-heading-single">' +
    '<span class="dressing-prefix">dressing:</span> ' +
    `<span class="dressing-single-name">${boldCompositeDressingBody(label)}</span></span>` +
    `<span class="dressing-stack dressing-stack-single">${body}</span>`
  );
}

export function formatDressingComboPartLine(chunk) {
  let c = chunk.trim();
  const region = findFirstBalancedParenRegion(c);
  if (!region) {
    return `<span class="dressing-line dressing-line-combo-part dressing-line-flat">${boldCompositeDressingBody(c)}</span>`;
  }
  const { pIdx, end } = region;
  const labelDisp = escapeHtml(displayComboSegmentLabel(dressingChunkLabel(c)));
  const inner = c.slice(pIdx + 1, end);
  const after = c.slice(end + 1).trim();
  const innerForDisplay = formatState.showAmounts ? keepOnlyQuantifiedDressingTerms(inner) : inner;
  const afterForDisplay = formatState.showAmounts ? keepOnlyQuantifiedDressingTerms(after) : after;
  if (!innerForDisplay && !afterForDisplay) return '';
  let html =
    '<span class="dressing-line dressing-line-combo-part">' +
    `<span class="dressing-part-label">${labelDisp}:</span> ` +
    `<span class="dressing-recipe-inline">${boldCompositeDressingBody(innerForDisplay)}</span>`;
  if (afterForDisplay) html += `<span class="dressing-tail"> ${boldCompositeDressingBody(afterForDisplay)}</span>`;
  html += '</span>';
  return html;
}

/** One DIY combo row as an `<li>` matching `ingredients-list` markup (bullet + body). */
export function formatDressingDiyComboPartLine(chunk) {
  let c = chunk.trim();
  const region = findFirstBalancedParenRegion(c);
  const labelDisp = escapeHtml(displayDressingPartLabel(dressingChunkLabel(c)));
  const rowBody = (innerRecipeHtml) =>
    `<li>` +
    `<span class="bullet" aria-hidden="true"></span>` +
    `<span class="ingredient-body dressing-diy-line-body">` +
    innerRecipeHtml +
    `</span></li>`;
  if (!region) {
    return rowBody(
      `<span class="dressing-diy-part-label">${labelDisp}:</span> ` +
        `<span class="dressing-diy-part-recipe">${boldCompositeDressingBody(c)}</span>`
    );
  }
  const { pIdx, end } = region;
  const inner = c.slice(pIdx + 1, end);
  const after = c.slice(end + 1).trim();
  const innerForDisplay = formatState.showAmounts ? keepOnlyQuantifiedDressingTerms(inner) : inner;
  const afterForDisplay = formatState.showAmounts ? keepOnlyQuantifiedDressingTerms(after) : after;
  if (!innerForDisplay && !afterForDisplay) return '';
  let recipe = '';
  if (innerForDisplay) {
    recipe += `<span class="dressing-diy-part-recipe-inner">${boldCompositeDressingBody(innerForDisplay)}</span>`;
  }
  if (afterForDisplay) {
    recipe += `<span class="dressing-diy-part-recipe-tail">${innerForDisplay ? ' ' : ''}${boldCompositeDressingBody(afterForDisplay)}</span>`;
  }
  return rowBody(
    `<span class="dressing-diy-part-label">${labelDisp}:</span> ` + `<span class="dressing-diy-part-recipe">${recipe}</span>`
  );
}

function wrapDressingDiyIngredientsList(liOrBodyHtml) {
  const inner = String(liOrBodyHtml || '').trim();
  if (!inner) return '';
  if (/^\s*<li[\s>]/i.test(inner)) {
    return `<ul class="ingredients-list dressing-diy-ingredients-list">${inner}</ul>`;
  }
  return (
    `<ul class="ingredients-list dressing-diy-ingredients-list">` +
    `<li><span class="bullet" aria-hidden="true"></span><span class="ingredient-body dressing-diy-line-body">${inner}</span></li>` +
    `</ul>`
  );
}

export function keepOnlyQuantifiedDressingTerms(body) {
  const src = String(body || '').trim();
  if (!src) return '';
  const chunks = splitPlusAtDepthZero(src);
  if (chunks.length > 1) {
    const kept = chunks
      .map((c) => keepOnlyQuantifiedDressingTerms(c))
      .map((c) => c.trim())
      .filter(Boolean);
    return kept.join(' + ');
  }
  const t = src.trim();
  const { amount } = parseIngredient(t);
  return amount ? t : '';
}

export function renderDressingBlockHtml(body) {
  let trimmed = body.trim();
  if (formatState.showAmounts) trimmed = relocateTrailingDressingParen(trimmed);
  trimmed = trimmed.trim();
  if (!trimmed) return '';
  const chunks = splitPlusAtDepthZero(trimmed);
  if (chunks.length <= 1) {
    return renderSingleDressingBlockHtml(trimmed);
  }
  const comboTitle = chunks
    .map((ch, i) => {
      let c = ch.trim();
      if (i === 0 && /^or\s+/i.test(c)) c = c.replace(/^or\s+/i, '');
      return escapeHtml(displayComboSegmentLabel(dressingChunkLabel(c)).toLowerCase());
    })
    .join(' + ');
  const partLines = chunks
    .map((ch, i) => {
      let c = ch.trim();
      if (i === 0 && /^or\s+/i.test(c)) c = c.replace(/^or\s+/i, '');
      if (!findFirstBalancedParenRegion(c)) return '';
      return formatDressingComboPartLine(c);
    })
    .join('');
  return (
    `<span class="dressing-heading dressing-heading-combo"><span class="dressing-prefix">dressing:</span> ` +
    `<span class="dressing-combo-names">${comboTitle}</span></span>` +
    `<span class="dressing-stack dressing-stack-combo">${partLines}</span>`
  );
}

/** First segment before `//` on a `Dressing:` line (conceptual / shopper wording). */
export function dressingConceptualSegment(fullDressingLine) {
  const parts = dressingVariantBodies(fullDressingLine);
  return (parts[0] || '').trim();
}

/** Short name(s) for DIY headings — capitalized, e.g. "Ranch", "Caesar + Buffalo". */
export function dressingDiyHeadingTitle(fullDressingLine) {
  const body = dressingConceptualSegment(fullDressingLine);
  if (!body) return 'Dressing';
  let trimmed = body;
  if (/^or\s+/i.test(trimmed)) trimmed = trimmed.replace(/^or\s+/i, '');
  const chunks = splitPlusAtDepthZero(trimmed);
  const segTitle = (ch) => {
    let c = ch.trim();
    if (/^or\s+/i.test(c)) c = c.replace(/^or\s+/i, '');
    return titleCaseWordsPreservingAcronyms(displayDressingPartLabel(dressingChunkLabel(c)));
  };
  if (chunks.length <= 1) {
    return segTitle(trimmed);
  }
  return chunks.map(segTitle).join(' + ');
}

/** Plain text for the main ingredients list (same weight as other lines). */
export function dressingShopperLineText(fullDressingLine) {
  const title = dressingDiyHeadingTitle(fullDressingLine);
  let line;
  if (!title) line = 'dressing';
  else if (/\b(dressing|vinaigrette)\b/i.test(title)) line = title;
  else line = `${title} dressing`;
  return line.toLowerCase();
}

export function dressingHasDiyBreakdown(fullDressingLine) {
  // Only treat as DIY when there's an actual sub-recipe structure (balanced parens),
  // not when the dressing is already authored as a plain ingredient list.
  const adaptedLine = resolveIngredientDisplayLine(fullDressingLine, formatState.activeDiet || null);
  const parts = dressingVariantBodies(adaptedLine);
  const conceptual = dressingConceptualSegment(adaptedLine);
  if (!conceptual) return false;

  const candidates = [conceptual, ...(parts.length >= 2 ? [parts[parts.length - 1]] : [])];
  for (const candRaw of candidates) {
    let cand = String(candRaw || '').trim();
    if (!cand) continue;
    if (/^or\s+/i.test(cand)) cand = cand.replace(/^or\s+/i, '');
    const chunks = splitPlusAtDepthZero(cand);
    for (let i = 0; i < chunks.length; i++) {
      let c = chunks[i].trim();
      if (i === 0 && /^or\s+/i.test(c)) c = c.replace(/^or\s+/i, '');
      if (findFirstBalancedParenRegion(c)) return true;
    }
  }
  return false;
}

/** HTML body only (no wrapper) for the DIY dressing block. */
export function renderDressingDiyBodyHtml(fullDressingLine) {
  // Use the same diet-adapted dressing string as the main list so DIY never shows dairy/meat/etc.
  // that the active diet already swaps in the full `Dressing:` line.
  const adaptedLine = resolveIngredientDisplayLine(fullDressingLine, formatState.activeDiet || null);
  const parts = dressingVariantBodies(adaptedLine);
  const conceptual = dressingConceptualSegment(adaptedLine);
  const amountPart = parts.length >= 2 ? parts[parts.length - 1].trim() : '';

  if (formatState.showAmounts && amountPart) {
    // Prefer the conceptual recipe (the part inside parens) so the DIY list stays consistent
    // between amount modes. The amountPart variant often omits small items like sugar.
    const src = relocateTrailingDressingParen(conceptual || amountPart).trim();
    if (!src) return '';
    const region = findFirstBalancedParenRegion(src);
    if (!region) {
      return wrapDressingDiyIngredientsList(renderDressingTermsWithAmountsHtml(src));
    }
    const inner = src.slice(region.pIdx + 1, region.end).trim();
    let after = src.slice(region.end + 1).trim();
    after = after.replace(/^\+\s*/g, '').trim();
    const body = inner + (after ? ` + ${after}` : '');
    return body ? wrapDressingDiyIngredientsList(renderDressingTermsWithAmountsHtml(body)) : '';
  }

  let trimmed = conceptual;
  if (!trimmed) return '';
  if (/^or\s+/i.test(trimmed)) trimmed = trimmed.replace(/^or\s+/i, '');
  if (formatState.showAmounts) trimmed = relocateTrailingDressingParen(trimmed);
  trimmed = trimmed.trim();
  if (!trimmed) return '';

  // If this is a simple `a + b + c` list (no parens), show an amount token for every term.
  if (formatState.showAmounts && !findFirstBalancedParenRegion(trimmed)) {
    return wrapDressingDiyIngredientsList(renderDressingTermsWithAmountsHtml(trimmed));
  }

  const chunks = splitPlusAtDepthZero(trimmed);
  if (chunks.length <= 1) {
    const region = findFirstBalancedParenRegion(trimmed);
    if (!region) return '';
    const { pIdx, end } = region;
    const inner = trimmed.slice(pIdx + 1, end);
    const after = trimmed.slice(end + 1).trim();
    const innerForDisplay = formatState.showAmounts ? keepOnlyQuantifiedDressingTerms(inner) : inner;
    const afterForDisplay = formatState.showAmounts ? keepOnlyQuantifiedDressingTerms(after) : after;
    let out = '';
    if (innerForDisplay) out += boldCompositeDressingBody(innerForDisplay);
    if (afterForDisplay) out += (out ? ' ' : '') + boldCompositeDressingBody(afterForDisplay);
    return out ? wrapDressingDiyIngredientsList(out) : '';
  }

  const partLines = chunks
    .map((ch, i) => {
      let c = ch.trim();
      if (i === 0 && /^or\s+/i.test(c)) c = c.replace(/^or\s+/i, '');
      return formatDressingDiyComboPartLine(c);
    })
    .filter(Boolean)
    .join('');
  return wrapDressingDiyIngredientsList(partLines);
}

export function renderDressingDiySectionHtml(fullDressingLine) {
  if (!dressingHasDiyBreakdown(fullDressingLine)) return '';
  const bodyHtml = renderDressingDiyBodyHtml(fullDressingLine);
  if (!String(bodyHtml || '').trim()) return '';
  const adaptedLine = resolveIngredientDisplayLine(fullDressingLine, formatState.activeDiet || null);
  const title = dressingDiyHeadingTitle(adaptedLine);
  return (
    `<div class="dressing-diy-section">` +
    `<div class="section-heading dressing-diy-heading">` +
    `<div class="section-heading-label"><span>🥄</span> DIY ${escapeHtml(title)}</div>` +
    `</div>` +
    `${bodyHtml}` +
    `</div>`
  );
}

// ── Plan overlap hint (HTML) ──────────────────────────────────────────────────

export function planOverlapHintHtml(str, ctx) {
  if (!ctx) return '';
  const line = ingredientLine(str);
  if (/^dressing:\s*/i.test(line)) return '';
  const { amount, rest } = parseIngredient(line);
  const restStr = rest != null && String(rest).trim() ? rest : line;
  if (!String(restStr).trim()) return '';
  const { key } = canonicalizeIngredientRest(restStr);
  const k = String(key || '')
    .toLowerCase()
    .trim();
  if (!k || OVERLAP_GENERIC_KEYS.has(k)) return '';
  if (!ctx.planKeys.has(k)) return '';
  const idToName = ctx.keyToRecipeNames.get(k);
  if (!idToName || idToName.size === 0) return '';
  const titles = [...idToName.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }))
    .map(([, name]) => name);
  const escapedParts = titles.map((t) => escapeHtml(t));
  let visibleInner;
  if (escapedParts.length === 1) {
    visibleInner = `Also in ${escapedParts[0]}`;
  } else if (escapedParts.length === 2) {
    visibleInner = `Also in ${escapedParts[0]} and ${escapedParts[1]}`;
  } else {
    visibleInner = `Also in ${escapedParts[0]}, ${escapedParts[1]}, +${titles.length - 2} more`;
  }
  const ariaLabel = `This ingredient also appears in: ${titles.join(', ')}`;
  return ` <span class="ingredient-plan-overlap-hint" aria-label="${escapeAttr(ariaLabel)}">${visibleInner}</span>`;
}

/**
 * When Smart Picks overlap hints are active, move ingredient lines that match the plan
 * (and ties broken by more plan recipes sharing that key) above the rest; dressing block stays last.
 */
export function sortIngredientsForPlanOverlapDisplay(ingredients, planHintCtx, activeDiet) {
  if (!planHintCtx || !ingredients?.length) return ingredients;
  const firstDressIdx = ingredients.findIndex((ing) => isDressingLine(ing));
  const end = firstDressIdx === -1 ? ingredients.length : firstDressIdx;
  const head = ingredients.slice(0, end);
  const tail = ingredients.slice(end);

  function lineRank(ing) {
    if (activeDiet && shouldOmitIngredient(ing, activeDiet)) return { tier: 2, recipeCount: 0 };
    if (isOptionalLine(ingredientLine(ing))) return { tier: 2, recipeCount: 0 };
    const { amount, rest } = parseIngredient(ingredientLine(ing));
    const restStr = rest != null && String(rest).trim() ? rest : ingredientLine(ing);
    if (!String(restStr).trim()) return { tier: 1, recipeCount: 0 };
    const { key } = canonicalizeIngredientRest(restStr);
    const k = String(key || '')
      .toLowerCase()
      .trim();
    if (!k || OVERLAP_GENERIC_KEYS.has(k)) return { tier: 1, recipeCount: 0 };
    if (!planHintCtx.planKeys.has(k)) return { tier: 1, recipeCount: 0 };
    const idToName = planHintCtx.keyToRecipeNames.get(k);
    const recipeCount = idToName && idToName.size > 0 ? idToName.size : 0;
    return { tier: 0, recipeCount };
  }

  const decorated = head.map((ing, origIdx) => ({ ing, origIdx, ...lineRank(ing) }));
  decorated.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.recipeCount !== a.recipeCount) return b.recipeCount - a.recipeCount;
    return a.origIdx - b.origIdx;
  });
  return [...decorated.map((x) => x.ing), ...tail];
}

// ── Ingredient rendering (HTML) ───────────────────────────────────────────────

export function renderIngredient(str, planHintCtx) {
  if (formatState.activeDiet && shouldOmitIngredient(str, formatState.activeDiet)) {
    return '';
  }
  if (!formatState.activeDiet && shouldHideIngredientForDefaultProteinPicker(str)) {
    return '';
  }

  const ingredientStr = normalizeTextPunctuation(
    resolveIngredientDisplayLine(str, formatState.activeDiet)
  );

  const planHint = planOverlapHintHtml(ingredientStr, planHintCtx);

  const dressingMatch = ingredientStr.match(/^Dressing:\s*(.*)$/i);
  if (dressingMatch) {
    const rest = (dressingMatch[1] || '').trim();
    const shopper = dressingShopperLineText(ingredientStr);
    const inner =
      !rest || !shopper.trim() ? escapeHtml(ingredientStr) : `${escapeHtml(shopper)}`;
    return `<li><span class="bullet"></span><span class="ingredient-body">${inner}${planHint}</span></li>`;
  }

  const { amount, rest } = parseIngredient(ingredientStr);
  let inner;
  if (!formatState.showAmounts) {
    inner = escapeHtml(ingredientLineWithoutAmounts(ingredientStr));
  } else if (!amount) {
    const body = ingredientLineWithoutAmounts(ingredientStr);
    const herbLike =
      /\b(parsley|cilantro|coriander leaves|dill|chives|basil|mint|oregano|thyme|rosemary|tarragon|herbs?)\b/i.test(
        body
      );
    if (herbLike) {
      inner = escapeHtml(body);
    } else {
      // Use the same defaults as DIY dressings: if we have no authored amount, infer a small reasonable one.
      let inferred = '1 tsp';
      const low = body.toLowerCase();
      if (/\bgarlic\b/.test(low)) inferred = '1 clove';
      else if (/\bshallot\b/.test(low)) inferred = '1 tbsp';
      else if (/\b(dijon|mustard)\b/.test(low)) inferred = '1 tsp';
      else if (/\bsoy sauce\b/.test(low) || /\btamari\b/.test(low) || /\bworcestershire\b/.test(low)) inferred = '1 tsp';
      else if (/\b(parmesan|pecorino|nutritional yeast)\b/.test(low)) inferred = '2 tbsp';
      else if (/\b(honey|maple syrup|monk fruit)\b/.test(low)) inferred = '1 tsp';
      else if (/\b(vinegar|lemon juice|lime juice)\b/.test(low)) inferred = '1 tbsp';
      else if (/\b(olive oil|sesame oil|oil)\b/.test(low)) inferred = '1 tbsp';
      else if (/\b(hot sauce|buffalo|sriracha|chili crisp)\b/.test(low)) inferred = '1 tbsp';
      else if (/\b(salt|pepper)\b/.test(low)) inferred = '¼ tsp';
      inner = `<span class="amount">${escapeHtml(formatAmountForDisplay(inferred, body))}</span> ${escapeHtml(body)}`;
    }
  } else {
    const disp = formatAmountForDisplay(amount, rest);
    inner = `<span class="amount">${escapeHtml(disp)}</span> ${escapeHtml(rest)}`;
  }
  return `<li><span class="bullet"></span><span class="ingredient-body">${inner}${planHint}</span></li>`;
}

// ── Step highlighting ─────────────────────────────────────────────────────────

export const INGREDIENT_STEP_STOP_PHRASES = new Set([
  'or',
  'and',
  'the',
  'a',
  'an',
  'to',
  'of',
  'as',
  'if',
  'in',
  'on',
  'at',
  'for',
  'up',
  'by',
]);

export function stripTrailingParentheticals(s) {
  let t = String(s).trim();
  let prev;
  do {
    prev = t;
    const m = t.match(/^(.+)\s*\([^()]*\)\s*$/);
    if (m) t = m[1].trim();
  } while (t !== prev);
  return t;
}

export const WEAK_PREP_PREFIX =
  /^(shredded|thinly|finely|roughly|grated|minced|chopped|diced|cubed|halved|sliced|crushed|packed|bagged|divided|frozen)\s+/i;

export const INGREDIENT_DROP_MIDDLE = new Set([
  'red',
  'white',
  'yellow',
  'green',
  'black',
  'fresh',
  'small',
  'large',
  'medium',
]);

export const LAST_WORD_PLURAL_PAIR = new Map([
  ['tomato', 'tomatoes'],
  ['tomatoes', 'tomato'],
  ['onion', 'onions'],
  ['onions', 'onion'],
  ['apple', 'apples'],
  ['apples', 'apple'],
  ['peach', 'peaches'],
  ['peaches', 'peach'],
  ['pear', 'pears'],
  ['pears', 'pear'],
  ['cucumber', 'cucumbers'],
  ['cucumbers', 'cucumber'],
  ['carrot', 'carrots'],
  ['carrots', 'carrot'],
  ['pepper', 'peppers'],
  ['peppers', 'pepper'],
  ['berry', 'berries'],
  ['berries', 'berry'],
  ['cherry', 'cherries'],
  ['cherries', 'cherry'],
  ['grape', 'grapes'],
  ['grapes', 'grape'],
  ['bean', 'beans'],
  ['beans', 'bean'],
  ['lime', 'limes'],
  ['limes', 'lime'],
  ['lemon', 'lemons'],
  ['lemons', 'lemon'],
  ['avocado', 'avocados'],
  ['avocados', 'avocado'],
  ['potato', 'potatoes'],
  ['potatoes', 'potato'],
]);

export const GREENS_STEP_TRIGGER =
  /\b(romaine|kale|lettuce|arugula|spinach|spring mix|mixed greens|mesclun|butter lettuce|endive|frisée|frisee|radicchio|mixed green)\b/i;

export function tokenizePhraseWords(s) {
  return String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function ingredientSuffixPhrases(words) {
  const out = [];
  const n = words.length;
  for (let i = 0; i < n; i++) {
    if (words[i].toLowerCase() === 'or') continue;
    const slice = words.slice(i);
    const phrase = slice.join(' ');
    if (phrase.length >= 2 && !INGREDIENT_STEP_STOP_PHRASES.has(phrase.toLowerCase())) out.push(phrase);
  }
  return out;
}

export function ingredientDropMiddleVariants(words) {
  const out = [];
  if (words.length < 3) return out;
  for (let j = 1; j < words.length - 1; j++) {
    if (INGREDIENT_DROP_MIDDLE.has(words[j].toLowerCase())) {
      out.push([...words.slice(0, j), ...words.slice(j + 1)].join(' '));
    }
  }
  return out;
}

export function ingredientPluralPhraseVariants(phrase) {
  const parts = tokenizePhraseWords(phrase);
  if (!parts.length) return [phrase];
  const last = parts[parts.length - 1];
  const low = last.toLowerCase();
  const altLast = LAST_WORD_PLURAL_PAIR.get(low);
  if (!altLast) return [phrase];
  const rebuilt = [...parts.slice(0, -1), altLast].join(' ');
  return rebuilt.toLowerCase() === phrase.toLowerCase() ? [phrase] : [phrase, rebuilt];
}

export function pushPhraseVariants(bucket, phrase) {
  const p = String(phrase).trim();
  if (p.length < 2 || INGREDIENT_STEP_STOP_PHRASES.has(p.toLowerCase())) return;
  bucket.push(p);
  for (const v of ingredientPluralPhraseVariants(p)) {
    if (v !== p) bucket.push(v);
  }
}

export function expandIngredientChunkToPhrases(rawChunk, bucket) {
  let base = stripTrailingParentheticals(rawChunk.trim());
  const bases = new Set([base]);
  const prep = base.replace(WEAK_PREP_PREFIX, '').trim();
  if (prep && prep !== base) bases.add(prep);

  for (const b of bases) {
    const comma = b.split(',')[0].trim();
    const variants = new Set([b]);
    if (comma !== b) variants.add(comma);

    for (const v of variants) {
      const words = tokenizePhraseWords(v);
      for (const suf of ingredientSuffixPhrases(words)) {
        pushPhraseVariants(bucket, suf);
        for (const dropped of ingredientDropMiddleVariants(tokenizePhraseWords(suf))) {
          for (const s2 of ingredientSuffixPhrases(tokenizePhraseWords(dropped))) {
            pushPhraseVariants(bucket, s2);
          }
        }
      }
    }
  }
}

export function maybePushGreensAlias(text, bucket) {
  if (GREENS_STEP_TRIGGER.test(text)) pushPhraseVariants(bucket, 'greens');
}

export function maybePushBbqAlias(text, bucket) {
  const t = String(text).trim();
  if (/^bbq\b/i.test(t)) pushPhraseVariants(bucket, 'BBQ');
}

function extractIngredientPhrasesFromStepText(stepText: string): string[] {
  const s = String(stepText || '').trim();
  if (!s) return [];
  const re =
    /\b(?:add|top(?:\s+with)?|sprinkle(?:\s+with)?|season(?:\s+with)?|toss(?:\s+with)?|mix(?:\s+in)?|stir(?:\s+in)?|fold(?:\s+in)?|garnish(?:\s+with)?|finish(?:\s+with)?|whisk(?:\s+in)?|combine)\b\s+([^.;]+)/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const blob = (m[1] || '').trim();
    if (!blob) continue;
    const parts = blob
      .split(/\s*(?:,|\+|\band\b)\s*/i)
      .map((x) => x.trim())
      .filter(Boolean);
    for (const p of parts) {
      const cleaned = p.replace(/\b(to\s+taste|as\s+needed)\b/gi, '').trim();
      if (cleaned.length < 2) continue;
      out.push(cleaned);
    }
  }
  return out;
}

export function collectIngredientHighlightPhrases(ingredientLines) {
  const phrases = [];
  for (const raw of ingredientLines) {
    const line = ingredientLine(raw);
    const dressingLineMatch = line.match(/^Dressing:\s*(.*)$/i);
    if (dressingLineMatch && dressingLineMatch[1].trim()) {
      const raw = dressingLineMatch[1].trim();
      const variants = raw.split(DRESSING_VARIANT_SPLIT).map((s) => s.trim()).filter(Boolean);
      for (const variant of variants) {
        const stripped = stripCompositeDressingAmounts(variant);
        for (const part of stripped.split(/\s*\+\s*/)) {
          const t = part.trim();
          expandIngredientChunkToPhrases(t, phrases);
          maybePushBbqAlias(t, phrases);
        }
      }
    } else {
      const { amount, rest } = parseIngredient(line);
      const raw = (amount ? rest : line).trim();
      const chunks = raw.includes(' + ') ? splitPlusAtDepthZero(raw) : [raw];
      for (const ch of chunks) {
        expandIngredientChunkToPhrases(ch, phrases);
        maybePushGreensAlias(ch, phrases);
        maybePushBbqAlias(ch, phrases);
      }
    }
  }
  const seen = new Set();
  const out = [];
  for (const p of phrases) {
    const low = p.toLowerCase();
    if (seen.has(low)) continue;
    if (p.length < 2 || INGREDIENT_STEP_STOP_PHRASES.has(low)) continue;
    seen.add(low);
    out.push(p);
  }
  for (const hard of ['salt', 'pepper']) {
    if (!seen.has(hard)) out.push(hard);
  }
  return out.sort((a, b) => b.length - a.length);
}

export function buildIngredientPhraseStartPattern(phrase) {
  const parts = phrase.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return new RegExp(`^${parts.map(escapeRegExp).join('\\s+')}\\b`, 'i');
}

/** "Optional: add salami or…" style steps — redundant now that Add a protein exists */
export function isOptionalProteinUpsellStep(stepText: string): boolean {
  const s = String(stepText).trim();
  if (!/^optional:\s*/i.test(s)) return false;
  if (/\bgrilled\s+chicken\s+or\s+chickpeas\b/i.test(s)) return true;
  if (/\b(salami|pepperoni|prosciutto|anchov)/i.test(s)) return true;
  if (/\brotisserie\b/i.test(s) && /\bchicken\b/i.test(s)) return true;
  return false;
}

function cleanServeImmediatelyStep(stepText: string): { keep: boolean; text: string } {
  let s = String(stepText || '').trim();
  if (!s) return { keep: false, text: '' };

  // Keep chill/rest steps (these are useful actions).
  if (/\b(chill|refrigerate|rest|let\s+sit)\b/i.test(s)) return { keep: true, text: s };

  // Remove pure "Serve/Enjoy/Dig in" steps.
  if (/^(serve|enjoy|dig\s+in)\b/i.test(s)) return { keep: false, text: '' };

  // If the step ends with "and serve immediately/right away", drop that tail.
  s = s
    .replace(/\s*(?:[,.;:]?\s*)?\b(?:and\s+)?serve\s+(?:immediately|right\s+away)\b\.?\s*$/i, '')
    .replace(/\s*(?:[,.;:]?\s*)?\b(?:and\s+)?enjoy\b\.?\s*$/i, '')
    .replace(/\s*(?:[,.;:]?\s*)?\b(?:and\s+)?dig\s+in\b\.?\s*$/i, '')
    .trim();

  if (!s) return { keep: false, text: '' };
  return { keep: true, text: s };
}

function findIndexForSyntheticProteinStep(steps: string[]): number {
  for (let i = 0; i < steps.length; i++) {
    if (/^optional:\s*finish/i.test(steps[i].trim())) return i;
  }
  for (let i = 0; i < steps.length; i++) {
    if (/^(serve|enjoy|chill|dig\s+in)/i.test(steps[i].trim())) return i;
  }
  return -1;
}

/** Same adaptation as `adaptStepText` for a single step (for step-list logic; uses `formatState.activeDiet`). */
function adaptBaseStepForProteinListing(
  stepText: string,
  recipe: Recipe,
  selectedProtein: string
): string {
  if (formatState.activeDiet) {
    return adaptStepForDiet(stepText, recipe, formatState.activeDiet, selectedProtein);
  }
  return adaptStepForProteinSwap(stepText, selectedProtein);
}

/** True when swappable placeholders were already replaced so the protein name appears in an earlier step. */
function adaptedStepsAlreadyMentionSelectedProtein(
  steps: string[],
  recipe: Recipe,
  selectedProtein: string
): boolean {
  const name = getProteinStepName(selectedProtein);
  if (!name) return false;
  const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i');
  for (const st of steps) {
    if (re.test(adaptBaseStepForProteinListing(st, recipe, selectedProtein))) return true;
  }
  return false;
}

/**
 * With no optional protein selected, swappable tokens (chicken, shrimp, …) are stripped from steps.
 * Some steps then lose their direct object (“Toss in buffalo sauce.”) — omit until a protein is chosen.
 */
function isStepUnusableWithoutOptionalProtein(stepText: string, recipe: Recipe): boolean {
  const activeDiet = formatState.activeDiet;
  const adapted = activeDiet
    ? adaptStepForDiet(stepText, recipe, activeDiet, null)
    : adaptStepForProteinSwap(stepText, null);
  const t = adapted.trim();
  if (!t) return true;
  if (stepText.trim() === t) return false;
  return /^\s*(toss|coat|mix|dredge|dip|turn)\s+in\b/i.test(t);
}

export function buildSyntheticSelectedProteinStep(selectedFullName: string): string {
  const n = getProteinStepName(selectedFullName);
  return `${SYNTHETIC_SELECTED_PROTEIN_STEP_PREFIX}Add ${n} to the salad before serving.`;
}

export function recipeStepsForDisplay(recipe: Recipe, selectedProtein: string | null): string[] {
  const base = (recipe.steps || [])
    .filter((st) => !isOptionalProteinUpsellStep(st))
    .map((st) => cleanServeImmediatelyStep(st))
    .filter((x) => x.keep)
    .map((x) => x.text);

  const steps = !selectedProtein
    ? base.filter((st) => !isStepUnusableWithoutOptionalProtein(st, recipe))
    : base;

  if (!selectedProtein) return steps;
  if (adaptedStepsAlreadyMentionSelectedProtein(steps, recipe, selectedProtein)) {
    return steps;
  }
  const synthetic = buildSyntheticSelectedProteinStep(selectedProtein);
  const idx = findIndexForSyntheticProteinStep(steps);
  if (idx >= 0) {
    return [...steps.slice(0, idx), synthetic, ...steps.slice(idx)];
  }
  return [...steps, synthetic];
}

export function adaptStepText(stepText, recipe) {
  const selectedProtein = formatState.selectedProteinByRecipe[recipe.id] || null;
  if (formatState.activeDiet) {
    return adaptStepForDiet(stepText, recipe, formatState.activeDiet, selectedProtein);
  }
  return adaptStepForProteinSwap(stepText, selectedProtein);
}

export function formatStepLineHtml(stepText, recipe) {
  const raw = String(stepText);
  const step = adaptStepText(raw, recipe);
  const selectedProtein = formatState.selectedProteinByRecipe[recipe.id] || null;
  if (selectedProtein && isSyntheticSelectedProteinStep(raw)) {
    const w = getProteinStepName(selectedProtein);
    if (w) {
      const re = new RegExp(`(${escapeRegExp(w)})`, 'gi');
      const parts = step.split(re);
      let html = '';
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1) {
          html += `<span class="step-ingredient">${escapeHtml(parts[i])}</span>`;
        } else {
          html += escapeHtml(parts[i]);
        }
      }
      return html;
    }
  }
  const phrases = collectIngredientHighlightPhrases(recipe.ingredients || []);
  for (const chunk of extractIngredientPhrasesFromStepText(step)) {
    expandIngredientChunkToPhrases(chunk, phrases);
    maybePushGreensAlias(chunk, phrases);
    maybePushBbqAlias(chunk, phrases);
  }
  if (selectedProtein) {
    const words = getProteinStepName(selectedProtein);
    if (words) phrases.push(words);
  }
  if (!phrases.length) return escapeHtml(step);
  const patterns = phrases
    .map((p) => buildIngredientPhraseStartPattern(p))
    .filter(Boolean);
  let i = 0;
  let html = '';
  while (i < step.length) {
    let bestLen = 0;
    const sub = step.slice(i);
    for (const re of patterns) {
      const m = sub.match(re);
      if (m && m[0].length > bestLen) bestLen = m[0].length;
    }
    if (bestLen > 0) {
      const chunk = step.slice(i, i + bestLen);
      html += `<span class="step-ingredient">${escapeHtml(chunk)}</span>`;
      i += bestLen;
    } else {
      html += escapeHtml(step[i]);
      i++;
    }
  }
  return html;
}

// ── Clipboard functions ───────────────────────────────────────────────────────

export function formatPlainIngredientChunk(ch) {
  const t = normalizeTextPunctuation(ch).trim();
  if (!t) return '';
  if (!formatState.showAmounts) {
    return ingredientLineWithoutAmounts(t);
  }
  const { amount, rest } = parseIngredient(t);
  if (amount && rest) {
    const a = formatAmountForDisplay(amount, rest);
    return `${a} ${rest}`.trim();
  }
  return t;
}

export function plainSubrecipeItemLinesOnly(innerRaw, trailingAfter) {
  const inner = String(innerRaw).trim();
  let parts = splitPlusAtDepthZero(inner).filter(Boolean);
  if (!parts.length && inner) parts = [inner];
  const lines = parts
    .map((p) => formatPlainIngredientChunk(p.trim()))
    .filter(Boolean);
  if (trailingAfter) {
    const t = formatPlainIngredientChunk(trailingAfter.trim());
    if (t) lines.push(t);
  }
  return lines;
}

export function normalizeDressingChunkForClipboard(ch, i) {
  let c = String(ch).trim();
  if (i === 0 && /^or\s+/i.test(c)) c = c.replace(/^or\s+/i, '');
  return c;
}

export function plainDressingDiyBlockFromChunk(chunk, chunkIndex) {
  const c = normalizeDressingChunkForClipboard(String(chunk).trim(), chunkIndex);
  if (!c) return '';
  const region = findFirstBalancedParenRegion(c);
  const label = dressingChunkLabel(c).toLowerCase();
  if (!region) {
    const line = formatPlainIngredientChunk(c);
    return line ? `DIY ${label}:\n${line}` : `DIY ${label}:`;
  }
  const inner = c.slice(region.pIdx + 1, region.end);
  const after = c.slice(region.end + 1).trim();
  const items = plainSubrecipeItemLinesOnly(inner, after);
  if (!items.length) return `DIY ${label}:`;
  return `DIY ${label}:\n${items.join('\n')}`;
}

/** One clipboard line: `caesar: mayo + lemon + …` (lowercase dressing name). */
export function plainDressingDiyRecipeLineFromChunk(chunk, chunkIndex) {
  const c = normalizeDressingChunkForClipboard(String(chunk).trim(), chunkIndex);
  if (!c) return '';
  const region = findFirstBalancedParenRegion(c);
  const label = displayDressingPartLabel(dressingChunkLabel(c));
  if (!region) return '';
  const inner = c.slice(region.pIdx + 1, region.end);
  const after = c.slice(region.end + 1).trim();
  const items = plainSubrecipeItemLinesOnly(inner, after);
  if (!items.length) return '';
  return `${label}: ${items.join(' + ')}`;
}

export function dressingHeadlineLowerForClipboard(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^dressing:\s*(.*)$/i);
  const body = (m ? m[1] : s).trim().toLowerCase();
  return body ? `dressing: ${body}` : 'dressing:';
}

/**
 * @param body - `pickDressingBodyFromLine` segment (conceptual or amounts variant).
 * @param fullDressingLine - Full resolved `Dressing: …` line (for shopper headline). Defaults to `Dressing: ${body}`.
 */
export function plainDressingForClipboard(body, fullDressingLine) {
  const trimmed = body.trim();
  const fullLine =
    fullDressingLine && String(fullDressingLine).trim()
      ? String(fullDressingLine).trim()
      : `Dressing: ${trimmed}`;

  /** Same idea as the bullet in the UI (`dressingShopperLineText`), then `dressing:` prefix for plain-text copy. */
  const shopperDressingListLine = () => {
    const shopper = dressingShopperLineText(fullLine);
    return shopper ? `dressing: ${shopper}` : 'dressing:';
  };

  const withShopperLineBeforeDiy = (diyBlock) => `${shopperDressingListLine()}\n\n${diyBlock}`;

  const rawChunks = splitPlusAtDepthZero(trimmed);
  const chunks = rawChunks.map((ch, i) => normalizeDressingChunkForClipboard(ch, i)).filter(Boolean);
  if (!chunks.length) return dressingHeadlineLowerForClipboard(trimmed);

  if (chunks.length === 1) {
    const c = chunks[0];
    const region = findFirstBalancedParenRegion(c);
    if (region) {
      const title = dressingChunkLabel(c).toLowerCase();
      const row = plainDressingDiyRecipeLineFromChunk(c, 0);
      const diy = row ? `DIY ${title}\n${row}` : `DIY ${title}`;
      return withShopperLineBeforeDiy(diy);
    }
    return dressingHeadlineLowerForClipboard(formatPlainIngredientChunk(c));
  }

  // Only include a DIY block when at least one segment has a sub-recipe (parens).
  if (!chunks.some((c) => findFirstBalancedParenRegion(c))) {
    return dressingHeadlineLowerForClipboard(trimmed);
  }

  const title = chunks.map((c) => dressingChunkLabel(c).toLowerCase()).join(' + ');
  const rowLines = [];
  for (let i = 0; i < chunks.length; i++) {
    const line = plainDressingDiyRecipeLineFromChunk(chunks[i], i);
    if (line) rowLines.push(line);
  }
  if (!rowLines.length) return dressingHeadlineLowerForClipboard(trimmed);
  return withShopperLineBeforeDiy(['DIY ' + title, ...rowLines].join('\n'));
}

export function ingredientLineForClipboard(str) {
  if (formatState.activeDiet && shouldOmitIngredient(str, formatState.activeDiet)) {
    return '';
  }
  if (!formatState.activeDiet && shouldHideIngredientForDefaultProteinPicker(str)) {
    return '';
  }

  const s = resolveIngredientDisplayLine(str, formatState.activeDiet);

  const dressingClipboardMatch = s.match(/^Dressing:\s*(.*)$/i);
  if (dressingClipboardMatch) {
    const body = pickDressingBodyFromLine(s);
    if (!body.trim()) return s;
    return plainDressingForClipboard(body, s);
  }

  if (!formatState.showAmounts) {
    return ingredientLineWithoutAmounts(s);
  }

  const { amount, rest } = parseIngredient(s);
  if (amount && rest) {
    return `${formatAmountForDisplay(amount, rest)} ${rest}`;
  }
  return s;
}

export function ingredientLineForClipboardSingleRecipe(str) {
  if (formatState.activeDiet && shouldOmitIngredient(str, formatState.activeDiet)) {
    return '';
  }
  if (!formatState.activeDiet && shouldHideIngredientForDefaultProteinPicker(str)) {
    return '';
  }

  const s = resolveIngredientDisplayLine(str, formatState.activeDiet);

  const dressingClipboardMatch = s.match(/^Dressing:\s*(.*)$/i);
  if (!dressingClipboardMatch) return ingredientLineForClipboard(s);
  const body = pickDressingBodyFromLine(s);
  if (!body.trim()) return s;
  return plainDressingForClipboard(body, s);
}

export function withClipboardOptions(opts, fn) {
  const prev = {
    recipePortions: formatState.recipePortions,
    showAmounts: formatState.showAmounts,
    unitMode: formatState.unitMode,
  };
  if (opts.recipePortions != null) formatState.recipePortions = opts.recipePortions;
  if (opts.showAmounts != null) formatState.showAmounts = opts.showAmounts;
  if (opts.unitMode != null) formatState.unitMode = opts.unitMode;
  try {
    return fn();
  } finally {
    formatState.recipePortions = prev.recipePortions;
    formatState.showAmounts = prev.showAmounts;
    formatState.unitMode = prev.unitMode;
  }
}

// ── Overlap / Smart Picks ─────────────────────────────────────────────────────

export function normalizeIngredientRestForKey(rest) {
  let r = String(rest || '').trim().toLowerCase();
  r = r.replace(/\s+/g, ' ');
  r = r.replace(/\s*\((optional|to taste)\)\s*$/i, '');
  r = r.replace(/,\s*(optional|to taste)\s*$/i, '');
  r = r.replace(/\s*\bto taste\b\s*$/i, '');
  r = r.replace(/^\s*of\s+/i, '');
  return r.trim();
}

export function canonicalizeIngredientRest(restRaw) {
  const raw = String(restRaw || '').trim();
  const lower = raw.toLowerCase();

  let core = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
  core = core.replace(/\s+/g, ' ');

  const prepStripped = core
    .replace(/,\s*(chopped|shredded|thinly sliced|sliced|diced|minced|halved|torn|crushed)\b.*$/i, '')
    .replace(/\b(pre-cut|bagged|store-bought)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const t = prepStripped.toLowerCase();

  const ALIASES = [
    [/\bscallions?\b/g, 'green onion'],
    [/\bspring mix\b/g, 'spring mix'],
    [/\bmixed greens?\b/g, 'mixed greens'],
    [/\bromaine\b/g, 'romaine'],
    [/\bkale\b/g, 'kale'],
    [/\barugula\b/g, 'arugula'],
    [/\bspinach\b/g, 'spinach'],
    [/\bcherry tomatoes?\b/g, 'cherry tomatoes'],
    [/\bpumpkin seeds?\b/g, 'pepitas'],
    [/\bpepitas\b/g, 'pepitas'],
    [/\bpickled red onions?\b/g, 'pickled red onion'],
    [/\bred onions?\b/g, 'red onion'],
  ];

  for (const [re, canon] of ALIASES) {
    if (re.test(t)) return { key: canon, display: core };
  }

  if (/\bchicken\b/.test(t) && !/\b(chicken stock|chicken broth)\b/.test(t)) {
    return { key: 'chicken', display: core };
  }
  if (/\bshrimp\b/.test(t)) return { key: 'shrimp', display: core };
  if (/\bsteak\b/.test(t) || /\bbeef\b/.test(t)) return { key: 'beef/steak', display: core };

  return { key: normalizeIngredientRestForKey(prepStripped), display: core };
}

export function ingredientCategoryForRestKey(restKey) {
  const r = String(restKey || '').toLowerCase();
  if (!r) return 'Other';
  if (/\b(romaine|kale|spinach|arugula|spring mix|mixed greens|greens|lettuce|cabbage|slaw)\b/.test(r)) return 'Greens';
  if (/\b(chicken|shrimp|beef\/steak|steak|salmon|tuna|turkey|pork|bacon|ham|tofu|tempeh)\b/.test(r)) return 'Proteins';
  if (/\b(feta|goat cheese|parmesan|mozzarella|cheddar|blue cheese|yogurt|sour cream|milk|buttermilk|cream|butter|ghee)\b/.test(r)) return 'Dairy';
  if (/\b(apple|orange|lemon|lime|grapes|berries|strawberries|blueberries|peach|pear|mango|avocado)\b/.test(r)) return 'Fruit';
  if (/\b(cilantro|parsley|basil|mint|dill|chives|thyme|oregano|rosemary|tarragon|sage|bay leaf|microgreens|garlic|ginger|scallion|green onion)\b/.test(r)) return 'Spices & Herbs';
  if (/\b(tomat(?:o|oes)|cucumber(?:s)?|onion(?:s)?|shallot(?:s)?|pepper(?:s)?|jalape(?:n)?o(?:s)?|carrot(?:s)?|broccoli|cauliflower|corn|radish(?:es)?|celery|mushroom(?:s)?|zucchini|squash|beet(?:s)?|sweet potato(?:es)?|potato(?:es)?|asparagus|green bean(?:s)?|bean sprouts?|beansprouts?|daikon|jicama)\b/.test(r)) return 'Vegetables';
  if (/\b(quinoa|rice|farro|orzo|pasta|wild rice|barley|noodles)\b/.test(r)) return 'Grains';
  if (/\b(walnut(?:s)?|pecan(?:s)?|almond(?:s)?|peanut(?:s)?|cashew(?:s)?|pistachio(?:s)?|pine nuts?|pepitas|pumpkin seeds?|sunflower seeds?|sesame)\b/.test(r)) return 'Nuts & Seeds';
  if (/\b(salt|pepper|paprika|smoked paprika|cumin|coriander|turmeric|curry powder|tandoori|chili powder|red pepper flakes|cayenne|sumac|za'atar|zaatar|garam masala|taco seasoning|italian seasoning|onion powder|garlic powder)\b/.test(r)) return 'Spices & Herbs';
  if (/\b(dressing|vinaigrette|sauce|bbq|ranch|caesar|mayo|mayonnaise|mustard|dijon|vinegar|oil|hot sauce|sriracha|tamari|soy sauce|fish sauce|hoisin|gochujang|worcestershire|honey|maple syrup|molasses|agave|anchovy|anchovies|anchovy paste)\b/.test(r)) return 'Pantry';
  return 'Other';
}

export const OVERLAP_GENERIC_KEYS = new Set([
  'salt',
  'pepper',
  'black pepper',
  'water',
  'ice',
  'olive oil',
  'extra-virgin olive oil',
  'vegetable oil',
  'canola oil',
  'neutral oil',
  'oil',
  'sugar',
  'granulated sugar',
]);

export function recipeOverlapIngredientKeys(r) {
  const keys = new Set();
  for (const ing of r.ingredients) {
    const line = ingredientLine(ing);
    if (/^dressing:\s*/i.test(line)) continue;
    const { amount, rest } = parseIngredient(line);
    const restStr = rest != null && String(rest).trim() ? rest : line;
    if (!String(restStr).trim()) continue;
    const { key } = canonicalizeIngredientRest(restStr);
    const k = String(key || '')
      .toLowerCase()
      .trim();
    if (!k || OVERLAP_GENERIC_KEYS.has(k)) continue;
    keys.add(k);
  }
  return keys;
}

export function overlapMatchCount(planKeys, r) {
  let n = 0;
  for (const k of recipeOverlapIngredientKeys(r)) {
    if (planKeys.has(k)) n++;
  }
  return n;
}

/** All non-plan recipes, globally ranked by plan overlap (legacy helper; prefer `recipesForCardStrip` + Smart Picks). */
export function getRecipesSortedByPlanOverlap(mealPlanIds) {
  const inPlan = new Set(mealPlanIds);
  const candidates = RECIPES.filter((r) => !inPlan.has(r.id));
  return sortRecipesByPlanOverlap(candidates, mealPlanIds);
}

export function mealPlanOverlapIngredientKeys(mealPlanIds) {
  const keys = new Set();
  for (const id of mealPlanIds) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) continue;
    for (const k of recipeOverlapIngredientKeys(r)) keys.add(k);
  }
  return keys;
}

export function mealPlanOverlapIngredientKeysExcludingRecipe(mealPlanIds, excludeRecipeId) {
  const keys = new Set();
  for (const id of mealPlanIds) {
    if (id === excludeRecipeId) continue;
    const r = RECIPES.find((x) => x.id === id);
    if (!r) continue;
    for (const k of recipeOverlapIngredientKeys(r)) keys.add(k);
  }
  return keys;
}

export function planOverlapContextForIngredientHints(mealPlanIds, mealPrepMode, smartPicksEnabled, selectedId) {
  if (!smartPicksEnabled || !mealPrepMode || mealPlanIds.length === 0) return null;
  const excludeRecipeId = selectedId;
  const planKeys = mealPlanOverlapIngredientKeysExcludingRecipe(mealPlanIds, excludeRecipeId);
  const keyToRecipeNames = new Map();
  for (const id of mealPlanIds) {
    if (id === excludeRecipeId) continue;
    const r = RECIPES.find((x) => x.id === id);
    if (!r) continue;
    for (const k of recipeOverlapIngredientKeys(r)) {
      if (!keyToRecipeNames.has(k)) keyToRecipeNames.set(k, new Map());
      keyToRecipeNames.get(k).set(id, r.name);
    }
  }
  return { planKeys, keyToRecipeNames };
}

// ── Base quantity conversion (for consolidated copy) ──────────────────────────

export function quantityToBase(value, unit) {
  const u = String(unit || '').toLowerCase();
  const v = Number(value);
  if (!Number.isFinite(v)) return null;

  const ML_PER_TSP = 4.92892;
  const ML_PER_TBSP = 14.7868;
  const ML_PER_CUP = 236.588;
  const ML_PER_PINT = 473.176;
  const ML_PER_QT = 946.353;

  if (u === 'tsp') return { family: 'vol', baseUnit: 'ml', baseValue: v * ML_PER_TSP };
  if (u === 'tbsp') return { family: 'vol', baseUnit: 'ml', baseValue: v * ML_PER_TBSP };
  if (u === 'cup' || u === 'cups') return { family: 'vol', baseUnit: 'ml', baseValue: v * ML_PER_CUP };
  if (u === 'pint') return { family: 'vol', baseUnit: 'ml', baseValue: v * ML_PER_PINT };
  if (u === 'qt') return { family: 'vol', baseUnit: 'ml', baseValue: v * ML_PER_QT };
  if (u === 'ml') return { family: 'vol', baseUnit: 'ml', baseValue: v };
  if (u === 'l') return { family: 'vol', baseUnit: 'ml', baseValue: v * 1000 };

  if (u === 'g') return { family: 'wt', baseUnit: 'g', baseValue: v };
  if (u === 'kg') return { family: 'wt', baseUnit: 'g', baseValue: v * 1000 };
  if (u === 'oz') return { family: 'wt', baseUnit: 'g', baseValue: v * 28.3495 };
  if (u === 'lb') return { family: 'wt', baseUnit: 'g', baseValue: v * 453.592 };

  return null;
}

export function formatBaseQuantityForUnitMode(base, unitMode) {
  if (!base || !Number.isFinite(base.baseValue)) return null;
  if (unitMode === 'metric') {
    if (base.family === 'wt') return formatMetricG(base.baseValue);
    if (base.family === 'vol') return formatMetricMl(base.baseValue);
    return null;
  }

  if (base.family === 'vol') {
    const tsp = base.baseValue / 4.92892;
    const amt = `${formatQuantityForDisplay(tsp)} tsp`;
    return normalizeScaledUsVolume(amt);
  }
  if (base.family === 'wt') {
    const oz = base.baseValue / 28.3495;
    if (oz >= 16) {
      const lb = oz / 16;
      return `${formatQuantityForDisplay(lb)} lb`;
    }
    return `${formatQuantityForDisplay(oz)} oz`;
  }
  return null;
}

// ── Aisle ordering & deduplication ────────────────────────────────────────────

export const INGREDIENT_AISLE_ORDER = ['Greens', 'Vegetables', 'Fruit', 'Proteins', 'Dairy', 'Spices & Herbs', 'Grains', 'Nuts & Seeds', 'Pantry', 'Other'];

export function sortIngredientLinesByAisle(lines) {
  const byCat = new Map();
  for (const line of lines) {
    const t = String(line || '').trim();
    if (!t) continue;
    const { rest } = parseIngredient(t);
    const canon = canonicalizeIngredientRest(rest == null ? t : rest);
    const cat = ingredientCategoryForRestKey(canon.key);
    const arr = byCat.get(cat) || [];
    arr.push(t);
    byCat.set(cat, arr);
  }
  const out = [];
  for (const cat of INGREDIENT_AISLE_ORDER) {
    const items = byCat.get(cat);
    if (!items || !items.length) continue;
    items.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    out.push(...items);
  }
  return out;
}

export function dedupeIngredientLinesByKey(lines) {
  const seen = new Set();
  const out = [];
  for (const it of lines) {
    const t = String(it || '').trim();
    if (!t) continue;
    const { rest } = parseIngredient(t);
    const canon = canonicalizeIngredientRest(rest == null ? t : rest);
    const key = canon.key ? String(canon.key).toLowerCase() : t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function joinDiyBlockLinesWithSectionBreaks(diyLines) {
  const out = [];
  for (let i = 0; i < diyLines.length; i++) {
    const line = String(diyLines[i] || '').trim();
    if (!line) continue;
    if (out.length && /^DIY\s+.+\:/i.test(line)) out.push('');
    out.push(line);
  }
  return out.join('\n');
}

// ── Consolidated ingredient copy ──────────────────────────────────────────────

export function consolidateIngredientLinesForCopy(lines, unitMode) {
  const sums = new Map();
  const passthrough = [];
  const dressings = [];

  for (const raw of lines) {
    const line = String(raw || '').trim();
    if (!line) continue;
    if (/^dressing:\s*/i.test(line)) {
      dressings.push(line);
      continue;
    }
    const { amount, rest } = parseIngredient(line);
    if (!amount) {
      passthrough.push(line);
      continue;
    }
    if (/\b(to taste|handful|pinch|dash)\b/i.test(amount) || /\b(to taste)\b/i.test(rest || '')) {
      passthrough.push(line);
      continue;
    }

    const sp = splitAmountNumberAndUnit(amount);
    if (!sp) {
      passthrough.push(line);
      continue;
    }
    const q = parseQuantityValue(sp.numPart);
    if (q == null || Array.isArray(q)) {
      passthrough.push(line);
      continue;
    }
    const base = quantityToBase(q, sp.unit);
    if (!base) {
      passthrough.push(line);
      continue;
    }
    const canon = canonicalizeIngredientRest(rest);
    const keyRest = canon.key;
    if (!keyRest) {
      passthrough.push(line);
      continue;
    }
    const key = `${base.family}|${keyRest}`;
    const prev = sums.get(key);
    if (!prev) sums.set(key, { base, restKey: keyRest, display: canon.display });
    else prev.base.baseValue += base.baseValue;
  }

  const byCat = new Map();
  const pushCat = (cat, s) => {
    const arr = byCat.get(cat) || [];
    arr.push(s);
    byCat.set(cat, arr);
  };

  for (const v of sums.values()) {
    const amt = formatBaseQuantityForUnitMode(v.base, unitMode);
    const txt = amt ? `${amt} ${v.display}`.trim() : v.display;
    pushCat(ingredientCategoryForRestKey(v.restKey), txt);
  }

  for (const line of passthrough) {
    const { amount, rest } = parseIngredient(line);
    const canon = canonicalizeIngredientRest(rest);
    const cat = ingredientCategoryForRestKey(canon.key);
    pushCat(cat, line);
  }

  const dressingBlocks = dressings.map((s) => String(s || '').trim()).filter(Boolean);

  const saladItems = [];
  for (const cat of INGREDIENT_AISLE_ORDER) {
    const items = byCat.get(cat);
    if (!items || !items.length) continue;
    items.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    for (const it of items) saladItems.push(it);
  }

  const saladListed = dedupeIngredientLinesByKey(saladItems);

  const dressingHeadlines = [];
  const dressingDiyBodies = [];

  for (const block of dressingBlocks) {
    const blockLines = block
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!blockLines.length) continue;

    const titleLine = dressingHeadlineLowerForClipboard(blockLines[0]);
    dressingHeadlines.push(titleLine);

    const firstDiyIdx = blockLines.findIndex((l) => /^DIY\s+/i.test(l));
    if (firstDiyIdx >= 0) {
      dressingDiyBodies.push(joinDiyBlockLinesWithSectionBreaks(blockLines.slice(firstDiyIdx)));
      continue;
    }

    const title = titleLine.replace(/^dressing:\s*/i, '').trim();
    const ingredients = blockLines
      .slice(1)
      .filter((l) => l && !/^[^:]{1,40}:\s*$/.test(l));

    const diyByCat = new Map();
    const diyPush = (cat, s) => {
      const arr = diyByCat.get(cat) || [];
      arr.push(s);
      diyByCat.set(cat, arr);
    };
    for (const ing of ingredients) {
      const t = String(ing || '').trim();
      if (!t) continue;
      const { rest } = parseIngredient(t);
      const canon = canonicalizeIngredientRest(rest == null ? t : rest);
      const cat = ingredientCategoryForRestKey(canon.key);
      diyPush(cat, t);
    }
    const diyOrdered = [];
    for (const cat of INGREDIENT_AISLE_ORDER) {
      const items = diyByCat.get(cat);
      if (!items || !items.length) continue;
      items.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      for (const it of items) diyOrdered.push(it);
    }
    const diyPart = diyOrdered.length ? dedupeIngredientLinesByKey(diyOrdered).join('\n') : '';
    if (diyPart) dressingDiyBodies.push(diyPart);
  }

  const outParts = [];
  if (saladListed.length) outParts.push(saladListed.join('\n'));
  if (dressingHeadlines.length) {
    const headChunk = dressingHeadlines.join('\n');
    if (outParts.length) outParts[outParts.length - 1] += '\n' + headChunk;
    else outParts.push(headChunk);
  }
  const diyJoined = dressingDiyBodies.filter(Boolean).join('\n\n');
  if (diyJoined) outParts.push(diyJoined);

  return outParts.join('\n\n').trim();
}

// ── Full recipe copy ──────────────────────────────────────────────────────────

export function ingredientsBlockForFullRecipeCopy(r, opts) {
  const mealPlan = opts && opts.mealPlanCopy;
  const saladLines = [];
  const dressingBlocks = [];
  for (const ing of r.ingredients) {
    const rendered = ingredientLineForClipboardSingleRecipe(ing);
    if (isDressingLine(ing)) dressingBlocks.push(String(rendered || '').trim());
    else saladLines.push(String(rendered || '').trim());
  }
  const salad = saladLines.filter(Boolean);
  if (mealPlan) {
    const saladSorted = dedupeIngredientLinesByKey(sortIngredientLinesByAisle(salad));
    const saladPart = saladSorted.join('\n');
    if (!dressingBlocks.length) return saladPart;
    if (!saladPart) return dressingBlocks.join('\n\n');
    return `${saladPart}\n${dressingBlocks.join('\n\n')}`;
  }
  const ingParts = [...sortIngredientLinesByAisle(salad)];
  if (dressingBlocks.length) ingParts.push(...dressingBlocks);
  return ingParts.join('\n');
}
