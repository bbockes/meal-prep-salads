import {
  DIET_KEYS,
  type DietKey,
  INGREDIENT_OMIT_RULES,
  applyDressingSubs,
} from '@/data/diet-config';
import type { RecipeIngredient } from '@/data/ingredient-types';

function isDressingLineRaw(line: string): boolean {
  return /^Dressing:\s/i.test(line);
}

/** Omissions derived from current global rules (same as pre–Phase-2 behavior). */
export function computeOmitForLine(line: string): DietKey[] {
  if (isDressingLineRaw(line)) return [];
  const omit: DietKey[] = [];
  for (const d of DIET_KEYS) {
    for (const rule of INGREDIENT_OMIT_RULES) {
      if (rule.diets.includes(d) && rule.pattern.test(line)) {
        omit.push(d);
        break;
      }
    }
  }
  return omit;
}

export function computeDressingByDiet(line: string): Partial<Record<DietKey, string>> {
  const out: Partial<Record<DietKey, string>> = {};
  for (const d of DIET_KEYS) {
    out[d] = applyDressingSubs(line, d);
  }
  return out;
}

export function buildRecipeIngredient(line: string): RecipeIngredient {
  const omitFor = computeOmitForLine(line);
  const ing: RecipeIngredient = { line, omitFor };
  if (isDressingLineRaw(line)) {
    ing.dressingByDiet = computeDressingByDiet(line);
  }
  return ing;
}

export function structureRecipeIngredients(lines: string[]): RecipeIngredient[] {
  return lines.map(buildRecipeIngredient);
}
