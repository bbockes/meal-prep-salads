import {
  INGREDIENT_OMIT_RULES,
  DRESSING_SUBS,
  OPTIONAL_PROTEINS,
  MIN_VIABLE_INGREDIENTS,
  DIET_KEYS,
  type OptionalProtein,
} from '@/data/diet-config';
import type { Recipe } from '@/data/recipes';

export function isDressingLine(text: string): boolean {
  return /^Dressing:\s/i.test(text);
}

export function isOptionalLine(text: string): boolean {
  return /^optional:/i.test(text);
}

export function shouldOmitIngredient(text: string, diet: string): boolean {
  if (isDressingLine(text)) return false;
  for (const rule of INGREDIENT_OMIT_RULES) {
    if (rule.diets.includes(diet) && rule.pattern.test(text)) {
      return true;
    }
  }
  return false;
}

export function adaptDressingForDiet(dressingLine: string, diet: string): string {
  const subs = DRESSING_SUBS[diet];
  if (!subs || subs.length === 0) return dressingLine;

  let result = dressingLine;
  for (const { from, to } of subs) {
    result = result.replace(from, to);
  }

  result = result.replace(/\+\s*\+/g, '+');
  result = result.replace(/\(\s*\+/g, '(');
  result = result.replace(/\+\s*\)/g, ')');
  result = result.replace(/\s{2,}/g, ' ');
  result = result.replace(/\+\s*$/g, '').trim();

  return result;
}

const _recipeDietCache = new Map<number, string[]>();

export function getRecipeDiets(recipe: Recipe): string[] {
  const cached = _recipeDietCache.get(recipe.id);
  if (cached) return cached;

  const diets = (DIET_KEYS as readonly string[]).filter((diet) => {
    const coreIngredients = recipe.ingredients.filter((ing) => {
      if (isDressingLine(ing)) return false;
      if (isOptionalLine(ing)) return false;
      return true;
    });
    const remaining = coreIngredients.filter((ing) => !shouldOmitIngredient(ing, diet));
    return remaining.length >= MIN_VIABLE_INGREDIENTS;
  });

  _recipeDietCache.set(recipe.id, diets);
  return diets;
}

export function getOptionalProteinsForDiet(diet: string): OptionalProtein[] {
  return OPTIONAL_PROTEINS.filter((p) => p.diets.includes(diet));
}

export function getProteinStepName(fullName: string): string {
  let core = fullName.split(',')[0].trim();
  core = core.replace(/^(grilled|roasted|pan-fried|hard-boiled|baked|fried|sautéed|steamed)\s+/i, '');
  return core;
}

export function adaptStepForDiet(
  stepText: string,
  recipe: Recipe,
  diet: string,
  selectedProtein: string | null
): string {
  const dietRules = INGREDIENT_OMIT_RULES.filter((r) => r.diets.includes(diet));
  const matching = dietRules.filter((r) => r.pattern.test(stepText));
  if (!matching.length) return stepText;

  let s = stepText;
  const replacement = selectedProtein ? getProteinStepName(selectedProtein) : '';
  let didSwap = false;

  for (const rule of matching) {
    const global = new RegExp(rule.pattern.source, 'gi');
    if (rule.swappable && !didSwap) {
      s = s.replace(global, replacement);
      didSwap = true;
    } else {
      s = s.replace(global, '');
    }
  }

  while (/,\s*,/.test(s)) s = s.replace(/,\s*,/g, ',');
  s = s.replace(/(with|add)\s*,\s*/gi, '$1 ');
  s = s.replace(/,\s*and\s*\./gi, '.');
  s = s.replace(/,\s*\./g, '.');
  s = s.replace(/,\s*$/g, '');
  s = s.replace(/\s{2,}/g, ' ');
  s = s.trim();

  return s;
}
