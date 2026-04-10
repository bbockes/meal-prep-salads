import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import SaladBrowsePage from '@/components/SaladBrowsePage';
import { FLAT_PREFIX_TO_BROWSE } from '@/data/salad-routes';
import { buildSaladIndexMetadata, neutralSaladIndexPath } from '@/lib/seo/salad-seo';

function parsePinnedRecipeId(sp: { r?: string | string[] } | undefined): number | null {
  if (!sp) return null;
  const raw = sp.r;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s == null || s === '') return null;
  const n = parseInt(String(s), 10);
  return Number.isFinite(n) ? n : null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ r?: string | string[]; diet?: string | string[] }>;
}

export function generateStaticParams() {
  return Object.keys(FLAT_PREFIX_TO_BROWSE).map((prefix) => ({
    slug: `${prefix}-salads`,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!slug.endsWith('-salads')) return {};
  const prefix = slug.replace(/-salads$/, '');
  const match = FLAT_PREFIX_TO_BROWSE[prefix];
  if (!match) return {};
  return buildSaladIndexMetadata(match.mode, match.category);
}

export default async function SlugPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const initialPinnedRecipeId = parsePinnedRecipeId(sp);

  if (!slug.endsWith('-salads')) {
    notFound();
  }

  const prefix = slug.replace(/-salads$/, '');

  if (prefix === 'high-protein') {
    redirect('/salads');
  }

  const match = FLAT_PREFIX_TO_BROWSE[prefix];

  if (!match) {
    notFound();
  }

  if (match.dietScope) {
    const target = neutralSaladIndexPath(match.mode, match.category);
    const qs = new URLSearchParams();
    if (initialPinnedRecipeId != null) qs.set('r', String(initialPinnedRecipeId));
    redirect(qs.size ? `${target}?${qs}` : target);
  }

  return (
    <SaladBrowsePage
      browseMode={match.mode}
      activeCategory={match.category}
      initialPinnedRecipeId={initialPinnedRecipeId}
    />
  );
}
