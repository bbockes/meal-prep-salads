import CategoryBrowseScaffold from '@/components/CategoryBrowseScaffold';

export default function SmoothiesPage() {
  return (
    <CategoryBrowseScaffold
      pageHeading="Smoothies"
      browseModes={['flavor', 'season', 'cuisine']}
      categoriesByMode={{
        flavor: ['All', 'Berry', 'Tropical', 'Chocolate', 'Green', 'Citrus', 'Vanilla', 'Coffee'],
        season: ['All', 'Spring', 'Summer', 'Fall', 'Winter', 'Year-round'],
        cuisine: ['All', 'American', 'Mexican', 'Indian', 'Thai', 'Middle Eastern'],
      }}
      initialBrowseMode="flavor"
      initialCategory="All"
    />
  );
}

