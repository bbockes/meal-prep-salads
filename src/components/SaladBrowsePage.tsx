import SaladApp from '@/components/SaladApp';
import SeoJsonLd from '@/components/SeoJsonLd';
import type { SaladBrowseMode } from '@/data/salad-routes';
import { absoluteUrl } from '@/lib/seo/site';
import {
  buildBreadcrumbJsonLd,
  buildRecipeJsonLd,
  canonicalPathForSaladIndex,
  defaultRecipeForSeoJsonLd,
  getSaladPageSeoCopy,
} from '@/lib/seo/salad-seo';

type SaladBrowsePageProps = {
  browseMode: SaladBrowseMode;
  activeCategory: string;
  initialDietScope: string | null;
  canonicalDietNested?: boolean;
  initialPinnedRecipeId?: number | null;
};

export default function SaladBrowsePage({
  browseMode,
  activeCategory,
  initialDietScope,
  canonicalDietNested = false,
  initialPinnedRecipeId = null,
}: SaladBrowsePageProps) {
  const copy = getSaladPageSeoCopy(browseMode, activeCategory, initialDietScope);
  const canonicalPath = canonicalPathForSaladIndex(browseMode, activeCategory, initialDietScope, {
    canonicalDietNested,
  });
  const pageUrl = absoluteUrl(canonicalPath);
  const recipe = defaultRecipeForSeoJsonLd(
    browseMode,
    activeCategory,
    initialDietScope,
    initialPinnedRecipeId
  );

  const jsonLd: object[] = [
    buildBreadcrumbJsonLd({
      browseMode,
      activeCategory,
      dietScope: initialDietScope,
      canonicalPath,
    }),
  ];
  if (recipe) jsonLd.push(buildRecipeJsonLd(recipe, pageUrl));

  return (
    <>
      <SeoJsonLd data={jsonLd} />
      <SaladApp
        initialBrowseMode={browseMode}
        initialCategory={activeCategory}
        initialDietScope={initialDietScope}
        initialPinnedRecipeId={initialPinnedRecipeId}
        pageHeading={copy.h1}
      />
    </>
  );
}
