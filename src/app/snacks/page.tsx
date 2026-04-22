import CategoryBrowseScaffold from '@/components/CategoryBrowseScaffold';

export default function SnacksPage() {
  return (
    <CategoryBrowseScaffold
      pageHeading="Snacks"
      browseModes={['type', 'flavor', 'season']}
      categoriesByMode={{
        type: ['All', 'Crunchy', 'Dips', 'Sweet', 'Savory', 'High-protein', 'No-cook'],
        flavor: ['All', 'Spicy', 'Smoky', 'Cheesy', 'Herby', 'Sweet', 'Tangy'],
        season: ['All', 'Spring', 'Summer', 'Fall', 'Winter', 'Year-round'],
      }}
      initialBrowseMode="type"
      initialCategory="All"
    />
  );
}

