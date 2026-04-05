import { NextResponse } from 'next/server';
import { allRecipesAsCanonical } from '@/data/canonical-recipe-mapper';

/**
 * Machine-readable recipe export (canonical JSON model).
 * Does not replace {@link RECIPES}; UI behavior is unchanged.
 */
export async function GET() {
  return NextResponse.json(allRecipesAsCanonical(), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
