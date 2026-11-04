import { PostgrestClient } from '@supabase/postgrest-js';
import { EPISODE_COLUMNS, MEDIA_COLUMNS, mapEpisode, toApiError, type EpisodeRow } from './api';
import type { Episode, PublicMedia } from './types';

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

export type EpisodePreview =
  | { status: 'ok'; episode: Episode; publication: 'draft' | 'published' | 'archived'; hasChanges: boolean }
  | { status: 'signed_out' }
  | { status: 'not_found' };

/** The episode as it will look once published: the saved row with any pending draft applied. */
export async function fetchEpisodePreview(id: string): Promise<EpisodePreview> {
  const token = readAdminToken();
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!token || !url || !key) return { status: 'signed_out' };
  const pg = new PostgrestClient(`${url.replace(/\/$/, '')}/rest/v1`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  const signal = AbortSignal.timeout(15_000);

  const [row, draft] = await Promise.all([
    pg.from('episodes').select(`${EPISODE_COLUMNS}, status`).eq('id', id).abortSignal(signal).maybeSingle(),
    pg.from('content_drafts').select('data').eq('entity', 'episodes').eq('entity_id', id).abortSignal(signal).maybeSingle(),
  ]);
  for (const r of [row, draft]) {
    if (r.error) {
      if (r.status === 401 || /jwt/i.test(r.error.message)) return { status: 'signed_out' };
      throw toApiError(r.error);
    }
  }
  if (!row.data) return { status: 'not_found' };

  const base = row.data as unknown as EpisodeRow & { status: 'draft' | 'published' | 'archived'; image: PublicMedia | null };
  const changes = (draft.data?.data ?? null) as (Partial<EpisodeRow> & { image_id?: string | null }) | null;
  let merged: EpisodeRow = base;
  if (changes) {
    const { image_id, ...fields } = changes;
    merged = { ...base, ...fields };
    if (image_id !== undefined && image_id !== (base.image?.id ?? null)) {
      merged.image = null;
      if (image_id) {
        const m = await pg.from('media_assets').select(MEDIA_COLUMNS).eq('id', image_id).abortSignal(signal).maybeSingle();
        if (m.error) throw toApiError(m.error);
        merged.image = (m.data as unknown as PublicMedia | null) ?? null;
      }
    }
  }
  return { status: 'ok', episode: mapEpisode(merged), publication: base.status, hasChanges: Boolean(changes) };
}
