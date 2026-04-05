import type { MetadataRoute } from 'next';
import { allPublicSaladPaths } from '@/lib/seo/salad-seo';
import { getSiteBaseUrl } from '@/lib/seo/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteBaseUrl();
  return allPublicSaladPaths().map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: path === '/salads' ? 1 : 0.8,
  }));
}
