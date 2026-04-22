import CategoryBrowseScaffold from '@/components/CategoryBrowseScaffold';

export default function ProteinPage() {
  return (
    <CategoryBrowseScaffold
      pageHeading="Protein"
      browseModes={['cuisine', 'flavor', 'season']}
      categoriesByMode={{
        cuisine: ['All', 'American', 'Mexican', 'Italian', 'Japanese', 'Korean', 'Thai', 'Indian', 'Middle Eastern'],
        flavor: ['All', 'Smoky', 'Spicy', 'Herby', 'Citrusy', 'Sweet-savory', 'Garlicky', 'Umami'],
        season: ['All', 'Spring', 'Summer', 'Fall', 'Winter', 'Year-round'],
      }}
      initialBrowseMode="cuisine"
      initialCategory="All"
    />
  );
}

