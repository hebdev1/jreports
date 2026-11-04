import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mergeConfig, type ConfigKey, type SiteConfig } from '@/lib/siteConfig';
import { AdminError, must, toAdminError } from './errors';
import { publicMediaUrl, sb, SUPABASE_URL } from './supabase';

export type ContentEntity = 'episodes' | 'reports' | 'archive_items' | 'sponsors';
export type ContentStatus = 'draft' | 'published' | 'archived';

// ------------------------------------------------------------------ config

export interface ConfigRow {
  key: ConfigKey;
  value: Record<string, unknown>;
  version: number;
  updated_at: string;
}

export function useSiteConfig() {
  return useQuery({
    queryKey: ['site_config'],
    queryFn: async () => {
      const rows = must(await sb.from('site_config').select('key, value, version, updated_at')) as ConfigRow[];
      const byKey = Object.fromEntries(rows.map((r) => [r.key, r])) as Partial<Record<ConfigKey, ConfigRow>>;
      return { rows: byKey, config: mergeConfig(rows) };
    },
  });
}

/** Saves one settings group, refusing if someone else saved it since it was loaded. */
export function useSaveConfig<K extends ConfigKey>(key: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ value, version }: { value: SiteConfig[K]; version: number }) => {
      const rows = must(await sb.from('site_config').update({ value }).eq('key', key).eq('version', version).select('version'));
      if (!rows || rows.length === 0) {
        const current = must(await sb.from('site_config').select('version').eq('key', key)) as Array<{ version: number }>;
        if (current.length && current[0].version !== version)
          throw new AdminError('conflict', 'Someone else saved these settings since you opened them. Reload to see their version, then make your change again.');
        throw new AdminError('forbidden', 'You don’t have permission to change site settings.');
      }
      return rows[0].version as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['site_config'] }),
  });
}

// --------------------------------------------------------------- dashboard

export interface Dashboard {
  period: { booking: number; guest: number; pledges: number; pledged_cents: number; newsletter: number; releases: number | null };
  pending: { booking_new: number; guest_new: number; pledges_unpaid: number; drafts_pending: number };
  content: Record<ContentEntity, { published: number; draft: number; archived: number }>;
  subscribers: number;
  episodes_without_media: number;
  media: number;
}

export function useDashboard(from: Date, to: Date) {
  return useQuery({
    queryKey: ['dashboard', from.toISOString(), to.toISOString()],
    queryFn: async () => must(await sb.rpc('admin_dashboard', { p_from: from.toISOString(), p_to: to.toISOString() })) as Dashboard,
  });
}

// ------------------------------------------------------------------- lists

export interface ListParams {
  table: string;
  select: string;
  page: number;
  pageSize: number;
  search?: string;
  searchColumns?: string[];
  filters?: Record<string, string | undefined>;
  sort: { column: string; ascending: boolean };
}

/** Escapes a value for a PostgREST or() / ilike filter. */
export function pgrstLike(s: string): string {
  return `%${s.replace(/[%_,()*\\]/g, (c) => `\\${c}`)}%`;
}

export async function fetchList<T>(p: ListParams): Promise<{ rows: T[]; count: number }> {
  let q = sb.from(p.table).select(p.select, { count: 'exact' });
  for (const [k, v] of Object.entries(p.filters ?? {})) if (v) q = q.eq(k, v);
  const term = p.search?.trim();
  if (term && p.searchColumns?.length) q = q.or(p.searchColumns.map((c) => `${c}.ilike.${pgrstLike(term)}`).join(','));
  q = q.order(p.sort.column, { ascending: p.sort.ascending, nullsFirst: false });
  const from = (p.page - 1) * p.pageSize;
  const { data, error, count } = await q.range(from, from + p.pageSize - 1);
  if (error) throw toAdminError(error);
  return { rows: (data ?? []) as T[], count: count ?? 0 };
}

export function useList<T>(p: ListParams) {
  return useQuery({
    queryKey: ['list', p],
    queryFn: () => fetchList<T>(p),
    placeholderData: (prev) => prev,
  });
}

// ------------------------------------------------------------------- media

export interface MediaAsset {
  id: string;
  source: 'storage' | 'bundled';
  path: string;
  url: string;
  file_name: string;
  alt: string;
  mime_type: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export const MEDIA_SELECT = 'id, source, path, url, file_name, alt, mime_type, size_bytes, width, height, version, created_at, updated_at';
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function useMediaByIds(ids: Array<string | null | undefined>) {
  const clean = [...new Set(ids.filter((x): x is string => Boolean(x)))].sort();
  return useQuery({
    queryKey: ['media-by-id', clean],
    enabled: clean.length > 0,
    queryFn: async () => {
      const rows = must(await sb.from('media_assets').select(MEDIA_SELECT).in('id', clean)) as MediaAsset[];
      return Object.fromEntries(rows.map((r) => [r.id, r])) as Record<string, MediaAsset>;
    },
  });
}

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return `“${file.name}” isn’t a supported image. Use PNG, JPEG, WebP, GIF or AVIF.`;
  if (file.size > MAX_UPLOAD_BYTES) return `“${file.name}” is larger than 10 MB. Export a smaller version and try again.`;
  return null;
}

async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const out = { width: bmp.width, height: bmp.height };
    bmp.close();
    return out;
  } catch {
    return null;
  }
}

function storagePath(file: File): string {
  const d = new Date();
  const safe = file.name.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'image';
  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'img';
  return `uploads/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID().slice(0, 8)}-${safe}.${ext}`;
}

/** Uploads to the public "media" bucket with progress (XHR, so we can report it). */
function putObject(path: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    void sb.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return reject(new AdminError('auth', 'Your session has ended. Sign in again to continue.'));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/media/${path.split('/').map(encodeURIComponent).join('/')}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.setRequestHeader('cache-control', 'max-age=31536000');
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let message = '';
        try {
          message = JSON.parse(xhr.responseText).message ?? '';
        } catch {
          /* not JSON */
        }
        if (xhr.status === 403 || /security|unauthorized/i.test(message)) return reject(new AdminError('forbidden', 'You don’t have permission to upload media.'));
        if (xhr.status === 413 || /size/i.test(message)) return reject(new AdminError('validation', 'The file is too large (10 MB maximum).'));
        if (/mime|type/i.test(message)) return reject(new AdminError('validation', 'This file type isn’t allowed.'));
        reject(new AdminError('server', 'The upload failed. Please try again.'));
      };
      xhr.onerror = () => reject(new AdminError('network', 'The upload was interrupted. Check your connection and try again.'));
      xhr.send(file);
    });
  });
}

export async function uploadMedia(file: File, alt: string, onProgress: (pct: number) => void): Promise<MediaAsset> {
  const problem = validateImageFile(file);
  if (problem) throw new AdminError('validation', problem);
  const path = storagePath(file);
  const size = await imageSize(file);
  await putObject(path, file, onProgress);
  const { data, error } = await sb
    .from('media_assets')
    .insert({ source: 'storage', path, url: publicMediaUrl(path), file_name: file.name.slice(0, 200), alt: alt.trim(), mime_type: file.type, size_bytes: file.size, width: size?.width ?? null, height: size?.height ?? null })
    .select(MEDIA_SELECT)
    .single();
  if (error) {
    await sb.storage.from('media').remove([path]);
    throw toAdminError(error);
  }
  return data as MediaAsset;
}

/** Swaps the file behind an asset; everything that uses the asset shows the new image. */
export async function replaceMedia(asset: MediaAsset, file: File, onProgress: (pct: number) => void): Promise<MediaAsset> {
  const problem = validateImageFile(file);
  if (problem) throw new AdminError('validation', problem);
  const path = storagePath(file);
  const size = await imageSize(file);
  await putObject(path, file, onProgress);
  const { data, error } = await sb
    .from('media_assets')
    .update({ source: 'storage', path, url: publicMediaUrl(path), file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size, width: size?.width ?? null, height: size?.height ?? null })
    .eq('id', asset.id)
    .eq('version', asset.version)
    .select(MEDIA_SELECT);
  if (error || !data?.length) {
    await sb.storage.from('media').remove([path]);
    throw error ? toAdminError(error) : new AdminError('conflict', 'This image was changed by someone else. Reload and try again.');
  }
  if (asset.source === 'storage') await sb.storage.from('media').remove([asset.path]);
  return data[0] as MediaAsset;
}

export interface MediaUsage {
  entity: string;
  entity_id: string;
  label: string;
  field: string;
}

export async function mediaUsage(id: string): Promise<MediaUsage[]> {
  return must(await sb.rpc('admin_media_usage', { p_id: id })) as MediaUsage[];
}

export async function deleteMedia(asset: MediaAsset): Promise<void> {
  must(await sb.from('media_assets').delete().eq('id', asset.id).select('id'));
  if (asset.source === 'storage') await sb.storage.from('media').remove([asset.path]);
}

// -------------------------------------------------------------------- csv

export function toCsv(rows: Array<Record<string, unknown>>, columns: Array<{ key: string; label: string }>): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v);
    // Neutralise spreadsheet formulas (CSV injection) and quote every cell.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(','))].join('\r\n');
}

export function downloadCsv(name: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
