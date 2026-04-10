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
  initialPinnedRecipeId?: number | null;
};

export default function SaladBrowsePage({
  browseMode,
  activeCategory,
  initialPinnedRecipeId = null,
}: SaladBrowsePageProps) {
  const copy = getSaladPageSeoCopy(browseMode, activeCategory);
  const canonicalPath = canonicalPathForSaladIndex(browseMode, activeCategory, null);
  const pageUrl = absoluteUrl(canonicalPath);
  const recipe = defaultRecipeForSeoJsonLd(browseMode, activeCategory, initialPinnedRecipeId);

  const jsonLd: object[] = [
    buildBreadcrumbJsonLd({
      browseMode,
      activeCategory,
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
        initialPinnedRecipeId={initialPinnedRecipeId}
        pageHeading={copy.h1}
      />
    </>
  );
}
