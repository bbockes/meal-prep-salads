/** Public site origin for canonical URLs, Open Graph, and JSON-LD (no trailing slash). */
export function getSiteBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

export function absoluteUrl(path: string): string {
  const base = getSiteBaseUrl();
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
