// @ts-nocheck
'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, type DragEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ACCENT, FLAVOR_KEYS, SEASON_KEYS, FLAVOR_ACCENTS, SEASON_ACCENTS } from '@/data/constants';
import { DIET_KEYS, OPTIONAL_PROTEINS } from '@/data/diet-config';
import type { SaladBrowseMode } from '@/data/salad-routes';
import {
  dietPrefixedBrowsePath,
  SALADS_BY_FLAVOR_PATH,
  SALADS_BY_SEASON_PATH,
} from '@/data/salad-routes';
import { RECIPES, Recipe } from '@/data/recipes';
import {
  getOptionalProteinsForDiet,
  adaptStepForDiet,
  adaptStepForProteinSwap,
  getRecommendedProteins,
  isDressingLine,
  pickTopOptionalProteinsForDisplay,
} from '@/lib/diet-utils';
import {
  formatState,
  SCALING_BASE_PORTIONS,
  escapeHtml,
  escapeAttr,
  recipeCardImageSlug,
  isDistinctSubCuisine,
  detailMetaBadgesHtml,
  accentForNavCat,
  getNavTabs,
  recipesForCardStrip,
  renderIngredient,
  renderDressingDiySectionHtml,
  formatStepLineHtml,
  OVERLAP_TAB_TIP_COPY,
  planOverlapContextForIngredientHints,
  sortIngredientsForPlanOverlapDisplay,
  mealPlanOverlapIngredientKeys,
  overlapMatchCount,
  ingredientLineForClipboard,
  ingredientLineForClipboardSingleRecipe,
  withClipboardOptions,
  sortIngredientLinesByAisle,
  dedupeIngredientLinesByKey,
  consolidateIngredientLinesForCopy,
  ingredientsBlockForFullRecipeCopy,
  formatAmountForDisplay,
  adaptStepText,
  recipeStepsForDisplay,
} from '@/lib/recipe-utils';

const MEAL_PLAN_STORAGE_KEY = 'meal-prep-salads:mealPlanV1';
const MEAL_PREP_MODE_KEY = 'meal-prep-salads:mealPrepMode';
const PREFERRED_DIET_STORAGE_KEY = 'meal-prep-salads:preferredDietV1';
/** Written before `router.push` on diet change; read after URL updates so remounted `SaladApp` can restore scroll. */
const CARD_STRIP_AFTER_DIET_STORAGE_KEY = 'meal-prep-salads:cardStripAfterDietV1';

/** Mon–Sun columns for the meal-plan board (index 0 = Monday). */
const MEAL_PLAN_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** New recipes added from a card (+) always go to Monday, not “today”. */
const DEFAULT_MEAL_PLAN_ADD_DAY_INDEX = 0;

function emptyMealPlanByDay() {
  return [[], [], [], [], [], [], []];
}

/** Legacy flat `ids` → all recipes on Monday so copy order stays predictable. */
function migrateMealPlanIdsToByDay(ids: number[]) {
  const cols = emptyMealPlanByDay();
  ids.forEach((id) => cols[0].push(id));
  return cols;
}

function moveRecipeToDayColumn(prev: number[][], id: number, toDay: number) {
  const next = prev.map((col) => col.filter((x) => x !== id));
  if (toDay < 0 || toDay > 6) return next;
  next[toDay] = [...next[toDay], id];
  return next;
}

/** Label for meal-plan chips: append " Salad" when missing; capitalize Salad/Salads; never duplicate salad words. */
function mealPlanChipDisplayName(name: string) {
  const s = name.trim();
  const lower = s.toLowerCase();
  if (lower === 'salad') return 'Salad';
  if (lower === 'salads') return 'Salads';
  if (/\s+salads$/i.test(s)) return s.replace(/\s+salads$/i, ' Salads');
  if (/\s+salad$/i.test(s)) return s.replace(/\s+salad$/i, ' Salad');
  if (/\bsalads$/i.test(s)) return s.replace(/\bsalads$/i, 'Salads');
  if (/\bsalad$/i.test(s)) return s.replace(/\bsalad$/i, 'Salad');
  return `${s} Salad`;
}

let _persistedShowAmounts = false;
let _persistedUnitMode: 'us' | 'metric' = 'us';
let _persistedRecipePortions = 2;

interface SaladAppProps {
  initialBrowseMode: SaladBrowseMode;
  initialCategory: string;
  initialDietScope: string | null;
  /** From `?r=` on diet hub `*-salads` URLs so the detail recipe survives remounts. */
  initialPinnedRecipeId?: number | null;
  /** Keyword-focused heading (SSR) — site brand stays in the header line above. */
  pageHeading?: string;
}

export default function SaladApp({
  initialBrowseMode,
  initialCategory,
  initialDietScope,
  initialPinnedRecipeId = null,
  pageHeading,
}: SaladAppProps) {
  const router = useRouter();
  const pathname = usePathname();
  const cardStripRef = useRef<HTMLDivElement | null>(null);
  const [browseMode, setBrowseMode] = useState<SaladBrowseMode>(initialBrowseMode);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [dietScope, setDietScope] = useState<string | null>(initialDietScope);
  const [selectedId, setSelectedId] = useState(() => {
    const visible = recipesForCardStrip(
      initialBrowseMode,
      initialCategory,
      initialDietScope,
      false,
      [],
      false
    );
    if (!visible.length) return RECIPES[0].id;
    const pin = initialPinnedRecipeId;
    if (initialDietScope && pin != null && visible.some((r) => r.id === pin)) {
      return pin;
    }
    return visible[0].id;
  });
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const [mealPrepMode, setMealPrepMode] = useState(false);
  const [mealPlanByDay, setMealPlanByDay] = useState<number[][]>(emptyMealPlanByDay);
  const mealPlanIds = useMemo(() => mealPlanByDay.flat(), [mealPlanByDay]);
  const [mealPlanPortions, setMealPlanPortions] = useState(2);
  const [mealPlanShowAmounts, setMealPlanShowAmounts] = useState(false);
  const [mealPlanUnitMode, setMealPlanUnitMode] = useState<'us' | 'metric'>('us');

  const [showAmounts, setShowAmounts] = useState(_persistedShowAmounts);
  const [unitMode, setUnitMode] = useState<'us' | 'metric'>(_persistedUnitMode);
  const [recipePortions, setRecipePortions] = useState(_persistedRecipePortions);

  const [servingsModalOpen, setServingsModalOpen] = useState(false);
  const [servingsModalTarget, setServingsModalTarget] = useState<'recipe' | 'mealPlan'>('recipe');
  const [portionsDraft, setPortionsDraft] = useState<number | null>(null);

  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  const [smartPicksTipOpen, setSmartPicksTipOpen] = useState(false);
  const [smartPicksEnabled, setSmartPicksEnabled] = useState(false);
  const [selectedProteinByRecipe, setSelectedProteinByRecipe] = useState<Record<number, string>>({});
  /** Which day column is currently a drag-over drop target. */
  const [mealPlanDragOverDay, setMealPlanDragOverDay] = useState<number | null>(null);
  /** Custom drag preview node (must stay in `document` until drag ends). */
  const mealPlanDragGhostRef = useRef<HTMLDivElement | null>(null);
  const [mealPlanTipOpen, setMealPlanTipOpen] = useState(false);

  /** Avoid writing `{ ids: [] }` on mount before the hydrate effect applies — that was wiping the plan on route remount (`/salads` ↔ `/*-salads`). */
  const skipNextMealPlanPersist = useRef(true);

  /** After true, meal-plan state reflects localStorage (or “no saved plan”). Used so we don’t clear Smart Picks using stale empty state in the same effect pass as hydrate. */
  const [mealPlanHydratedFromStorage, setMealPlanHydratedFromStorage] = useState(false);

  // Load meal plan from localStorage
  useEffect(() => {
    try {
      const mode = localStorage.getItem(MEAL_PREP_MODE_KEY);
      if (mode === '1') setMealPrepMode(true);
    } catch {}
    try {
      const raw = localStorage.getItem(MEAL_PLAN_STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        const valid = new Set(RECIPES.map((r) => r.id));
        if (Array.isArray(o.byDay) && o.byDay.length === 7) {
          const cols = o.byDay.map((col: unknown) =>
            Array.isArray(col) ? col.filter((id: number) => valid.has(id)) : []
          );
          while (cols.length < 7) cols.push([]);
          setMealPlanByDay(cols.slice(0, 7) as number[][]);
        } else if (Array.isArray(o.ids)) {
          setMealPlanByDay(migrateMealPlanIdsToByDay(o.ids.filter((id: number) => valid.has(id))));
        }
        if (typeof o.portions === 'number' && o.portions >= 2 && o.portions <= 30)
          setMealPlanPortions(Math.round(o.portions));
        if (typeof o.showAmounts === 'boolean') setMealPlanShowAmounts(o.showAmounts);
        if (o.unitMode === 'metric' || o.unitMode === 'us') setMealPlanUnitMode(o.unitMode);
        if (o.smartPicks === true) setSmartPicksEnabled(true);
      }
    } catch {}
    setMealPlanHydratedFromStorage(true);
  }, []);

  // Save meal plan to localStorage
  useEffect(() => {
    if (skipNextMealPlanPersist.current) {
      skipNextMealPlanPersist.current = false;
      return;
    }
    try {
      localStorage.setItem(MEAL_PREP_MODE_KEY, mealPrepMode ? '1' : '0');
      localStorage.setItem(
        MEAL_PLAN_STORAGE_KEY,
        JSON.stringify({
          byDay: mealPlanByDay,
          portions: mealPlanPortions,
          showAmounts: mealPlanShowAmounts,
          unitMode: mealPlanUnitMode,
          smartPicks: smartPicksEnabled,
        })
      );
    } catch {}
  }, [mealPrepMode, mealPlanByDay, mealPlanPortions, mealPlanShowAmounts, mealPlanUnitMode, smartPicksEnabled]);

  useEffect(() => {
    if (!mealPlanHydratedFromStorage) return;
    if (!mealPrepMode || mealPlanIds.length === 0) setSmartPicksEnabled(false);
  }, [mealPlanHydratedFromStorage, mealPrepMode, mealPlanIds.length]);

  useEffect(() => { _persistedShowAmounts = showAmounts; }, [showAmounts]);
  useEffect(() => { _persistedUnitMode = unitMode; }, [unitMode]);
  useEffect(() => { _persistedRecipePortions = recipePortions; }, [recipePortions]);

  const activeDiet = dietScope;

  // Sync format state for utility functions
  formatState.showAmounts = showAmounts;
  formatState.unitMode = unitMode;
  formatState.recipePortions = recipePortions;
  formatState.mealPlanPortions = mealPlanPortions;
  formatState.mealPlanShowAmounts = mealPlanShowAmounts;
  formatState.mealPlanUnitMode = mealPlanUnitMode;
  formatState.activeDiet = activeDiet;
  formatState.selectedProteinByRecipe = selectedProteinByRecipe;

  // Sync from URL (layout effect avoids one painted frame with stale browse tab after navigation)
  useLayoutEffect(() => {
    setBrowseMode(initialBrowseMode);
    setActiveCategory(initialCategory);
    setDietScope(initialDietScope);
    const visible = recipesForCardStrip(
      initialBrowseMode,
      initialCategory,
      initialDietScope,
      mealPrepMode,
      mealPlanIds,
      smartPicksEnabled
    );
    if (!visible.length) return;
    const pin = initialPinnedRecipeId;
    setSelectedId((prev) => {
      if (initialDietScope) {
        let next = visible[0].id;
        if (pin != null && visible.some((r) => r.id === pin)) next = pin;
        else if (visible.some((r) => r.id === prev)) next = prev;
        return next;
      }
      return visible[0].id;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync when URL-derived props change; meal plan / Smart Picks stay client-only
  }, [initialBrowseMode, initialCategory, initialDietScope, initialPinnedRecipeId]);

  const categoryToUrl = useCallback(
    (
      category: string,
      opts?: {
        browseModeForAll?: SaladBrowseMode;
        dietScope?: string | null;
        pinRecipeId?: number | null;
      }
    ) => {
      const mode = opts?.browseModeForAll ?? browseMode;
      const ds = opts?.dietScope !== undefined ? opts.dietScope : dietScope;
      const pinRecipeId = opts?.pinRecipeId;
      let path: string;

      if (ds) {
        const dp = dietPrefixedBrowsePath(mode, category, ds);
        if (dp) {
          path = dp;
          const qs = new URLSearchParams();
          if (
            pinRecipeId != null &&
            Number.isFinite(pinRecipeId) &&
            RECIPES.some((r) => r.id === pinRecipeId)
          ) {
            qs.set('r', String(pinRecipeId));
          }
          const q = qs.toString();
          return q ? `${path}?${q}` : path;
        }
      }

      if (category === 'All') {
        if (mode === 'flavor') path = SALADS_BY_FLAVOR_PATH;
        else if (mode === 'season') path = SALADS_BY_SEASON_PATH;
        else path = '/salads';
      } else {
        const slug = category
          .toLowerCase()
          .replace(/\s+&\s+/g, '-')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        path = `/${slug}-salads`;
      }
      return path;
    },
    [browseMode, dietScope]
  );

  useEffect(() => {
    if (!smartPicksEnabled || !mealPrepMode || mealPlanIds.length === 0) return;
    const v = recipesForCardStrip(browseMode, activeCategory, dietScope, mealPrepMode, mealPlanIds, true);
    if (!v.length) return;
    const prev = selectedIdRef.current;
    if (v.some((r) => r.id === prev)) return;
    const next = v[0].id;
    setSelectedId(next);
    if (dietScope) {
      router.replace(categoryToUrl(activeCategory, { pinRecipeId: next }), { scroll: false });
    }
  }, [smartPicksEnabled, browseMode, activeCategory, dietScope, mealPrepMode, mealPlanIds, router, categoryToUrl]);

  const flash = useCallback((msg: string) => {
    setFlashMsg(msg);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashMsg(null), 2200);
  }, []);

  // ── Browse mode / category selection ──
  const handleSelectBrowseMode = useCallback(
    (mode: SaladBrowseMode) => {
      if (mode === browseMode) return;
      setServingsModalOpen(false);
      setBrowseMode(mode);
      const defaultCat = 'All';
      setActiveCategory(defaultCat);
      const visible = recipesForCardStrip(
        mode,
        defaultCat,
        dietScope,
        mealPrepMode,
        mealPlanIds,
        smartPicksEnabled
      );
      let dietPin: number | null = null;
      if (visible.length) {
        const first = visible[0].id;
        setSelectedId(first);
        if (dietScope) dietPin = first;
      }
      router.push(
        dietScope && dietPin != null
          ? categoryToUrl(defaultCat, { browseModeForAll: mode, pinRecipeId: dietPin })
          : categoryToUrl(defaultCat, { browseModeForAll: mode }),
        { scroll: false }
      );
    },
    [browseMode, dietScope, mealPrepMode, mealPlanIds, router, categoryToUrl, smartPicksEnabled]
  );

  const handleSelectCategory = useCallback(
    (cat: string) => {
      setServingsModalOpen(false);
      setSmartPicksTipOpen(false);
      const visible = recipesForCardStrip(
        browseMode,
        cat,
        dietScope,
        mealPrepMode,
        mealPlanIds,
        smartPicksEnabled
      );
      if (!visible.length) return;
      let nextId = visible[0].id;
      if (dietScope) {
        const cur = selectedIdRef.current;
        if (visible.some((r) => r.id === cur)) nextId = cur;
      }
      setActiveCategory(cat);
      setSelectedId(nextId);
      router.push(
        dietScope ? categoryToUrl(cat, { pinRecipeId: nextId }) : categoryToUrl(cat),
        { scroll: false }
      );
    },
    [browseMode, dietScope, mealPrepMode, mealPlanIds, router, categoryToUrl, smartPicksEnabled]
  );

  const handleSelectRecipe = useCallback(
    (id: number) => {
      setServingsModalOpen(false);
      setSelectedId(id);
      if (dietScope) {
        router.replace(categoryToUrl(activeCategory, { pinRecipeId: id }), { scroll: false });
      }
    },
    [dietScope, activeCategory, categoryToUrl, router]
  );

  const handleDietScopeChange = useCallback(
    (next: string | null) => {
      setServingsModalOpen(false);
      setSmartPicksTipOpen(false);
      try {
        const strip = cardStripRef.current;
        sessionStorage.setItem(
          CARD_STRIP_AFTER_DIET_STORAGE_KEY,
          JSON.stringify({
            scrollLeft: strip ? strip.scrollLeft : 0,
            selectedId: selectedIdRef.current,
          })
        );
      } catch {
        /* ignore */
      }
      setDietScope(next);
      try {
        if (next) localStorage.setItem(PREFERRED_DIET_STORAGE_KEY, next);
        else localStorage.removeItem(PREFERRED_DIET_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const visible = recipesForCardStrip(
        browseMode,
        activeCategory,
        next,
        mealPrepMode,
        mealPlanIds,
        smartPicksEnabled
      );
      if (!visible.length) return;
      let nextId = visible[0].id;
      const cur = selectedIdRef.current;
      if (visible.some((r) => r.id === cur)) nextId = cur;
      setSelectedId(nextId);
      const pin = next ? nextId : null;
      router.push(
        categoryToUrl(activeCategory, {
          browseModeForAll: browseMode,
          dietScope: next,
          pinRecipeId: pin,
        }),
        { scroll: false }
      );
    },
    [browseMode, activeCategory, mealPrepMode, mealPlanIds, router, categoryToUrl, smartPicksEnabled]
  );

  // ── Meal prep mode ──
  const handleToggleMealPrepMode = useCallback(() => {
    setMealPrepMode((prev) => !prev);
  }, []);

  const handleToggleMealPlanRecipe = useCallback((id: number) => {
    setMealPlanByDay((prev) => {
      let fromCol = -1;
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].includes(id)) {
          fromCol = i;
          break;
        }
      }
      if (fromCol >= 0) {
        return prev.map((col, i) => (i === fromCol ? col.filter((x) => x !== id) : col));
      }
      return prev.map((c, i) =>
        i === DEFAULT_MEAL_PLAN_ADD_DAY_INDEX ? [...c, id] : c
      );
    });
  }, []);

  const handleRemoveFromMealPlan = useCallback(
    (id: number) => {
      setMealPlanByDay((prev) => prev.map((col) => col.filter((x) => x !== id)));
      if (servingsModalOpen && servingsModalTarget === 'mealPlan') {
        setServingsModalOpen(false);
      }
    },
    [servingsModalOpen, servingsModalTarget]
  );

  const handleClearMealPlan = useCallback(() => {
    setMealPlanByDay(emptyMealPlanByDay());
    if (servingsModalOpen && servingsModalTarget === 'mealPlan') {
      setServingsModalOpen(false);
    }
  }, [servingsModalOpen, servingsModalTarget]);

  const handleMealPlanDropOnDay = useCallback((dayIndex: number, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setMealPlanDragOverDay(null);
    const raw = e.dataTransfer.getData('text/plain');
    const id = parseInt(raw, 10);
    if (!Number.isFinite(id)) return;
    setMealPlanByDay((prev) => moveRecipeToDayColumn(prev, id, dayIndex));
  }, []);

  useEffect(() => {
    const clearDragOver = () => setMealPlanDragOverDay(null);
    window.addEventListener('dragend', clearDragOver);
    return () => window.removeEventListener('dragend', clearDragOver);
  }, []);

  useEffect(() => {
    return () => {
      mealPlanDragGhostRef.current?.remove();
      mealPlanDragGhostRef.current = null;
    };
  }, []);

  // ── Amounts / units toggles ──
  const handleToggleAmounts = useCallback(() => {
    setShowAmounts((prev) => {
      if (prev) setServingsModalOpen(false);
      return !prev;
    });
  }, []);

  const handleToggleUnits = useCallback(() => {
    setUnitMode((prev) => (prev === 'us' ? 'metric' : 'us'));
  }, []);

  const handleToggleMealPlanAmounts = useCallback(() => {
    setMealPlanShowAmounts((prev) => {
      if (prev && servingsModalOpen && servingsModalTarget === 'mealPlan') {
        setServingsModalOpen(false);
      }
      return !prev;
    });
  }, [servingsModalOpen, servingsModalTarget]);

  const handleToggleMealPlanUnits = useCallback(() => {
    setMealPlanUnitMode((prev) => (prev === 'us' ? 'metric' : 'us'));
  }, []);

  // ── Servings modal ──
  const openServingsModal = useCallback(
    (target: 'recipe' | 'mealPlan') => {
      setServingsModalTarget(target);
      setPortionsDraft(target === 'recipe' ? recipePortions : mealPlanPortions);
      setServingsModalOpen(true);
    },
    [recipePortions, mealPlanPortions]
  );

  const closeServingsModal = useCallback(() => {
    setServingsModalOpen(false);
    setPortionsDraft(null);
  }, []);

  const applyServingsModal = useCallback(() => {
    if (portionsDraft == null) return;
    if (servingsModalTarget === 'recipe') {
      setRecipePortions(portionsDraft);
    } else {
      setMealPlanPortions(portionsDraft);
    }
    setServingsModalOpen(false);
    setPortionsDraft(null);
  }, [portionsDraft, servingsModalTarget]);

  // ── Copy functions ──
  const handleCopyIngredients = useCallback(
    (id: number) => {
      const r = RECIPES.find((x) => x.id === id);
      if (!r) return;
      const text = withClipboardOptions({ recipePortions, showAmounts, unitMode }, () => {
        const saladLines: string[] = [];
        const dressingBlocks: string[] = [];
        for (const ing of r.ingredients) {
          const rendered = ingredientLineForClipboardSingleRecipe(ing);
          // Clipboard output is plainDressingForClipboard (e.g. "dressing: …" / "DIY …") — not "Dressing:".
          if (isDressingLine(ing)) dressingBlocks.push(String(rendered || '').trim());
          else saladLines.push(String(rendered || '').trim());
        }
        if (selectedProteinByRecipe[id]) {
          const pName = selectedProteinByRecipe[id];
          const pDef = (activeDiet ? getOptionalProteinsForDiet(activeDiet, r) : OPTIONAL_PROTEINS).find((p) => p.name === pName);
          if (pDef) {
            const line = showAmounts ? `${formatAmountForDisplay(pDef.amount, pDef.name)} ${pDef.name}` : pDef.name;
            saladLines.push(line);
          }
        }
        const out = [...sortIngredientLinesByAisle(saladLines.filter(Boolean))];
        if (dressingBlocks.length) for (const b of dressingBlocks) out.push(b);
        const ingredientsBody = out.join('\n').trimEnd();
        return `${r.name}\n\n${ingredientsBody}`.trim() + '\n';
      });
      navigator.clipboard
        .writeText(text)
        .then(() => flash('Ingredients copied!'))
        .catch(() => flash("Couldn't copy — try again or check permissions."));
    },
    [recipePortions, showAmounts, unitMode, flash, activeDiet, selectedProteinByRecipe]
  );

  const handleCopyFullRecipe = useCallback(
    (id: number) => {
      const r = RECIPES.find((x) => x.id === id);
      if (!r) return;
      let block = ingredientsBlockForFullRecipeCopy(r, {});
      if (selectedProteinByRecipe[id]) {
        const pName = selectedProteinByRecipe[id];
        const pDef = (activeDiet ? getOptionalProteinsForDiet(activeDiet, r) : OPTIONAL_PROTEINS).find((p) => p.name === pName);
        if (pDef) {
          const line = showAmounts ? `${formatAmountForDisplay(pDef.amount, pDef.name)} ${pDef.name}` : pDef.name;
          block += `\n${line}`;
        }
      }
      const selProtein = selectedProteinByRecipe[id] || null;
      const adaptedSteps = recipeStepsForDisplay(r, selProtein)
        .map((s) => activeDiet ? adaptStepForDiet(s, r, activeDiet, selProtein) : adaptStepForProteinSwap(s, selProtein))
        .map((s, i) => `${i + 1}. ${s}`)
        .join('\n');
      const text = `${r.name}\n\nIngredients:\n${block}\n\nSteps:\n${adaptedSteps}`;
      navigator.clipboard
        .writeText(text)
        .then(() => flash('Full recipe copied!'))
        .catch(() => flash("Couldn't copy — try again or check permissions."));
    },
    [flash, activeDiet, selectedProteinByRecipe, showAmounts]
  );

  const handleCopyMealPlanIngredients = useCallback(() => {
    if (!mealPlanIds.length) {
      flash('No salads in your meal plan yet.');
      return;
    }
    const recipeNames: string[] = [];
    const lines: string[] = [];
    for (const id of mealPlanIds) {
      const r = RECIPES.find((x) => x.id === id);
      if (!r) continue;
      recipeNames.push(r.name);
      const blockLines = withClipboardOptions(
        { recipePortions: mealPlanPortions, showAmounts: mealPlanShowAmounts, unitMode: mealPlanUnitMode },
        () => {
          const ingLines = r.ingredients.map((ing) => ingredientLineForClipboard(ing));
          if (selectedProteinByRecipe[id]) {
            const pName = selectedProteinByRecipe[id];
            const pDef = (activeDiet ? getOptionalProteinsForDiet(activeDiet, r) : OPTIONAL_PROTEINS).find((p) => p.name === pName);
            if (pDef) {
              const line = mealPlanShowAmounts ? `${formatAmountForDisplay(pDef.amount, pDef.name)} ${pDef.name}` : pDef.name;
              ingLines.push(line);
            }
          }
          return ingLines;
        }
      );
      if (!blockLines || !blockLines.length) continue;
      for (const rendered of blockLines) {
        const t = String(rendered || '').trim();
        if (!t) continue;
        if (/^dressing:\s*/i.test(t)) {
          lines.push(t);
          continue;
        }
        lines.push(...t.split('\n').map((s) => s.trim()).filter(Boolean));
      }
    }
    const ingredientsBody = consolidateIngredientLinesForCopy(lines, mealPlanUnitMode).trim();
    let header = '';
    if (recipeNames.length <= 1) {
      header = recipeNames[0] || '';
    } else if (recipeNames.length === 2) {
      header = `Combined ingredients for ${recipeNames[0]} and ${recipeNames[1]}`;
    } else {
      const leadingNames = recipeNames.slice(0, -1).join(', ');
      header = `Combined ingredients for ${leadingNames}, and ${recipeNames[recipeNames.length - 1]}`;
    }
    const text = header ? `${header}\n\n${ingredientsBody}`.trim() : ingredientsBody;
    navigator.clipboard
      .writeText(text)
      .then(() => flash('Copied ingredients!'))
      .catch(() => flash("Couldn't copy — try again or check permissions."));
  }, [mealPlanIds, mealPlanPortions, mealPlanShowAmounts, mealPlanUnitMode, flash, activeDiet, selectedProteinByRecipe]);

  const handleCopyMealPlanFullRecipes = useCallback(() => {
    if (!mealPlanIds.length) {
      flash('No salads in your meal plan yet.');
      return;
    }
    const parts: string[] = [];
    for (const id of mealPlanIds) {
      const r = RECIPES.find((x) => x.id === id);
      if (!r) continue;
      const body = withClipboardOptions(
        { recipePortions: mealPlanPortions, showAmounts: mealPlanShowAmounts, unitMode: mealPlanUnitMode },
        () => {
          let ingredientsBlock = ingredientsBlockForFullRecipeCopy(r, { mealPlanCopy: true });
          if (selectedProteinByRecipe[id]) {
            const pName = selectedProteinByRecipe[id];
            const pDef = (activeDiet ? getOptionalProteinsForDiet(activeDiet, r) : OPTIONAL_PROTEINS).find((p) => p.name === pName);
            if (pDef) {
              const line = mealPlanShowAmounts ? `${formatAmountForDisplay(pDef.amount, pDef.name)} ${pDef.name}` : pDef.name;
              ingredientsBlock += `\n${line}`;
            }
          }
          const mealSelProtein = selectedProteinByRecipe[id] || null;
          const adaptedSteps = recipeStepsForDisplay(r, mealSelProtein)
            .map((s) => activeDiet ? adaptStepForDiet(s, r, activeDiet, mealSelProtein) : adaptStepForProteinSwap(s, mealSelProtein))
            .map((s, i) => `${i + 1}. ${s}`)
            .join('\n');
          return `${r.name}\n\nIngredients:\n${ingredientsBlock}\n\nSteps:\n${adaptedSteps}`;
        }
      );
      parts.push(body);
    }
    const text = parts.join('\n\n────────────────────────\n\n');
    navigator.clipboard
      .writeText(text)
      .then(() => flash(`Copied ${mealPlanIds.length} full recipes!`))
      .catch(() => flash("Couldn't copy — try again or check permissions."));
  }, [mealPlanIds, mealPlanPortions, mealPlanShowAmounts, mealPlanUnitMode, flash, activeDiet, selectedProteinByRecipe]);

  // ── Keyboard ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSmartPicksTipOpen(false);
        if (servingsModalOpen) closeServingsModal();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [servingsModalOpen, closeServingsModal]);

  // Close smart picks tip on outside click
  useEffect(() => {
    if (!smartPicksTipOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.browse-mode .browse-smart-picks-tip-wrap')) {
        setSmartPicksTipOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [smartPicksTipOpen]);

  useEffect(() => {
    if (!mealPlanTipOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.meal-plan-panel-tip-wrap')) {
        setMealPlanTipOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [mealPlanTipOpen]);

  useEffect(() => {
    if (!mealPrepMode) setMealPlanTipOpen(false);
  }, [mealPrepMode]);

  // ── Computed values ──
  const visible = recipesForCardStrip(
    browseMode,
    activeCategory,
    dietScope,
    mealPrepMode,
    mealPlanIds,
    smartPicksEnabled
  );
  const navTabs = getNavTabs(browseMode);
  const recipe = RECIPES.find((x) => x.id === selectedId);
  const inPlan = new Set(mealPlanIds);
  const planHintCtx = planOverlapContextForIngredientHints(mealPlanIds, mealPrepMode, smartPicksEnabled, selectedId);
  const stripPlanKeys = useMemo(() => mealPlanOverlapIngredientKeys(mealPlanIds), [mealPlanIds]);
  const displayIngredients = useMemo(() => {
    if (!recipe) return [];
    return sortIngredientsForPlanOverlapDisplay(recipe.ingredients, planHintCtx, activeDiet);
  }, [recipe, planHintCtx, activeDiet]);

  const smartPicksReady = mealPlanIds.length > 0;
  const smartPicksStripActive = smartPicksEnabled && mealPrepMode && smartPicksReady;

  // Restore horizontal scroll after diet change once the new URL is active (handles `SaladApp` remount).
  useLayoutEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(CARD_STRIP_AFTER_DIET_STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let pending: { scrollLeft: number; selectedId: number };
    try {
      pending = JSON.parse(raw);
    } catch {
      try {
        sessionStorage.removeItem(CARD_STRIP_AFTER_DIET_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    const visibleNow = recipesForCardStrip(
      browseMode,
      activeCategory,
      dietScope,
      mealPrepMode,
      mealPlanIds,
      smartPicksEnabled
    );
    if (!visibleNow.some((r) => r.id === pending.selectedId)) {
      try {
        sessionStorage.removeItem(CARD_STRIP_AFTER_DIET_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    const strip = cardStripRef.current;
    if (!strip) return;

    try {
      sessionStorage.removeItem(CARD_STRIP_AFTER_DIET_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    const nudgeSelectedIntoView = () => {
      const sel = strip.querySelector<HTMLElement>(`[data-recipe-id="${pending.selectedId}"]`);
      if (!sel) return;
      const sr = strip.getBoundingClientRect();
      const cr = sel.getBoundingClientRect();
      if (cr.left >= sr.left && cr.right <= sr.right) return;
      sel.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    };

    strip.scrollLeft = pending.scrollLeft;
    nudgeSelectedIntoView();
    requestAnimationFrame(() => {
      const el = cardStripRef.current;
      if (!el) return;
      el.scrollLeft = pending.scrollLeft;
      const sel = el.querySelector<HTMLElement>(`[data-recipe-id="${pending.selectedId}"]`);
      if (!sel) return;
      const sr = el.getBoundingClientRect();
      const cr = sel.getBoundingClientRect();
      if (cr.left >= sr.left && cr.right <= sr.right) return;
      sel.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    });
  }, [
    pathname,
    browseMode,
    activeCategory,
    dietScope,
    mealPrepMode,
    mealPlanIds,
    smartPicksEnabled,
  ]);

  return (
    <>
      {/* ── Header ── */}
      <header className="site-header">
        <Link href="/salads" className="site-brand">
          Ease
        </Link>
        {pageHeading ? (
          <>
            <span className="site-header-sep" aria-hidden="true" />
            <h1 id="page-seo-heading" className="page-seo-heading">
              {pageHeading}
            </h1>
          </>
        ) : null}
      </header>

      {/* ── Browse Mode Bar ── */}
      <div className="browse-mode" id="browseModeBar">
        <span className="browse-mode-label">Browse by</span>
        <div className="browse-mode-toggle" role="group" aria-label="Browse recipes by">
          {(['cuisine', 'flavor', 'season'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={browseMode === mode ? 'active' : ''}
              onClick={() => handleSelectBrowseMode(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
        <label className="browse-diet-scope">
          <span className="browse-mode-label">Diet</span>
          <span className="browse-diet-select-wrap">
            <select
              className={`browse-diet-select${dietScope ? ' browse-diet-select--active' : ''}`}
              aria-label="Filter recipes by diet"
              value={dietScope ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                handleDietScopeChange(v === '' ? null : v);
              }}
            >
              <option value="">None</option>
            {DIET_KEYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            </select>
          </span>
        </label>
        <div className="browse-mode-tail">
          {mealPrepMode && (
            <span className="browse-smart-picks-cluster">
              <button
                type="button"
                className={`browse-smart-picks-btn${smartPicksEnabled ? ' active' : ''}`}
                aria-pressed={smartPicksEnabled ? 'true' : 'false'}
                disabled={!smartPicksReady}
                aria-disabled={!smartPicksReady}
                title={smartPicksReady ? '' : 'Add at least one salad to your meal plan to use Smart Picks.'}
                onClick={() => {
                  if (!smartPicksReady) return;
                  setSmartPicksTipOpen(false);
                  setSmartPicksEnabled((prev) => !prev);
                }}
              >
                Smart Picks
              </button>
              <span className={`browse-smart-picks-tip-wrap${smartPicksTipOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="browse-smart-picks-tip-btn"
                  aria-label="About Smart Picks"
                  aria-expanded={smartPicksTipOpen ? 'true' : 'false'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSmartPicksTipOpen((prev) => !prev);
                  }}
                >
                  i
                </button>
                <span className="browse-smart-picks-tip-bubble" role="tooltip">
                  {OVERLAP_TAB_TIP_COPY}
                </span>
              </span>
            </span>
          )}
          <span className="browse-mode-spacer" aria-hidden="true" />
          <button
            type="button"
            className={`meal-prep-mode-btn${mealPrepMode ? ' active' : ''}`}
            aria-pressed={mealPrepMode ? 'true' : 'false'}
            title="Select multiple salads and copy a combined grocery list or recipes"
            onClick={handleToggleMealPrepMode}
          >
            Prep mode
          </button>
        </div>
        {mealPrepMode && !smartPicksReady && (
          <p className="browse-smart-picks-hint">
            Add at least one salad to your meal plan to use Smart Picks.
          </p>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className={smartPicksEnabled ? 'nav--smart-picks' : ''}>
        {navTabs.map((cat) => {
          const accent = accentForNavCat(cat, browseMode);
          return (
            <button
              key={cat}
              type="button"
              className={cat === activeCategory ? 'active' : ''}
              style={{ '--accent': accent } as React.CSSProperties}
              onClick={() => handleSelectCategory(cat)}
            >
              {cat}
            </button>
          );
        })}
      </nav>

      {/* ── Card Strip ── */}
      <div className="card-strip-wrapper">
        <div className="card-strip" id="cardStrip" ref={cardStripRef}>
          {visible.map((r) => {
            const accent = ACCENT[r.subCuisine];
            const sel = r.id === selectedId ? 'selected' : '';
            const plan = inPlan.has(r.id) ? 'in-meal-plan' : '';
            const sub =
              (browseMode === 'cuisine' || browseMode === 'flavor' || browseMode === 'season') &&
              r.subCuisine ? (
                <div className="card-subcuisine">{r.subCuisine}</div>
              ) : null;
            const onPlan = inPlan.has(r.id);
            const cardSlug = recipeCardImageSlug(r.name, r.imageSlug);
            const overlapN = smartPicksStripActive ? overlapMatchCount(stripPlanKeys, r) : 0;
            return (
              <div
                key={r.id}
                className={`recipe-card ${sel} ${plan}`}
                data-recipe-id={r.id}
                style={
                  {
                    '--card-accent': accent,
                    '--card-image': `url('/images/${cardSlug}.png')`,
                  } as React.CSSProperties
                }
                role="button"
                tabIndex={0}
                aria-label={`View ${r.name}`}
                onClick={() => handleSelectRecipe(r.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectRecipe(r.id);
                  }
                }}
              >
                {smartPicksStripActive && (
                  <span className="card-smart-picks-matches" title="Ingredients overlapping your meal plan">
                    {overlapN} shared
                  </span>
                )}
                {mealPrepMode && (
                  <button
                    type="button"
                    className={`meal-plan-card-ctl ${onPlan ? 'meal-plan-card-ctl-on' : 'meal-plan-card-ctl-add'}`}
                    aria-pressed={onPlan ? 'true' : 'false'}
                    aria-label={onPlan ? `Remove ${r.name} from meal plan` : `Add ${r.name} to meal plan`}
                    title={onPlan ? 'Remove from plan' : 'Add to plan'}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleMealPlanRecipe(r.id);
                    }}
                  >
                    {onPlan ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    )}
                  </button>
                )}
                <div className="card-label-wrap">
                  <div className="card-label">{r.name}</div>
                  {sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Recipe Detail ── */}
      <div id="recipeDetail">
        {recipe ? (
          <div className="recipe-detail" style={{ '--detail-accent': ACCENT[recipe.subCuisine] } as React.CSSProperties}>
            <div className="detail-header">
              <div>
                <div className="detail-meta" dangerouslySetInnerHTML={{ __html: detailMetaBadgesHtml(recipe, browseMode) }} />
                <h2 className="detail-title">{recipe.name}</h2>
              </div>
              <div className="copy-actions">
                <button
                  type="button"
                  id="unitsToggleBtn"
                  className="copy-btn"
                  hidden={!showAmounts}
                  aria-pressed={unitMode === 'metric' ? 'true' : 'false'}
                  aria-label="Switch between imperial and metric units"
                  onClick={handleToggleUnits}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                  <span className="units-toggle-label">{unitMode === 'metric' ? 'Metric' : 'Imperial'}</span>
                </button>
                <button
                  type="button"
                  id="amountToggleBtn"
                  className={`copy-btn toggle-btn ${showAmounts ? 'active' : ''}`}
                  onClick={handleToggleAmounts}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-4" /><rect x="9" y="3" width="6" height="5" rx="1" /></svg>
                  <span className="toggle-label">{showAmounts ? 'Hide amounts' : 'Show amounts'}</span>
                </button>
                <button type="button" id="copyIngredientsBtn" className="copy-btn" onClick={() => handleCopyIngredients(recipe.id)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                  Copy ingredients
                </button>
                <button type="button" id="copyFullRecipeBtn" className="copy-btn" onClick={() => handleCopyFullRecipe(recipe.id)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                  Copy full recipe
                </button>
              </div>
            </div>
            <div className="detail-body">
              <div>
                <div className="section-heading ingredients-heading-row">
                  <div className="section-heading-label">
                    <span>🛒</span> Ingredients
                  </div>
                  <button
                    type="button"
                    className="servings-chip"
                    id="servingsOpenBtn"
                    hidden={!showAmounts}
                    onClick={() => openServingsModal('recipe')}
                    aria-label="Recipe portions"
                    title="Scale by portions"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
                    <span id="servingsChipNum">{recipePortions}</span>
                  </button>
                </div>
                <ul
                  id="ingredientsList"
                  className="ingredients-list"
                  dangerouslySetInnerHTML={{
                    __html: displayIngredients.map((ing) => renderIngredient(ing, planHintCtx)).join(''),
                  }}
                />
                {displayIngredients.map((ing, i) => {
                  if (!isDressingLine(ing)) return null;
                  const html = renderDressingDiySectionHtml(ing);
                  if (!html) return null;
                  return (
                    <div
                      key={`dressing-diy-${recipe.id}-${i}`}
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  );
                })}
                {(() => {
                  const recs = getRecommendedProteins(recipe);
                  const recStar = (
                    <span className="protein-rec-badge" title="Pairs well with this salad">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </span>
                  );
                  const renderProteinItem = (p, i, recName) => {
                    const isSelected = selectedProteinByRecipe[recipe.id] === p.name;
                    const isRec = p.name === recName;
                    const toggleProtein = () =>
                      setSelectedProteinByRecipe((prev) =>
                        prev[recipe.id] === p.name
                          ? (() => { const next = { ...prev }; delete next[recipe.id]; return next; })()
                          : { ...prev, [recipe.id]: p.name }
                      );
                    return (
                      <li
                        key={i}
                        className={isSelected ? 'protein-selected' : ''}
                        role="button"
                        tabIndex={0}
                        onClick={toggleProtein}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleProtein(); }
                        }}
                      >
                        <span className="bullet" />
                        <span className="ingredient-body">
                          {showAmounts && (
                            <span className="amount">{formatAmountForDisplay(p.amount, p.name)} </span>
                          )}
                          {p.name}
                          {isRec && recStar}
                        </span>
                        <span className="protein-check"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></span>
                      </li>
                    );
                  };

                  if (activeDiet) {
                    const proteins = getOptionalProteinsForDiet(activeDiet, recipe);
                    if (!proteins.length) return null;
                    const dietRecName = proteins.find((p) => p.name === recs.traditional)?.name
                      || proteins.find((p) => p.name === recs.plant)?.name
                      || null;
                    const sorted = pickTopOptionalProteinsForDisplay(recipe, proteins, dietRecName, 3);
                    return (
                      <div className="optional-protein-section">
                        <div className="section-heading">
                          <span>💪</span> Add a protein <span className="optional-protein-label">(optional)</span>
                        </div>
                        <ul className="ingredients-list optional-protein-list">
                          {sorted.map((p, i) => renderProteinItem(p, i, dietRecName))}
                        </ul>
                      </div>
                    );
                  }

                  const traditional = pickTopOptionalProteinsForDisplay(
                    recipe,
                    OPTIONAL_PROTEINS.filter((p) => p.category === 'traditional'),
                    recs.traditional,
                    3
                  );
                  const plant = pickTopOptionalProteinsForDisplay(
                    recipe,
                    OPTIONAL_PROTEINS.filter((p) => p.category === 'plant'),
                    recs.plant,
                    3
                  );
                  if (!traditional.length && !plant.length) return null;
                  return (
                    <div className="optional-protein-section">
                      <div className="section-heading">
                        <span>💪</span> Add a protein <span className="optional-protein-label">(optional)</span>
                      </div>
                      <div className="protein-columns">
                        <div className="protein-column">
                          <div className="protein-column-heading">Traditional</div>
                          <ul className="ingredients-list optional-protein-list">
                            {traditional.map((p, i) => renderProteinItem(p, i, recs.traditional))}
                          </ul>
                        </div>
                        <div className="protein-column">
                          <div className="protein-column-heading">Plant-Based</div>
                          <ul className="ingredients-list optional-protein-list">
                            {plant.map((p, i) => renderProteinItem(p, i, recs.plant))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div>
                <div className="section-heading">
                  <span>📋</span> Steps
                </div>
                <ul className="steps-list">
                  {recipeStepsForDisplay(recipe, selectedProteinByRecipe[recipe.id] || null).map((s, i) => (
                    <li key={i}>
                      <span className="step-num">{i + 1}</span>
                      <span className="step-content" dangerouslySetInnerHTML={{ __html: formatStepLineHtml(s, recipe) }} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">Select a recipe above to view its details.</div>
        )}
      </div>

      {/* ── Meal Plan Panel ── */}
      {mealPrepMode && (
        <section className="meal-plan-panel" style={{ '--detail-accent': '#4a5568' } as React.CSSProperties} aria-labelledby="mealPlanPanelHeading">
          <div className="meal-plan-panel-header">
            <div className="meal-plan-panel-title-row">
              <h2 id="mealPlanPanelHeading" className="meal-plan-panel-title">This week&apos;s meal plan</h2>
              <span
                className={`browse-smart-picks-tip-wrap meal-plan-panel-tip-wrap${mealPlanTipOpen ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="browse-smart-picks-tip-btn"
                  aria-label="How to use the meal plan"
                  aria-expanded={mealPlanTipOpen ? 'true' : 'false'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMealPlanTipOpen((prev) => !prev);
                  }}
                >
                  i
                </button>
                <span className="browse-smart-picks-tip-bubble" role="tooltip">
                  Tap <strong>+</strong> on a card to add recipes to a day (checkmark removes). Drag chips between
                  days to plan your week.
                </span>
              </span>
            </div>
            <div className="copy-actions">
              <button
                type="button"
                className="servings-chip"
                id="mealPlanServingsOpenBtn"
                hidden={!mealPlanShowAmounts}
                onClick={() => openServingsModal('mealPlan')}
                aria-label="Meal plan portions"
                title="Scale each salad in the plan by portions"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
                <span>{servingsModalOpen && servingsModalTarget === 'mealPlan' && portionsDraft != null ? portionsDraft : mealPlanPortions}</span>
              </button>
              <button
                type="button"
                id="mealPlanUnitsToggleBtn"
                className="copy-btn"
                hidden={!mealPlanShowAmounts}
                aria-pressed={mealPlanUnitMode === 'metric' ? 'true' : 'false'}
                aria-label="Switch between imperial and metric units for meal plan copy"
                onClick={handleToggleMealPlanUnits}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
                <span className="units-toggle-label">{mealPlanUnitMode === 'metric' ? 'Metric' : 'Imperial'}</span>
              </button>
              <button
                type="button"
                id="mealPlanAmountToggleBtn"
                className={`copy-btn toggle-btn ${mealPlanShowAmounts ? 'active' : ''}`}
                onClick={handleToggleMealPlanAmounts}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-4" /><rect x="9" y="3" width="6" height="5" rx="1" /></svg>
                <span className="toggle-label">{mealPlanShowAmounts ? 'Hide amounts' : 'Show amounts'}</span>
              </button>
              <button
                type="button"
                id="mealPlanCopyIngredientsBtn"
                className="copy-btn"
                onClick={handleCopyMealPlanIngredients}
                disabled={mealPlanIds.length === 0}
                aria-label="Copy all ingredients for salads in this plan"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                Copy all ingredients
              </button>
              <button
                type="button"
                id="mealPlanCopyFullRecipeBtn"
                className="copy-btn"
                onClick={handleCopyMealPlanFullRecipes}
                disabled={mealPlanIds.length === 0}
                aria-label="Copy all full recipes in this plan"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                Copy all recipes
              </button>
            </div>
          </div>
          <div
            className="meal-plan-board"
            aria-label="Meal plan by day of the week. Each day can hold multiple recipes; drag chips between columns."
          >
            {MEAL_PLAN_DAY_LABELS.map((dayLabel, dayIdx) => (
              <div
                key={dayLabel}
                className={`meal-plan-column${mealPlanDragOverDay === dayIdx ? ' meal-plan-column--drag-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!e.dataTransfer.types.includes('text/plain')) return;
                  e.dataTransfer.dropEffect = 'move';
                  setMealPlanDragOverDay((prev) => (prev === dayIdx ? prev : dayIdx));
                }}
                onDrop={(e) => handleMealPlanDropOnDay(dayIdx, e)}
              >
                <div className="meal-plan-column-head">{dayLabel}</div>
                <div className="meal-plan-column-body">
                  {mealPlanByDay[dayIdx].map((id) => {
                    const r = RECIPES.find((x) => x.id === id);
                    if (!r) return null;
                    const planLabel = mealPlanChipDisplayName(r.name);
                    return (
                      <div
                        key={id}
                        className="meal-plan-chip"
                        draggable
                        onDragStart={(e) => {
                          const chip = e.currentTarget;
                          e.dataTransfer.setData('text/plain', String(id));
                          e.dataTransfer.effectAllowed = 'move';

                          mealPlanDragGhostRef.current?.remove();
                          const ghost = document.createElement('div');
                          ghost.className = 'meal-plan-drag-ghost';
                          ghost.textContent = planLabel;
                          ghost.setAttribute('aria-hidden', 'true');
                          document.body.appendChild(ghost);
                          const rect = chip.getBoundingClientRect();
                          const ox = Math.min(
                            Math.max(e.clientX - rect.left, 0),
                            Math.max(rect.width, 1)
                          );
                          const oy = Math.min(
                            Math.max(e.clientY - rect.top, 0),
                            Math.max(rect.height, 1)
                          );
                          let dragImageOk = false;
                          try {
                            e.dataTransfer.setDragImage(ghost, ox, oy);
                            dragImageOk = true;
                            mealPlanDragGhostRef.current = ghost;
                          } catch {
                            ghost.remove();
                            mealPlanDragGhostRef.current = null;
                          }

                          // Hiding the source in the same tick breaks native drag in Chrome/WebKit.
                          // If setDragImage failed, keep the chip visible so the browser still has a drag preview.
                          requestAnimationFrame(() => {
                            if (dragImageOk) chip.classList.add('meal-plan-chip--dragging');
                          });
                        }}
                        onDragEnd={(e) => {
                          e.currentTarget.classList.remove('meal-plan-chip--dragging');
                          mealPlanDragGhostRef.current?.remove();
                          mealPlanDragGhostRef.current = null;
                          setMealPlanDragOverDay(null);
                        }}
                      >
                        <span>{planLabel}</span>
                        <button
                          type="button"
                          className="meal-plan-chip-remove"
                          draggable={false}
                          onClick={() => handleRemoveFromMealPlan(id)}
                          aria-label={`Remove ${planLabel} from ${dayLabel}`}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="meal-plan-footer">
            <button
              type="button"
              id="mealPlanClearBtn"
              className="copy-btn"
              onClick={handleClearMealPlan}
              disabled={mealPlanIds.length === 0}
              aria-label="Clear meal plan"
            >
              Clear plan
            </button>
          </div>
        </section>
      )}

      {/* ── Servings Modal ── */}
      {servingsModalOpen && (
        <div className="servings-modal">
          <div className="servings-modal-backdrop" onClick={closeServingsModal} aria-hidden="true" />
          <div
            className="servings-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="servingsModalTitle"
            style={{ '--detail-accent': servingsModalTarget === 'recipe' && recipe ? ACCENT[recipe.subCuisine] : '#4a5568' } as React.CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="servings-modal-top">
              <div id="servingsModalTitle" className="servings-modal-title">
                <span className="servings-modal-title-num">{portionsDraft ?? 2}</span>
                <span className="servings-modal-title-label">Portions</span>
              </div>
              <button type="button" className="servings-modal-close" onClick={closeServingsModal} aria-label="Close">
                ×
              </button>
            </div>
            <p className="servings-modal-hint">
              Each portion is sized as one filling meal—scale up if you&apos;re meal prepping or feeding more people.
            </p>
            <div className="servings-slider-row">
              <div className="servings-slider-wrap">
                <input
                  type="range"
                  className="servings-slider"
                  min={SCALING_BASE_PORTIONS}
                  max="20"
                  step={SCALING_BASE_PORTIONS}
                  value={portionsDraft ?? SCALING_BASE_PORTIONS}
                  onChange={(e) => setPortionsDraft(Number(e.target.value))}
                />
              </div>
              <div className="servings-scale-pill">
                × <strong>{portionsDraft != null ? Math.round(portionsDraft / SCALING_BASE_PORTIONS) : 1}</strong>
              </div>
            </div>
            <div className="servings-modal-actions">
              <button type="button" className="servings-btn-cancel" onClick={closeServingsModal}>
                Cancel
              </button>
              <button type="button" className="servings-btn-apply" onClick={applyServingsModal}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Flash Message ── */}
      {flashMsg && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 'max(24px, env(safe-area-inset-bottom, 0px))',
            maxWidth: 'calc(100vw - 32px)',
            background: '#1a1a18',
            color: '#fff',
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: '500',
            zIndex: 1000,
            pointerEvents: 'none',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          {flashMsg}
        </div>
      )}
    </>
  );
}
