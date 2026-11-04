import { PostgrestClient } from '@supabase/postgrest-js';
import { EPISODE_COLUMNS, MEDIA_COLUMNS, mapEpisode, mapReportArticle, REPORT_COLUMNS, toApiError, type EpisodeRow, type ReportRow } from './api';
import type { Episode, PublicMedia, ReportArticle } from './types';

// Draft previews for the team. The admin lives on the same origin and keeps
// its Supabase session under this key; a preview reads that session token and
// queries as the signed-in team member, so row-level security decides what
// can be seen. Visitors have no token and get "sign in" instead.
export const ADMIN_AUTH_KEY = 'jr-admin-auth';

export function readAdminToken(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(ADMIN_AUTH_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as { access_token?: unknown; expires_at?: unknown };
    if (typeof s.access_token !== 'string') return null;
    if (typeof s.expires_at === 'number' && s.expires_at * 1000 <= now) return null;
    return s.access_token;
  } catch {
    return null;
  }
}

type Publication = 'draft' | 'published' | 'archived';

export type Preview<T> = { status: 'ok'; item: T; publication: Publication; hasChanges: boolean } | { status: 'signed_out' } | { status: 'not_found' };
export type EpisodePreview = Preview<Episode>;
export type ReportPreview = Preview<ReportArticle>;

/** Media fields a draft may point at, and the embed each one fills. */
const MEDIA_FIELDS = [
  ['image_id', 'image'],
  ['video_id', 'video'],
] as const;

/**
 * Loads one item as the signed-in team member, with any pending draft
 * applied on top, so the preview shows what publishing would show.
 */
async function loadPreview<R extends { image?: PublicMedia | null; video?: PublicMedia | null }>(entity: 'episodes' | 'reports', columns: string, id: string): Promise<{ row: R; publication: Publication; hasChanges: boolean } | 'signed_out' | 'not_found'> {
  const token = readAdminToken();
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!token || !url || !key) return 'signed_out';
  const pg = new PostgrestClient(`${url.replace(/\/$/, '')}/rest/v1`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  const signal = AbortSignal.timeout(15_000);

  const [row, draft] = await Promise.all([
    pg.from(entity).select(`${columns}, status`).eq('id', id).abortSignal(signal).maybeSingle(),
    pg.from('content_drafts').select('data').eq('entity', entity).eq('entity_id', id).abortSignal(signal).maybeSingle(),
  ]);
  for (const r of [row, draft]) {
    if (r.error) {
      if (r.status === 401 || /jwt/i.test(r.error.message)) return 'signed_out';
      throw toApiError(r.error);
    }
  }
  if (!row.data) return 'not_found';

  const base = row.data as unknown as R & { status: Publication; image_id?: string };
  const changes = (draft.data?.data ?? null) as Record<string, unknown> | null;
  let merged = base as R & Record<string, unknown>;
  if (changes) {
    merged = { ...base, ...changes } as R & Record<string, unknown>;
    for (const [field, embed] of MEDIA_FIELDS) {
      if (!(field in changes)) continue;
      const next = changes[field] as string | null;
      if (next === ((base[embed] as PublicMedia | null | undefined)?.id ?? null)) continue;
      (merged as Record<string, unknown>)[embed] = null;
      if (next) {
        const m = await pg.from('media_assets').select(MEDIA_COLUMNS).eq('id', next).abortSignal(signal).maybeSingle();
        if (m.error) throw toApiError(m.error);
        (merged as Record<string, unknown>)[embed] = (m.data as unknown as PublicMedia | null) ?? null;
      }
    }
  }
  return { row: merged, publication: base.status, hasChanges: Boolean(changes) };
}

/** The episode as it will look once published: the saved row with any pending draft applied. */
export async function fetchEpisodePreview(id: string): Promise<EpisodePreview> {
  const r = await loadPreview<EpisodeRow>('episodes', EPISODE_COLUMNS, id);
  if (typeof r === 'string') return { status: r };
  return { status: 'ok', item: mapEpisode(r.row), publication: r.publication, hasChanges: r.hasChanges };
}

/** The report article as it will look once published. */
export async function fetchReportPreview(id: string): Promise<ReportPreview> {
  const r = await loadPreview<ReportRow>('reports', `${REPORT_COLUMNS}, body, seo_title, seo_description`, id);
  if (typeof r === 'string') return { status: r };
  return { status: 'ok', item: mapReportArticle(r.row), publication: r.publication, hasChanges: r.hasChanges };
}
