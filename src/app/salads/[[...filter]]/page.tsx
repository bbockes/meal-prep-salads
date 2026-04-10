import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SaladBrowsePage from '@/components/SaladBrowsePage';
import { allNestedSaladFilterParams } from '@/data/salad-routes';
import {
  buildSaladIndexMetadata,
  dietQueryParamToScope,
  neutralSaladIndexPath,
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
  return [{ filter: [] }, ...allNestedSaladFilterParams()];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { filter } = await params;
  const parsed = parseSaladsCatchAllFilter(filter);
  return buildSaladIndexMetadata(parsed.browseMode, parsed.activeCategory);
}

export default async function SaladsPage({ params, searchParams }: PageProps) {
  const { filter } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const initialPinnedRecipeId = parsePinnedRecipeId(sp);
  const parsed = parseSaladsCatchAllFilter(filter);
  const dietFromQuery = dietQueryParamToScope(sp?.diet);
  const dietScope = parsed.dietScope ?? dietFromQuery;
  if (dietScope) {
    const target = neutralSaladIndexPath(parsed.browseMode, parsed.activeCategory);
    const qs = new URLSearchParams();
    if (initialPinnedRecipeId != null) qs.set('r', String(initialPinnedRecipeId));
    redirect(qs.size ? `${target}?${qs}` : target);
  }

  return (
    <SaladBrowsePage
      browseMode={parsed.browseMode}
      activeCategory={parsed.activeCategory}
      initialPinnedRecipeId={initialPinnedRecipeId}
    />
  );
}
