'use client';

import { useEffect, useMemo, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';

type BrowseMode = string;

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CategoryBrowseScaffold(props: {
  pageHeading: string;
  /** The set of top-level "Browse by" modes (e.g. cuisine/flavor/season). */
  browseModes: BrowseMode[];
  /** Categories shown in the nav strip for each mode. */
  categoriesByMode: Record<BrowseMode, string[]>;
  /** Initial selected mode. */
  initialBrowseMode: BrowseMode;
  /** Initial selected category (must exist in that mode). */
  initialCategory: string;
}) {
  const { pageHeading, browseModes, categoriesByMode, initialBrowseMode, initialCategory } = props;

  const safeInitialMode = browseModes.includes(initialBrowseMode) ? initialBrowseMode : browseModes[0];
  const initialCats = categoriesByMode[safeInitialMode] || [];
  const safeInitialCategory = initialCats.includes(initialCategory)
    ? initialCategory
    : initialCats[0] || 'All';

  const [browseMode, setBrowseMode] = useState<BrowseMode>(safeInitialMode);
  const [activeCategory, setActiveCategory] = useState<string>(safeInitialCategory);
  const [prepMode, setPrepMode] = useState(false);

  const navTabs = useMemo(() => categoriesByMode[browseMode] || [], [browseMode, categoriesByMode]);

  // When switching modes, snap to the first category in that mode (if current isn't valid).
  useEffect(() => {
    if (!navTabs.length) return;
    if (!navTabs.includes(activeCategory)) setActiveCategory(navTabs[0]);
  }, [navTabs, activeCategory]);

  return (
    <>
      <SiteHeader pageHeading={pageHeading} />

      <div className="browse-mode" id="browseModeBar">
        <span className="browse-mode-label">Browse by</span>
        <div className="browse-mode-toggle" role="group" aria-label="Browse recipes by">
          {browseModes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={browseMode === mode ? 'active' : ''}
              onClick={() => setBrowseMode(mode)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
                e.preventDefault();
                const idx = browseModes.indexOf(browseMode);
                const nextIdx =
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? browseModes.length - 1
                      : e.key === 'ArrowLeft'
                        ? (idx + browseModes.length - 1) % browseModes.length
                        : (idx + 1) % browseModes.length;
                const nextMode = browseModes[nextIdx];
                if (nextMode) setBrowseMode(nextMode);
                const btns = (e.currentTarget.parentElement?.querySelectorAll('button') || []) as unknown as HTMLButtonElement[];
                if (btns && btns[nextIdx]) btns[nextIdx].focus();
              }}
              aria-current={browseMode === mode ? 'true' : undefined}
            >
              {titleCase(mode)}
            </button>
          ))}
        </div>

        <div className="browse-mode-tail">
          <span className="browse-mode-spacer" aria-hidden="true" />
          <button
            type="button"
            className={`meal-prep-mode-btn${prepMode ? ' active' : ''}`}
            aria-pressed={prepMode ? 'true' : 'false'}
            onClick={() => setPrepMode((p) => !p)}
            title="Coming soon for this section"
          >
            Prep mode
          </button>
        </div>
      </div>

      <nav>
        {navTabs.map((cat, i) => (
          <button
            key={cat}
            type="button"
            className={cat === activeCategory ? 'active' : ''}
            onClick={() => setActiveCategory(cat)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
              e.preventDefault();
              const nextIdx =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? navTabs.length - 1
                    : e.key === 'ArrowLeft'
                      ? (i + navTabs.length - 1) % navTabs.length
                      : (i + 1) % navTabs.length;
              const nextCat = navTabs[nextIdx];
              if (nextCat) setActiveCategory(nextCat);
              const btns = (e.currentTarget.parentElement?.querySelectorAll('button') || []) as unknown as HTMLButtonElement[];
              if (btns && btns[nextIdx]) btns[nextIdx].focus();
            }}
            aria-current={cat === activeCategory ? 'page' : undefined}
          >
            {cat}
          </button>
        ))}
      </nav>

      <main style={{ padding: '18px 48px 40px' }}>
        <div style={{ maxWidth: 900 }}>
          <div style={{ color: 'var(--muted)', marginBottom: 10 }}>
            Showing <strong>{pageHeading}</strong> by <strong>{browseMode}</strong> → <strong>{activeCategory}</strong>
            {prepMode ? ' (Prep mode on)' : ''}
          </div>
          <div style={{ color: 'var(--muted)' }}>This section is scaffolded; content wiring is next.</div>
        </div>
      </main>
    </>
  );
}

