import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SaladBrowsePage from '@/components/SaladBrowsePage';
import { allNestedSaladFilterParams, dietPrefixedBrowsePath } from '@/data/salad-routes';
import {
  buildSaladIndexMetadata,
  dietQueryParamToScope,
  parseSaladsCatchAllFilter,
} from '@/lib/seo/salad-seo';

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
  searchParams?: Promise<{ r?: string | string[]; diet?: string | string[] }>;
}

export async function generateStaticParams() {
  return [
    { filter: [] },
    { filter: ['flavor'] },
    { filter: ['season'] },
    ...allNestedSaladFilterParams(),
  ];
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { filter } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const parsed = parseSaladsCatchAllFilter(filter);
  const dietFromQuery = dietQueryParamToScope(sp?.diet);
  const dietScope = parsed.dietScope ?? dietFromQuery;
  return buildSaladIndexMetadata(parsed.browseMode, parsed.activeCategory, {
    dietScope,
    canonicalDietNested: parsed.canonicalDietNested,
  });
}

export default async function SaladsPage({ params, searchParams }: PageProps) {
  const { filter } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const initialPinnedRecipeId = parsePinnedRecipeId(sp);
  const parsed = parseSaladsCatchAllFilter(filter);
  const dietFromQuery = dietQueryParamToScope(sp?.diet);
  if (dietFromQuery && !parsed.dietScope) {
    const target = dietPrefixedBrowsePath(
      parsed.browseMode,
      parsed.activeCategory,
      dietFromQuery
    );
    if (target) {
      const qs = new URLSearchParams();
      if (initialPinnedRecipeId != null) qs.set('r', String(initialPinnedRecipeId));
      const q = qs.toString();
      redirect(q ? `${target}?${q}` : target);
    }
  }
  const dietScope = parsed.dietScope ?? dietFromQuery;

  return (
    <SaladBrowsePage
      browseMode={parsed.browseMode}
      activeCategory={parsed.activeCategory}
      initialDietScope={dietScope}
      canonicalDietNested={parsed.canonicalDietNested}
      initialPinnedRecipeId={initialPinnedRecipeId}
    />
  );
}
