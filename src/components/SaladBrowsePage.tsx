import SaladApp from '@/components/SaladApp';
import SeoJsonLd from '@/components/SeoJsonLd';
import { DIET_KEYS } from '@/data/diet-config';
import type { SaladBrowseMode } from '@/data/salad-routes';
import { absoluteUrl } from '@/lib/seo/site';
import {
  buildBreadcrumbJsonLd,
  buildRecipeJsonLd,
  canonicalPathForBrowse,
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
  const seoCategory =
    browseMode === 'diet' && activeCategory === 'All' ? DIET_KEYS[0] : activeCategory;
  const copy = getSaladPageSeoCopy(browseMode, seoCategory);
  const canonicalPath = canonicalPathForBrowse(browseMode, activeCategory);
  const pageUrl = absoluteUrl(canonicalPath);
  const recipe = defaultRecipeForSeoJsonLd(browseMode, activeCategory, initialPinnedRecipeId);

  const jsonLd: object[] = [
    buildBreadcrumbJsonLd({
      browseMode,
      activeCategory: seoCategory,
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
