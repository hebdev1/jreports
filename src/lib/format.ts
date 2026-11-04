/** `$12,000` — whole dollars when the cents are zero, otherwise two decimals. */
export function money(cents: number): string {
  const dollars = cents / 100;
  return '$' + dollars.toLocaleString('en-US', Number.isInteger(dollars) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 3492 → `58:12`; 4000 → `1:06:40`. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** `2026-09-18` → `Sep 18, 2026`, read as a calendar date (no timezone shift). */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function longDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Amount the donor pays when covering the 3% processing fee (design rule). */
export function withFees(cents: number, coverFees: boolean): number {
  return coverFees ? Math.round(cents * 1.03) : cents;
}

/** "(732) 822-3518" → "tel:+17328223518". */
export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  return `tel:${digits.length === 10 ? `+1${digits}` : digits}`;
}

/** Splits "FowenNurses" / "Nurses" into the navy and red parts of the wordmark. */
export function splitAccent(name: string, accent: string): [string, string] {
  return accent && name.endsWith(accent) && accent !== name ? [name.slice(0, -accent.length), accent] : [name, ''];
}

/** "YouTube · @JamesReports" from https://www.youtube.com/@JamesReports. */
export function withHandle(network: string, url: string): string {
  const m = /^https:\/\/[^/]+\/(@?[A-Za-z0-9_.-]+)\/?$/.exec(url);
  return m ? `${network} · ${m[1].startsWith('@') ? m[1] : `@${m[1]}`}` : network;
}
