import { useEffect } from 'react';
import { useLocation } from 'wouter';

const SITE = 'WRLD.domains';
const ORIGIN = 'https://wrld.domains';

interface Options {
  /** Set false on pages that should not declare a canonical (404). Default true. */
  canonical?: boolean;
}

/**
 * Per-route document metadata. Sets the title as "<page> — WRLD.domains" (or
 * the site default when empty) and points `<link rel="canonical">` at the
 * current route, since the SPA shell in index.html is served for every path.
 */
export function usePageTitle(page?: string, { canonical = true }: Options = {}): void {
  const [location] = useLocation();

  useEffect(() => {
    document.title = page ? `${page} — ${SITE}` : `${SITE} — Domain search and registration on WRLD.host`;
  }, [page]);

  useEffect(() => {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      link?.remove();
      return;
    }
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    const path = location === '/' ? '/' : location.replace(/\/+$/, '');
    link.href = `${ORIGIN}${path}`;
  }, [location, canonical]);
}
