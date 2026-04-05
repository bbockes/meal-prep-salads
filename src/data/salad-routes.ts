import { DIET_FROM_SLUG } from '@/data/diet-config';
import { FLAVOR_KEYS, SEASON_KEYS } from '@/data/constants';

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

export type SaladBrowseMode = 'cuisine' | 'flavor' | 'season' | 'diet';

export const FLAT_PREFIX_TO_BROWSE: Record<string, { mode: SaladBrowseMode; category: string }> = {
  american: { mode: 'cuisine', category: 'American' },
  italian: { mode: 'cuisine', category: 'Italian' },
  greek: { mode: 'cuisine', category: 'Greek' },
  french: { mode: 'cuisine', category: 'French' },
  'middle-eastern': { mode: 'cuisine', category: 'Middle Eastern' },
  spanish: { mode: 'cuisine', category: 'Spanish' },
  mexican: { mode: 'cuisine', category: 'Mexican' },
  indian: { mode: 'cuisine', category: 'Indian' },
  thai: { mode: 'cuisine', category: 'Thai' },
  japanese: { mode: 'cuisine', category: 'Japanese' },
  korean: { mode: 'cuisine', category: 'Korean' },
  vietnamese: { mode: 'cuisine', category: 'Vietnamese' },
  mediterranean: { mode: 'cuisine', category: 'Greek' },
  asian: { mode: 'cuisine', category: 'Japanese' },
  'spanish-mexican': { mode: 'cuisine', category: 'Mexican' },
  tangy: { mode: 'flavor', category: 'Tangy' },
  creamy: { mode: 'flavor', category: 'Creamy' },
  spicy: { mode: 'flavor', category: 'Spicy' },
  fresh: { mode: 'flavor', category: 'Fresh' },
  savory: { mode: 'flavor', category: 'Savory' },
  umami: { mode: 'flavor', category: 'Umami' },
  spring: { mode: 'season', category: 'Spring' },
  summer: { mode: 'season', category: 'Summer' },
  fall: { mode: 'season', category: 'Fall' },
  winter: { mode: 'season', category: 'Winter' },
  'year-round': { mode: 'season', category: 'Year-round' },
  ...Object.fromEntries(
    Object.entries(DIET_FROM_SLUG).map(([slug, name]) => [
      slug,
      { mode: 'diet' as const, category: name },
    ])
  ),
};

const dietCategoryNames = new Set(Object.values(DIET_FROM_SLUG));

/** Classify a nested `/salads/{type}/{slug}` value slug (second segment). */
export function nestedSegmentKind(slug: string): SaladBrowseMode | null {
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
  return out;
}

/** `american-salads` → `american` */
export function flatSlugToPrefix(flatSlug: string): string | null {
  if (!flatSlug.endsWith('-salads')) return null;
  return flatSlug.replace(/-salads$/, '');
}
