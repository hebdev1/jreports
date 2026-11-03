import { useEffect } from 'react';

const SITE = 'James Reports with James Pierre';

/** Sets the document title for the current page (`null` = the site name alone). */
export function useTitle(page: string | null) {
  useEffect(() => {
    document.title = page ? `${page} · James Reports` : SITE;
  }, [page]);
}
