import { DIET_FROM_SLUG } from '@/data/diet-config';
import { FLAVOR_KEYS, SEASON_KEYS } from '@/data/constants';

/** Global browse hubs (not under `/salads/...`). */
export const SALADS_BY_FLAVOR_PATH = '/salads-by-flavor';
export const SALADS_BY_SEASON_PATH = '/salads-by-season';

/** Second segment of `/salads/{type}/{value}` — maps URL slug → browse category label. */
export const NESTED_SLUG_TO_CATEGORY: Record<string, string> = {
  american: 'American',
  italian: 'Italian',
  greek: 'Greek',
  french: 'French',
  'middle-eastern': 'Middle Eastern',
  spanish: 'Spanish',
  mexican: 'Mexican',
  indian: 'Indian',
  thai: 'Thai',
  japanese: 'Japanese',
  korean: 'Korean',
  vietnamese: 'Vietnamese',
  mediterranean: 'Greek',
  asian: 'Japanese',
  'spanish-mexican': 'Mexican',
  tangy: 'Tangy',
  creamy: 'Creamy',
  spicy: 'Spicy',
  fresh: 'Fresh',
  savory: 'Savory',
  umami: 'Umami',
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
  'year-round': 'Year-round',
  ...DIET_FROM_SLUG,
  'high-protein': 'Keto',
};

/** Descriptive browse axes only — diet is a separate scope (`dietScope`), not a peer mode. */
export type SaladBrowseMode = 'cuisine' | 'flavor' | 'season';

export interface FlatBrowseResolution {
  mode: SaladBrowseMode;
  category: string;
  /** When set, listings and recipe detail use this diet (hub pages + `?diet=`). */
  dietScope: string | null;
}

const dietCategoryNames = new Set(Object.values(DIET_FROM_SLUG));

export const FLAT_PREFIX_TO_BROWSE: Record<string, FlatBrowseResolution> = {
  american: { mode: 'cuisine', category: 'American', dietScope: null },
  italian: { mode: 'cuisine', category: 'Italian', dietScope: null },
  greek: { mode: 'cuisine', category: 'Greek', dietScope: null },
  french: { mode: 'cuisine', category: 'French', dietScope: null },
  'middle-eastern': { mode: 'cuisine', category: 'Middle Eastern', dietScope: null },
  spanish: { mode: 'cuisine', category: 'Spanish', dietScope: null },
  mexican: { mode: 'cuisine', category: 'Mexican', dietScope: null },
  indian: { mode: 'cuisine', category: 'Indian', dietScope: null },
  thai: { mode: 'cuisine', category: 'Thai', dietScope: null },
  japanese: { mode: 'cuisine', category: 'Japanese', dietScope: null },
  korean: { mode: 'cuisine', category: 'Korean', dietScope: null },
  vietnamese: { mode: 'cuisine', category: 'Vietnamese', dietScope: null },
  mediterranean: { mode: 'cuisine', category: 'Greek', dietScope: null },
  asian: { mode: 'cuisine', category: 'Japanese', dietScope: null },
  'spanish-mexican': { mode: 'cuisine', category: 'Mexican', dietScope: null },
  tangy: { mode: 'flavor', category: 'Tangy', dietScope: null },
  creamy: { mode: 'flavor', category: 'Creamy', dietScope: null },
  spicy: { mode: 'flavor', category: 'Spicy', dietScope: null },
  fresh: { mode: 'flavor', category: 'Fresh', dietScope: null },
  savory: { mode: 'flavor', category: 'Savory', dietScope: null },
  umami: { mode: 'flavor', category: 'Umami', dietScope: null },
  spring: { mode: 'season', category: 'Spring', dietScope: null },
  summer: { mode: 'season', category: 'Summer', dietScope: null },
  fall: { mode: 'season', category: 'Fall', dietScope: null },
  winter: { mode: 'season', category: 'Winter', dietScope: null },
  'year-round': { mode: 'season', category: 'Year-round', dietScope: null },
  ...Object.fromEntries(
    Object.entries(DIET_FROM_SLUG).map(([slug, name]) => [
      slug,
      { mode: 'cuisine' as const, category: 'All', dietScope: name },
    ])
  ),
  'high-protein': { mode: 'cuisine', category: 'All', dietScope: 'Keto' },
};

/** URL segment kinds for the second path segment under `/salads/{kind}/{slug}`. */
export type NestedPathKind = 'cuisine' | 'flavor' | 'season' | 'diet';

/** Classify a nested `/salads/{type}/{slug}` value slug (second segment). */
export function nestedSegmentKind(slug: string): NestedPathKind | null {
  const cat = NESTED_SLUG_TO_CATEGORY[slug];
  if (!cat) return null;
  if (dietCategoryNames.has(cat) || slug === 'high-protein') return 'diet';
  if ((FLAVOR_KEYS as readonly string[]).includes(cat)) return 'flavor';
  if ((SEASON_KEYS as readonly string[]).includes(cat)) return 'season';
  return 'cuisine';
}

/** Every `{ type, slug }` pair valid for static generation of nested salad routes. */
export function allNestedSaladFilterParams(): { filter: string[] }[] {
  const out: { filter: string[] }[] = [];
  const seen = new Set<string>();
  for (const slug of Object.keys(NESTED_SLUG_TO_CATEGORY)) {
    const kind = nestedSegmentKind(slug);
    if (!kind) continue;
    const key = `${kind}:${slug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ filter: [kind, slug] });
  }
  for (const dietSlug of Object.keys(DIET_FROM_SLUG)) {
    for (const slug of Object.keys(NESTED_SLUG_TO_CATEGORY)) {
      const subKind = nestedSegmentKind(slug);
      if (!subKind || subKind === 'diet') continue;
      const key4 = `diet:${dietSlug}:${subKind}:${slug}`;
      if (seen.has(key4)) continue;
      seen.add(key4);
      out.push({ filter: ['diet', dietSlug, subKind, slug] });
    }
  }
  return out;
}

/** `american-salads` → `american` */
export function flatSlugToPrefix(flatSlug: string): string | null {
  if (!flatSlug.endsWith('-salads')) return null;
  return flatSlug.replace(/-salads$/, '');
}

/** Root `/{prefix}-salads` slug for a browse mode + category (non-diet flats only). */
export function rootFlatPrefixForBrowse(mode: SaladBrowseMode, category: string): string | null {
  const candidates: string[] = [];
  for (const [prefix, res] of Object.entries(FLAT_PREFIX_TO_BROWSE)) {
    if (res.dietScope != null) continue;
    if (res.mode === mode && res.category === category) candidates.push(prefix);
  }
  if (candidates.length === 0) return null;
  candidates.sort();
  return candidates[0];
}

/** True when `prefix` is a diet hub (`vegan`, `keto`, …), i.e. `{prefix}-salads` may have subpaths. */
export function flatPrefixIsDietParent(prefix: string): boolean {
  const r = FLAT_PREFIX_TO_BROWSE[prefix];
  return r != null && r.dietScope != null;
}

/**
 * Single segment under `/{diet}-salads/…` — e.g. `american` → cuisine/American; `flavor`/`season` → hub.
 */
export function parseDietPrefixedSegments(
  segments: string[]
): { browseMode: SaladBrowseMode; activeCategory: string } | null {
  if (segments.length !== 1) return null;
  const seg = segments[0];
  if (seg === 'flavor') return { browseMode: 'flavor', activeCategory: 'All' };
  if (seg === 'season') return { browseMode: 'season', activeCategory: 'All' };
  const kind = nestedSegmentKind(seg);
  if (!kind || kind === 'diet') return null;
  const cat = NESTED_SLUG_TO_CATEGORY[seg];
  if (!cat) return null;
  return { browseMode: kind, activeCategory: cat };
}

/**
 * Diet-scoped URL path (no trailing slash), e.g. `/vegan-salads/american`.
 * Returns `null` if `dietScope` cannot be turned into a slug.
 */
export function dietPrefixedBrowsePath(
  browseMode: SaladBrowseMode,
  activeCategory: string,
  dietScope: string
): string | null {
  const dslug = Object.entries(DIET_FROM_SLUG).find(([, name]) => name === dietScope)?.[0];
  if (!dslug) return null;
  if (activeCategory === 'All' && browseMode === 'cuisine') {
    return `/${dslug}-salads`;
  }
  if (activeCategory === 'All' && browseMode === 'flavor') {
    return `/${dslug}-salads/flavor`;
  }
  if (activeCategory === 'All' && browseMode === 'season') {
    return `/${dslug}-salads/season`;
  }
  const p = rootFlatPrefixForBrowse(browseMode, activeCategory);
  if (!p) return null;
  return `/${dslug}-salads/${p}`;
}

/** Static params for `app/[slug]/[...filter]/page.tsx` (diet parent + one segment). */
export function allDietPrefixedCatchAllParams(): { slug: string; filter: string[] }[] {
  const out: { slug: string; filter: string[] }[] = [];
  for (const [prefix, res] of Object.entries(FLAT_PREFIX_TO_BROWSE)) {
    if (res.dietScope == null) continue;
    if (prefix === 'high-protein') continue;
    const slug = `${prefix}-salads`;
    out.push({ slug, filter: ['flavor'] });
    out.push({ slug, filter: ['season'] });
    for (const key of Object.keys(NESTED_SLUG_TO_CATEGORY)) {
      const kind = nestedSegmentKind(key);
      if (!kind || kind === 'diet') continue;
      out.push({ slug, filter: [key] });
    }
  }
  return out;
}
