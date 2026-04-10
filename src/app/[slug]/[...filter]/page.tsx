import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SaladBrowsePage from '@/components/SaladBrowsePage';
import {
  FLAT_PREFIX_TO_BROWSE,
  allDietPrefixedCatchAllParams,
  flatSlugToPrefix,
  parseDietPrefixedSegments,
} from '@/data/salad-routes';
import { buildSaladIndexMetadata } from '@/lib/seo/salad-seo';

function parsePinnedRecipeId(sp: { r?: string | string[] } | undefined): number | null {
  if (!sp) return null;
  const raw = sp.r;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || s === '') return null;
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) ? n : null;
}

interface PageProps {
  params: Promise<{ slug: string; filter: string[] }>;
  searchParams?: Promise<{ r?: string | string[] }>;
}

export function generateStaticParams() {
  return allDietPrefixedCatchAllParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, filter } = await params;
  if (!slug.endsWith('-salads')) return {};
  const prefix = flatSlugToPrefix(slug);
  if (!prefix) return {};
  const base = FLAT_PREFIX_TO_BROWSE[prefix];
  if (!base?.dietScope) return {};
  const parsed = parseDietPrefixedSegments(filter ?? []);
  if (!parsed) return {};
  return buildSaladIndexMetadata(parsed.browseMode, parsed.activeCategory, {
    dietScope: base.dietScope,
    canonicalDietNested: false,
  });
}

export default async function SlugFilterPage({ params, searchParams }: PageProps) {
  const { slug, filter } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const initialPinnedRecipeId = parsePinnedRecipeId(sp);

  if (!slug.endsWith('-salads')) {
    notFound();
  }

  const prefix = flatSlugToPrefix(slug);
  if (!prefix) notFound();

  const base = FLAT_PREFIX_TO_BROWSE[prefix];
  if (!base?.dietScope) {
    notFound();
  }

  const parsed = parseDietPrefixedSegments(filter ?? []);
  if (!parsed) {
    notFound();
  }

  return (
    <SaladBrowsePage
      browseMode={parsed.browseMode}
      activeCategory={parsed.activeCategory}
      initialDietScope={base.dietScope}
      initialPinnedRecipeId={initialPinnedRecipeId}
    />
  );
}
