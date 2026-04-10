import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SaladBrowsePage from '@/components/SaladBrowsePage';
import { SALADS_BY_FLAVOR_PATH } from '@/data/salad-routes';
import { buildSaladIndexMetadata, dietQueryParamToScope } from '@/lib/seo/salad-seo';

function parsePinnedRecipeId(sp: { r?: string | string[] } | undefined): number | null {
  if (!sp) return null;
  const raw = sp.r;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || s === '') return null;
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) ? n : null;
}

interface PageProps {
  searchParams?: Promise<{ r?: string | string[]; diet?: string | string[] }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return buildSaladIndexMetadata('flavor', 'All');
}

export default async function SaladsByFlavorPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : undefined;
  const initialPinnedRecipeId = parsePinnedRecipeId(sp);
  const dietFromQuery = dietQueryParamToScope(sp?.diet);
  if (dietFromQuery) {
    const qs = new URLSearchParams();
    if (initialPinnedRecipeId != null) qs.set('r', String(initialPinnedRecipeId));
    redirect(qs.size ? `${SALADS_BY_FLAVOR_PATH}?${qs}` : SALADS_BY_FLAVOR_PATH);
  }

  return (
    <SaladBrowsePage
      browseMode="flavor"
      activeCategory="All"
      initialPinnedRecipeId={initialPinnedRecipeId}
    />
  );
}
