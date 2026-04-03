import { notFound } from 'next/navigation';
import SaladApp from '@/components/SaladApp';
import { DIET_FROM_SLUG } from '@/data/diet-config';

type BrowseMode = 'cuisine' | 'flavor' | 'season' | 'diet';

const SLUG_TO_MODE_CATEGORY: Record<string, { mode: BrowseMode; category: string }> = {
  // Cuisine (flat sub-cuisines)
  'american': { mode: 'cuisine', category: 'American' },
  'italian': { mode: 'cuisine', category: 'Italian' },
  'greek': { mode: 'cuisine', category: 'Greek' },
  'french': { mode: 'cuisine', category: 'French' },
  'middle-eastern': { mode: 'cuisine', category: 'Middle Eastern' },
  'spanish': { mode: 'cuisine', category: 'Spanish' },
  'mexican': { mode: 'cuisine', category: 'Mexican' },
  'indian': { mode: 'cuisine', category: 'Indian' },
  'thai': { mode: 'cuisine', category: 'Thai' },
  'japanese': { mode: 'cuisine', category: 'Japanese' },
  'korean': { mode: 'cuisine', category: 'Korean' },
  'vietnamese': { mode: 'cuisine', category: 'Vietnamese' },
  // Legacy redirects
  'mediterranean': { mode: 'cuisine', category: 'Greek' },
  'asian': { mode: 'cuisine', category: 'Japanese' },
  'spanish-mexican': { mode: 'cuisine', category: 'Mexican' },
  // Flavor
  'tangy': { mode: 'flavor', category: 'Tangy' },
  'creamy': { mode: 'flavor', category: 'Creamy' },
  'spicy': { mode: 'flavor', category: 'Spicy' },
  'fresh': { mode: 'flavor', category: 'Fresh' },
  'savory': { mode: 'flavor', category: 'Savory' },
  'umami': { mode: 'flavor', category: 'Umami' },
  // Season
  'spring': { mode: 'season', category: 'Spring' },
  'summer': { mode: 'season', category: 'Summer' },
  'fall': { mode: 'season', category: 'Fall' },
  'winter': { mode: 'season', category: 'Winter' },
  'year-round': { mode: 'season', category: 'Year-round' },
  // Diet
  ...Object.fromEntries(
    Object.entries(DIET_FROM_SLUG).map(([slug, name]) => [
      slug,
      { mode: 'diet' as BrowseMode, category: name },
    ])
  ),
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SlugPage({ params }: PageProps) {
  const { slug } = await params;

  if (!slug.endsWith('-salads')) {
    notFound();
  }

  const prefix = slug.replace(/-salads$/, '');
  const match = SLUG_TO_MODE_CATEGORY[prefix];

  if (!match) {
    notFound();
  }

  return <SaladApp initialBrowseMode={match.mode} initialCategory={match.category} />;
}
