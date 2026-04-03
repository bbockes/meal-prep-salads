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

interface PageProps {
  params: Promise<{ filter?: string[] }>;
}

export default async function SaladsPage({ params }: PageProps) {
  const { filter } = await params;

  let browseMode: 'cuisine' | 'flavor' | 'season' | 'diet' = 'cuisine';
  let activeCategory = 'All';

  if (filter && filter.length === 2) {
    const [filterType, filterValue] = filter;
    if (filterType === 'cuisine' || filterType === 'flavor' || filterType === 'season' || filterType === 'diet') {
      browseMode = filterType;
      activeCategory = SLUG_TO_CATEGORY[filterValue] || decodeURIComponent(filterValue);
    }
  }

  return <SaladApp initialBrowseMode={browseMode} initialCategory={activeCategory} />;
}
