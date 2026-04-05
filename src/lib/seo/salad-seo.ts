import type { Metadata } from 'next';
import { DIET_KEYS } from '@/data/diet-config';
import { NESTED_SLUG_TO_CATEGORY, type SaladBrowseMode } from '@/data/salad-routes';
import type { Recipe } from '@/data/recipes';
import { RECIPES } from '@/data/recipes';
import { recipesForCardStrip, recipeCardImageSlug } from '@/lib/recipe-utils';
import { ingredientLine, getRecipeDiets } from '@/lib/diet-utils';
import { absoluteUrl, getSiteBaseUrl } from '@/lib/seo/site';
import { FLAT_PREFIX_TO_BROWSE } from '@/data/salad-routes';

const SITE_NAME = 'Ease';

export { SITE_NAME };

export interface ParsedSaladsRoute {
  browseMode: SaladBrowseMode;
  activeCategory: string;
}

/** Keep in sync with `src/app/salads/[[...filter]]/page.tsx` route parsing. */
export function parseSaladsCatchAllFilter(filter: string[] | undefined): ParsedSaladsRoute {
  let browseMode: SaladBrowseMode = 'cuisine';
  let activeCategory = 'All';

  if (filter && filter.length === 1) {
    const seg = filter[0];
    if (seg === 'flavor') {
      browseMode = 'flavor';
      activeCategory = 'All';
    } else if (seg === 'season') {
      browseMode = 'season';
      activeCategory = 'All';
    }
  } else if (filter && filter.length === 2) {
    const [filterType, filterValue] = filter;
    if (
      filterType === 'cuisine' ||
      filterType === 'flavor' ||
      filterType === 'season' ||
      filterType === 'diet'
    ) {
      browseMode = filterType;
      activeCategory = NESTED_SLUG_TO_CATEGORY[filterValue] || decodeURIComponent(filterValue);
    }
  }

  return { browseMode, activeCategory };
}

/** Canonical path matching client `categoryToUrl` (flat URLs for specific filters). */
export function canonicalPathForBrowse(browseMode: SaladBrowseMode, activeCategory: string): string {
  if (activeCategory === 'All') {
    if (browseMode === 'flavor') return '/salads/flavor';
    if (browseMode === 'season') return '/salads/season';
    if (browseMode === 'diet') {
      const first = DIET_KEYS[0];
      return categoryToFlatSaladsPath(first);
    }
    return '/salads';
  }
  return categoryToFlatSaladsPath(activeCategory);
}

function categoryToFlatSaladsPath(category: string): string {
  const slug = category
    .toLowerCase()
    .replace(/\s+&\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `/${slug}-salads`;
}

export interface SaladPageSeoCopy {
  title: string;
  description: string;
  h1: string;
}

function filterKeywords(browseMode: SaladBrowseMode, activeCategory: string): string {
  const parts = ['meal prep salad', 'healthy salad'];
  if (activeCategory !== 'All') {
    parts.push(`${activeCategory} salad`, `${activeCategory.toLowerCase()} meal prep`);
  }
  if (browseMode === 'diet') parts.push(`${activeCategory.toLowerCase()} recipes`);
  return parts.join(', ');
}

export function getSaladPageSeoCopy(
  browseMode: SaladBrowseMode,
  activeCategory: string
): SaladPageSeoCopy {
  const kw = filterKeywords(browseMode, activeCategory);

  if (activeCategory === 'All' && browseMode === 'cuisine') {
    return {
      title: 'Browse Salads by Cuisine',
      description: `${SITE_NAME} — browse salads by cuisine, flavor, season, or diet. Build your weekly meal plan and copy a combined grocery list in one click.`,
      h1: 'Browse Salads by Cuisine',
    };
  }

  if (activeCategory === 'All' && browseMode === 'flavor') {
    return {
      title: 'Salad Recipes by Flavor',
      description: `Explore salads by flavor profile — tangy, creamy, spicy, fresh, and more. Plan your week and copy your grocery list with ${SITE_NAME}.`,
      h1: 'Browse Salads by Flavor',
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
    return {
      title: `${activeCategory} Salad Recipes`,
      description: `${activeCategory} salads for meal prep — fresh ideas, clear ingredients, and steps. Add favorites to your plan and copy your grocery list with ${SITE_NAME}. Keywords: ${kw}.`,
      h1: `${activeCategory} Salads`,
    };
  }

  if (browseMode === 'flavor') {
    return {
      title: `${activeCategory} Salad Recipes`,
      description: `${activeCategory} salad ideas for meal prep. Filtered flavor-forward recipes with ${SITE_NAME} — plan your week and copy your list. Keywords: ${kw}.`,
      h1: `${activeCategory} Salads`,
    };
  }

  if (browseMode === 'season') {
    return {
      title: `${activeCategory} Salad Ideas`,
      description: `${activeCategory} salad recipes for meal prep. Build your plan and copy a grocery list with ${SITE_NAME}. Keywords: ${kw}.`,
      h1: `${activeCategory} Salads`,
    };
  }

  // diet
  return {
    title: `${activeCategory} Salad Recipes`,
    description: `${activeCategory} salads for meal prep — ingredients and steps adapted for this way of eating. Plan your week with ${SITE_NAME} and copy your grocery list. Keywords: ${kw}.`,
    h1: `${activeCategory} Salads`,
  };
}

export function buildSaladIndexMetadata(
  browseMode: SaladBrowseMode,
  activeCategory: string
): Metadata {
  const copy = getSaladPageSeoCopy(browseMode, activeCategory);
  const canonicalPath = canonicalPathForBrowse(browseMode, activeCategory);
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
  initialPinnedRecipeId: number | null
): Recipe | null {
  const resolvedCategory =
    browseMode === 'diet' && activeCategory === 'All' ? DIET_KEYS[0] : activeCategory;
  const visible = recipesForCardStrip(browseMode, resolvedCategory, false, [], false);
  if (!visible.length) return null;
  if (
    browseMode === 'diet' &&
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
  canonicalPath: string;
}): object {
  const base = getSiteBaseUrl();
  const copy = getSaladPageSeoCopy(args.browseMode, args.activeCategory);
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
  for (const { mode, category } of Object.values(FLAT_PREFIX_TO_BROWSE)) {
    set.add(canonicalPathForBrowse(mode, category));
  }
  return [...set].sort();
}
