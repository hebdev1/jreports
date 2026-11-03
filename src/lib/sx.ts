import type { CSSProperties } from 'react';

const cache = new Map<string, CSSProperties>();

/**
 * Turns a CSS declaration string, written exactly as in the design file
 * (`"padding:14px 16px;border-radius:999px"`), into a React style object.
 * Keeping the design's declarations verbatim makes every section easy to
 * diff against `design-source/James Reports.dc.html`. Results are cached, so
 * the same string always returns the same (frozen) object.
 */
export function sx(css: string): CSSProperties {
  const hit = cache.get(css);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 1) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    const key = prop.startsWith('--') ? prop : prop.replace(/^-/, '').replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[prop.startsWith('-webkit-') ? key.charAt(0).toUpperCase() + key.slice(1) : key] = value;
  }
  const style = Object.freeze(out) as CSSProperties;
  cache.set(css, style);
  return style;
}

/** `sx(base)` merged with per-render overrides (dynamic colours, widths…). */
export function sxm(css: string, extra: CSSProperties): CSSProperties {
  return { ...sx(css), ...extra };
}
