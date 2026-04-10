import type { Metadata } from 'next';
import { DIET_FROM_SLUG } from '@/data/diet-config';
import { NESTED_SLUG_TO_CATEGORY, type SaladBrowseMode } from '@/data/salad-routes';
import type { Recipe } from '@/data/recipes';
import { RECIPES } from '@/data/recipes';
import { recipesForCardStrip, recipeCardImageSlug } from '@/lib/recipe-utils';
import { ingredientLine, getRecipeDiets } from '@/lib/diet-utils';
import { absoluteUrl, getSiteBaseUrl } from '@/lib/seo/site';
import {
  FLAT_PREFIX_TO_BROWSE,
  dietPrefixedBrowsePath,
  allDietPrefixedCatchAllParams,
} from '@/data/salad-routes';

const SITE_NAME = 'Ease';

export { SITE_NAME };

/** Maps `?diet=vegan` etc. to display diet name (e.g. `Vegan`). */
export function dietQueryParamToScope(
  diet: string | string[] | undefined | null
): string | null {
  if (diet == null) return null;
  const raw = Array.isArray(diet) ? diet[0] : diet;
  if (raw == null || raw === '') return null;
  const key = String(raw).toLowerCase();
  return DIET_FROM_SLUG[key] ?? null;
}

export interface ParsedSaladsRoute {
  browseMode: SaladBrowseMode;
  activeCategory: string;
  dietScope: string | null;
  /** Long-tail `/salads/diet/{diet}/{mode}/{slug}` — canonical points to non-diet primary URL. */
  canonicalDietNested: boolean;
}

/** Keep in sync with `src/app/salads/[[...filter]]/page.tsx` route parsing. */
export function parseSaladsCatchAllFilter(filter: string[] | undefined): ParsedSaladsRoute {
  let browseMode: SaladBrowseMode = 'cuisine';
  let activeCategory = 'All';
  let dietScope: string | null = null;
  let canonicalDietNested = false;

  if (!filter || filter.length === 0) {
    return { browseMode, activeCategory, dietScope, canonicalDietNested };
  }

  if (filter.length === 4 && filter[0] === 'diet') {
    const [, dietSlug, subType, valueSlug] = filter;
    dietScope = DIET_FROM_SLUG[dietSlug] || null;
    if (subType === 'cuisine' || subType === 'flavor' || subType === 'season') {
      browseMode = subType;
      activeCategory = NESTED_SLUG_TO_CATEGORY[valueSlug] || decodeURIComponent(valueSlug);
    }
    canonicalDietNested = true;
    return { browseMode, activeCategory, dietScope, canonicalDietNested };
  }

  if (filter.length === 1) {
    const seg = filter[0];
    if (seg === 'flavor') {
      browseMode = 'flavor';
      activeCategory = 'All';
    } else if (seg === 'season') {
      browseMode = 'season';
      activeCategory = 'All';
    }
    return { browseMode, activeCategory, dietScope, canonicalDietNested };
  }

  if (filter.length === 2) {
    const [filterType, filterValue] = filter;
    if (filterType === 'diet') {
      dietScope = DIET_FROM_SLUG[filterValue] || null;
      browseMode = 'cuisine';
      activeCategory = 'All';
      return { browseMode, activeCategory, dietScope, canonicalDietNested };
    }
    if (filterType === 'cuisine' || filterType === 'flavor' || filterType === 'season') {
      browseMode = filterType;
      activeCategory = NESTED_SLUG_TO_CATEGORY[filterValue] || decodeURIComponent(filterValue);
    }
  }

  return { browseMode, activeCategory, dietScope, canonicalDietNested };
}

function categoryToFlatSaladsPath(category: string): string {
  const slug = category
    .toLowerCase()
    .replace(/\s+&\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `/${slug}-salads`;
}

/**
 * Canonical path for indexable salad URLs. Omits `?diet=` — use with diet query stripped.
 * Nested diet + category URLs canonicalize to the diet-free category flat URL.
 */
export function canonicalPathForSaladIndex(
  browseMode: SaladBrowseMode,
  activeCategory: string,
  dietScope: string | null,
  opts?: { canonicalDietNested?: boolean }
): string {
  if (opts?.canonicalDietNested && activeCategory !== 'All') {
    if (dietScope) {
      const dp = dietPrefixedBrowsePath(browseMode, activeCategory, dietScope);
      if (dp) return dp;
    }
    return categoryToFlatSaladsPath(activeCategory);
  }
  if (dietScope) {
    const dp = dietPrefixedBrowsePath(browseMode, activeCategory, dietScope);
    if (dp) return dp;
  }
  if (activeCategory === 'All') {
    if (browseMode === 'flavor') return '/salads/flavor';
    if (browseMode === 'season') return '/salads/season';
    return '/salads';
  }
  return categoryToFlatSaladsPath(activeCategory);
}

/** @deprecated Use canonicalPathForSaladIndex with dietScope. */
export function canonicalPathForBrowse(browseMode: SaladBrowseMode, activeCategory: string): string {
  return canonicalPathForSaladIndex(browseMode, activeCategory, null);
}

export interface SaladPageSeoCopy {
  title: string;
  description: string;
  h1: string;
}

function filterKeywords(
  browseMode: SaladBrowseMode,
  activeCategory: string,
  dietScope: string | null
): string {
  const parts = ['meal prep salad', 'healthy salad'];
  if (activeCategory !== 'All') {
    parts.push(`${activeCategory} salad`, `${activeCategory.toLowerCase()} meal prep`);
  }
  if (dietScope) {
    parts.push(`${dietScope.toLowerCase()} recipes`, `${dietScope.toLowerCase()} salad`);
  }
  return parts.join(', ');
}

export function getSaladPageSeoCopy(
  browseMode: SaladBrowseMode,
  activeCategory: string,
  dietScope: string | null = null
): SaladPageSeoCopy {
  const kw = filterKeywords(browseMode, activeCategory, dietScope);

  if (activeCategory === 'All' && browseMode === 'cuisine' && dietScope) {
    return {
      title: `${dietScope} Salad Recipes`,
      description: `${dietScope} salads for meal prep — ingredients and steps adapted for this way of eating. Plan your week with ${SITE_NAME} and copy your grocery list. Keywords: ${kw}.`,
      h1: `${dietScope} Salads`,
    };
  }

  if (activeCategory === 'All' && browseMode === 'cuisine') {
    return {
      title: 'Browse Salads by Cuisine',
      description: `${SITE_NAME} — browse salads by cuisine, flavor, or season, and optionally filter by diet. Build your weekly meal plan and copy a combined grocery list in one click.`,
      h1: 'Browse Salads by Cuisine',
    };
  }

  if (activeCategory === 'All' && browseMode === 'flavor' && dietScope) {
    return {
      title: `Browse ${dietScope} Salads by Flavor`,
      description: `Explore ${dietScope.toLowerCase()} salads by flavor profile — tangy, creamy, spicy, fresh, and more. Plan your week and copy your grocery list with ${SITE_NAME}. Keywords: ${kw}.`,
      h1: `Browse ${dietScope} Salads by Flavor`,
    };
  }

  if (activeCategory === 'All' && browseMode === 'flavor') {
    return {
      title: 'Salad Recipes by Flavor',
      description: `Explore salads by flavor profile — tangy, creamy, spicy, fresh, and more. Plan your week and copy your grocery list with ${SITE_NAME}.`,
      h1: 'Browse Salads by Flavor',
    };
  }

  if (activeCategory === 'All' && browseMode === 'season' && dietScope) {
    return {
      title: `Browse ${dietScope} Salads by Season`,
      description: `Browse ${dietScope.toLowerCase()} salads by season — spring, summer, fall, winter, and year-round picks. Use ${SITE_NAME} to plan ahead and copy your prep grocery list. Keywords: ${kw}.`,
      h1: `Browse ${dietScope} Salads by Season`,
    };
  }

  if (activeCategory === 'All' && browseMode === 'season') {
    return {
      title: 'Browse Salads by Season',
      description: `Browse salads by season — spring, summer, fall, winter, and year-round picks. Use ${SITE_NAME} to plan ahead and copy your prep grocery list.`,
      h1: 'Browse Salads by Season',
    };
  }

  if (browseMode === 'cuisine') {
    const dietPrefix = dietScope ? `${dietScope} ` : '';
    return {
      title: `${dietPrefix}${activeCategory} Salad Recipes`,
      description: `${activeCategory} salads for meal prep — fresh ideas, clear ingredients, and steps. Add favorites to your plan and copy your grocery list with ${SITE_NAME}. Keywords: ${kw}.`,
      h1: `${dietPrefix}${activeCategory} Salads`,
    };
  }

  if (browseMode === 'flavor') {
    const dietPrefix = dietScope ? `${dietScope} ` : '';
    return {
      title: `${dietPrefix}${activeCategory} Salad Recipes`,
      description: `${activeCategory} salad ideas for meal prep. Filtered flavor-forward recipes with ${SITE_NAME} — plan your week and copy your list. Keywords: ${kw}.`,
      h1: `${dietPrefix}${activeCategory} Salads`,
    };
  }

  if (browseMode === 'season') {
    const dietPrefix = dietScope ? `${dietScope} ` : '';
    return {
      title: `${dietPrefix}${activeCategory} Salad Ideas`,
      description: `${activeCategory} salad recipes for meal prep. Build your plan and copy a grocery list with ${SITE_NAME}. Keywords: ${kw}.`,
      h1: `${dietPrefix}${activeCategory} Salads`,
    };
  }

  return {
    title: 'Salad Recipes',
    description: `Salad recipes for meal prep with ${SITE_NAME}.`,
    h1: 'Salads',
  };
}

export function buildSaladIndexMetadata(
  browseMode: SaladBrowseMode,
  activeCategory: string,
  seo?: { dietScope?: string | null; canonicalDietNested?: boolean }
): Metadata {
  const dietScope = seo?.dietScope ?? null;
  const canonicalDietNested = seo?.canonicalDietNested ?? false;
  const copy = getSaladPageSeoCopy(browseMode, activeCategory, dietScope);
  const canonicalPath = canonicalPathForSaladIndex(browseMode, activeCategory, dietScope, {
    canonicalDietNested,
  });
  const url = absoluteUrl(canonicalPath);
  const title = `${copy.title} | ${SITE_NAME}`;

  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description: copy.description,
      url,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: copy.description,
    },
    robots: { index: true, follow: true },
  };
}

export function defaultRecipeForSeoJsonLd(
  browseMode: SaladBrowseMode,
  activeCategory: string,
  dietScope: string | null,
  initialPinnedRecipeId: number | null
): Recipe | null {
  const visible = recipesForCardStrip(browseMode, activeCategory, dietScope, false, [], false);
  if (!visible.length) return null;
  if (
    dietScope &&
    initialPinnedRecipeId != null &&
    visible.some((r: Recipe) => r.id === initialPinnedRecipeId)
  ) {
    return RECIPES.find((r: Recipe) => r.id === initialPinnedRecipeId) ?? visible[0];
  }
  return visible[0];
}

export function buildBreadcrumbJsonLd(args: {
  browseMode: SaladBrowseMode;
  activeCategory: string;
  dietScope: string | null;
  canonicalPath: string;
}): object {
  const base = getSiteBaseUrl();
  const copy = getSaladPageSeoCopy(args.browseMode, args.activeCategory, args.dietScope);
  const items: { '@type': string; position: number; name: string; item: string }[] =
    args.canonicalPath === '/salads'
      ? [
          {
            '@type': 'ListItem',
            position: 1,
            name: copy.h1,
            item: `${base}/salads`,
          },
        ]
      : [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Salads',
            item: `${base}/salads`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: copy.h1,
            item: `${base}${args.canonicalPath}`,
          },
        ];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

export function buildRecipeJsonLd(recipe: Recipe, canonicalPageUrl: string): object {
  const slug = recipeCardImageSlug(recipe.name, recipe.imageSlug);
  const imageUrl = absoluteUrl(`/images/${slug}.png`);
  const ingredients = recipe.ingredients.map((ing) => ingredientLine(ing));
  const diets = getRecipeDiets(recipe);
  const keywords = [
    'salad',
    'meal prep',
    recipe.cuisine,
    ...(recipe.flavorTags ?? []),
    ...diets,
  ].join(', ');

  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    description: `${recipe.name} — ${recipe.cuisine} salad for meal prep. ${recipe.steps[0] ?? ''}`.slice(
      0,
      320
    ),
    image: [imageUrl],
    recipeCategory: 'Salad',
    recipeCuisine: recipe.subCuisine || recipe.cuisine,
    keywords,
    recipeIngredient: ingredients,
    recipeInstructions: recipe.steps.map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text,
    })),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalPageUrl,
    },
  };
}

/** Unique canonical paths for sitemap (flat filter URLs + hub paths). */
export function allPublicSaladPaths(): string[] {
  const set = new Set<string>(['/salads', '/salads/flavor', '/salads/season']);
  for (const { mode, category, dietScope } of Object.values(FLAT_PREFIX_TO_BROWSE)) {
    set.add(
      canonicalPathForSaladIndex(mode, category, dietScope, { canonicalDietNested: false })
    );
  }
  for (const { slug, filter } of allDietPrefixedCatchAllParams()) {
    set.add(`/${slug}/${filter.join('/')}`);
  }
  return [...set].sort();
}
