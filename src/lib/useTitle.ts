import { useEffect } from 'react';
import { useConfig } from './content';

/**
 * Sets the document title and meta description for the current page
 * (`null` = the home page). Defaults come from Site → Brand & SEO in the admin.
 */
export function useTitle(page: string | null, description?: string) {
  const { cfg } = useConfig();
  const { siteName } = cfg.brand;
  const { defaultTitle, defaultDescription } = cfg.seo;
  useEffect(() => {
    document.title = page ? `${page} · ${siteName}` : defaultTitle;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description || defaultDescription);
  }, [page, description, siteName, defaultTitle, defaultDescription]);
}
