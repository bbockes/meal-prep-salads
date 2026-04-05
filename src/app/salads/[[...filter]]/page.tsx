import type { Metadata } from 'next';
import SaladBrowsePage from '@/components/SaladBrowsePage';
import { allNestedSaladFilterParams } from '@/data/salad-routes';
import {
  buildSaladIndexMetadata,
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
  searchParams?: Promise<{ r?: string | string[] }>;
}

export async function generateStaticParams() {
  return [
    { filter: [] },
    { filter: ['flavor'] },
    { filter: ['season'] },
    ...allNestedSaladFilterParams(),
  ];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { filter } = await params;
  const { browseMode, activeCategory } = parseSaladsCatchAllFilter(filter);
  return buildSaladIndexMetadata(browseMode, activeCategory);
}

export default async function SaladsPage({ params, searchParams }: PageProps) {
  const { filter } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const initialPinnedRecipeId = parsePinnedRecipeId(sp);
  const { browseMode, activeCategory } = parseSaladsCatchAllFilter(filter);

  return (
    <SaladBrowsePage
      browseMode={browseMode}
      activeCategory={activeCategory}
      initialPinnedRecipeId={initialPinnedRecipeId}
    />
  );
}
