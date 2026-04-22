'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type CategoryKey = 'salads' | 'protein' | 'smoothies' | 'snacks';

function categoryFromPath(pathname: string | null): CategoryKey {
  const p = String(pathname || '').toLowerCase();
  if (p.startsWith('/protein')) return 'protein';
  if (p.startsWith('/smoothies')) return 'smoothies';
  if (p.startsWith('/snacks')) return 'snacks';
  return 'salads';
}

const CATEGORIES: Array<{ key: CategoryKey; label: string; href: string }> = [
  { key: 'salads', label: 'Salads', href: '/salads' },
  { key: 'protein', label: 'Protein', href: '/protein' },
  { key: 'smoothies', label: 'Smoothies', href: '/smoothies' },
  { key: 'snacks', label: 'Snacks', href: '/snacks' },
];

export default function SiteHeader({ pageHeading }: { pageHeading?: string }) {
  const pathname = usePathname();
  const selected = useMemo(() => categoryFromPath(pathname), [pathname]);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close on route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes the left menu.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [menuOpen]);

  return (
    <>
      <header className="site-header">
        <div className="site-header-row">
          <button
            type="button"
            className="site-menu-btn"
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen ? 'true' : 'false'}
            onClick={() => setMenuOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>

          <Link href="/salads" className="site-brand">
            Ease
          </Link>
        </div>

        {pageHeading ? (
          <h1 id="page-seo-heading" className="page-seo-heading">
            {pageHeading}
          </h1>
        ) : null}
      </header>

      {menuOpen ? (
        <div
          className="site-drawer-overlay"
          role="dialog"
          aria-label="Site menu"
          onClick={() => setMenuOpen(false)}
        >
          <aside className="site-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="site-drawer-header">
              <div className="site-drawer-title">Browse</div>
              <button
                type="button"
                className="site-drawer-close"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <nav className="site-drawer-nav" aria-label="Categories">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.key}
                  href={c.href}
                  className={`site-drawer-link${selected === c.key ? ' is-active' : ''}`}
                  aria-current={selected === c.key ? 'page' : undefined}
                >
                  {c.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}

