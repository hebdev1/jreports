/** "58:12" / "1:06:40" → seconds; NaN when malformed. */
export function parseClock(v: string): number {
  const parts = v.trim().split(':').map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) return NaN;
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  if (m > 59 && parts.length === 3) return NaN;
  if (s > 59) return NaN;
  return h * 3600 + m * 60 + s;
}

export function toClock(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Accepts a YouTube watch/short/live/youtu.be link or a bare 11-character id. */
export function youtubeId(v: string): string | null {
  const t = v.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t);
    const host = u.hostname.replace(/^(www\.|m\.)/, '');
    if (host === 'youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v2 = u.searchParams.get('v');
      if (v2 && /^[A-Za-z0-9_-]{11}$/.test(v2)) return v2;
      const m = /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/.exec(u.pathname);
      return m ? m[1] : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Accepts a YouTube playlist link or a bare playlist id. */
export function playlistId(v: string): string | null {
  const t = v.trim();
  if (/^[A-Za-z0-9_-]{10,64}$/.test(t)) return t;
  try {
    const list = new URL(t).searchParams.get('list');
    return list && /^[A-Za-z0-9_-]{10,64}$/.test(list) ? list : null;
  } catch {
    return null;
  }
}

export function slugify(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

export const isHttps = (v: string) => /^https:\/\/[^\s]+$/.test(v.trim());
