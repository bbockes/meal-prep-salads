import SaladApp from '@/components/SaladApp';
import { DIET_FROM_SLUG } from '@/data/diet-config';

const SLUG_TO_CATEGORY: Record<string, string> = {
  'american': 'American',
  'italian': 'Italian',
  'greek': 'Greek',
  'french': 'French',
  'middle-eastern': 'Middle Eastern',
  'spanish': 'Spanish',
  'mexican': 'Mexican',
  'indian': 'Indian',
  'thai': 'Thai',
  'japanese': 'Japanese',
  'korean': 'Korean',
  'vietnamese': 'Vietnamese',
  // Legacy parent cuisines
  'mediterranean': 'Greek',
  'asian': 'Japanese',
  'spanish-mexican': 'Mexican',
  'tangy': 'Tangy',
  'creamy': 'Creamy',
  'spicy': 'Spicy',
  'fresh': 'Fresh',
  'savory': 'Savory',
  'umami': 'Umami',
  'spring': 'Spring',
  'summer': 'Summer',
  'fall': 'Fall',
  'winter': 'Winter',
  'year-round': 'Year-round',
  ...DIET_FROM_SLUG,
  // Legacy diet URL (tab removed — land on Keto)
  'high-protein': 'Keto',
};

function parsePinnedRecipeId(sp: { r?: string | string[] } | undefined): number | null {
  if (!sp) return null;
  const raw = sp.r;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || s === '') return null;
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) ? n : null;
}

interface PageProps {
  params: Promise<{ filter?: string[] }>;
  searchParams?: Promise<{ r?: string | string[] }>;
}

export default async function SaladsPage({ params, searchParams }: PageProps) {
  const { filter } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const initialPinnedRecipeId = parsePinnedRecipeId(sp);

  let browseMode: 'cuisine' | 'flavor' | 'season' | 'diet' = 'cuisine';
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
    if (filterType === 'cuisine' || filterType === 'flavor' || filterType === 'season' || filterType === 'diet') {
      browseMode = filterType;
      activeCategory = SLUG_TO_CATEGORY[filterValue] || decodeURIComponent(filterValue);
    }
  }

  return (
    <SaladApp
      initialBrowseMode={browseMode}
      initialCategory={activeCategory}
      initialPinnedRecipeId={initialPinnedRecipeId}
    />
  );
}
