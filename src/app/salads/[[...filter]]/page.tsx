import SaladApp from '@/components/SaladApp';

interface PageProps {
  params: Promise<{ filter?: string[] }>;
}

export default async function SaladsPage({ params }: PageProps) {
  const { filter } = await params;

  let browseMode: 'cuisine' | 'flavor' | 'season' = 'cuisine';
  let activeCategory = 'All';

  if (filter && filter.length === 2) {
    const [filterType, filterValue] = filter;
    if (filterType === 'cuisine' || filterType === 'flavor' || filterType === 'season') {
      browseMode = filterType;
      activeCategory = decodeURIComponent(filterValue);
    }
  }

  return <SaladApp initialBrowseMode={browseMode} initialCategory={activeCategory} />;
}
