import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mergeConfig, type ConfigKey, type SiteConfig } from '@/lib/siteConfig';
import { AdminError, must, toAdminError } from './errors';
import { publicMediaUrl, resumableUploadUrl, sb, SUPABASE_URL } from './supabase';

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
  pending: { booking_new: number; guest_new: number; pledges_unpaid: number; vip_unpaid: number; donations_unpaid: number; drafts_pending: number };
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

/** Exact, case-insensitive match for a PostgREST ilike filter (no wildcards). */
export function pgrstExact(s: string): string {
  return s.replace(/[%_,()*\\]/g, (c) => `\\${c}`);
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

export type MediaKind = 'image' | 'video';

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  source: 'storage' | 'bundled';
  path: string;
  url: string;
  file_name: string;
  alt: string;
  mime_type: string;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export const MEDIA_SELECT = 'id, kind, source, path, url, file_name, alt, mime_type, size_bytes, width, height, duration_seconds, version, created_at, updated_at';
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Must match the "videos" bucket (supabase/migrations/*_episode_video_report_articles.sql).
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024 * 1024;

export const bucketOf = (kind: MediaKind) => (kind === 'video' ? 'videos' : 'media');
export const kindOfFile = (file: File): MediaKind | null =>
  ACCEPTED_IMAGE_TYPES.includes(file.type) ? 'image' : ACCEPTED_VIDEO_TYPES.includes(file.type) ? 'video' : null;

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

export function validateVideoFile(file: File): string | null {
  if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) return `“${file.name}” isn’t a supported video. Use MP4 (H.264), WebM or MOV.`;
  if (file.size > MAX_VIDEO_BYTES) return `“${file.name}” is larger than 5 GB. Export a smaller version and try again.`;
  return null;
}

/** Image or video, whichever the file is. */
export function validateMediaFile(file: File): string | null {
  const kind = kindOfFile(file);
  if (!kind) return `“${file.name}” isn’t a supported file. Use an image (PNG, JPEG, WebP, GIF, AVIF) or a video (MP4, WebM, MOV).`;
  return kind === 'video' ? validateVideoFile(file) : validateImageFile(file);
}

/** Size and length of a video file, read by the browser (null if it can't decode it). */
function videoInfo(file: File): Promise<{ width: number; height: number; duration: number } | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (out: { width: number; height: number; duration: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(out);
    };
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => done({ width: v.videoWidth, height: v.videoHeight, duration: Number.isFinite(v.duration) ? v.duration : 0 });
    v.onerror = () => done(null);
    setTimeout(() => done(null), 15_000);
    v.src = url;
  });
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
  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg').replace('quicktime', 'mov') ?? 'bin';
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

/**
 * Uploads a video to the "videos" bucket in 6 MB resumable chunks (TUS),
 * so multi-gigabyte files survive a dropped connection. The session token
 * is read before every chunk, so long uploads outlive token refreshes.
 */
async function putVideoObject(path: string, file: File, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<void> {
  const { Upload } = await import('tus-js-client');
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new AdminError('auth', 'Your session has ended. Sign in again to continue.');
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: resumableUploadUrl(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string, 'x-upsert': 'false' },
      metadata: { bucketName: 'videos', objectName: path, contentType: file.type, cacheControl: '31536000' },
      onBeforeRequest: async (req) => {
        const { data: s } = await sb.auth.getSession();
        if (s.session) req.setHeader('Authorization', `Bearer ${s.session.access_token}`);
      },
      onProgress: (sent, total) => onProgress(total ? Math.min(99, Math.floor((sent / total) * 100)) : 0),
      onSuccess: () => {
        onProgress(100);
        resolve();
      },
      onError: (err) => {
        const status = (err as { originalResponse?: { getStatus(): number } | null }).originalResponse?.getStatus?.() ?? 0;
        const body = (err as { originalResponse?: { getBody(): string } | null }).originalResponse?.getBody?.() ?? '';
        if (status === 413 || /size|too large|exceeded/i.test(body)) {
          reject(new AdminError('validation', 'The video is larger than the storage limit. Raise “Global file size limit” in Supabase → Storage → Settings, or upload a smaller file.'));
        } else if (status === 401) reject(new AdminError('auth', 'Your session has ended. Sign in again to continue.'));
        else if (status === 403) reject(new AdminError('forbidden', 'You don’t have permission to upload media.'));
        else if (/mime|type/i.test(body)) reject(new AdminError('validation', 'This video type isn’t allowed. Use MP4, WebM or MOV.'));
        else if (status === 0) reject(new AdminError('network', 'The upload was interrupted. Check your connection and try again; it resumes where it stopped.'));
        else reject(new AdminError('server', 'The upload failed. Please try again.'));
      },
    });
    signal?.addEventListener('abort', () => {
      void upload.abort(true);
      reject(new AdminError('validation', 'Upload cancelled.'));
    });
    void upload.findPreviousUploads().then((previous) => {
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}

/** Pixel size (and length, for videos) read in the browser. */
async function fileInfo(file: File, kind: MediaKind): Promise<{ width: number; height: number; duration: number | null } | null> {
  if (kind === 'image') {
    const s = await imageSize(file);
    return s ? { ...s, duration: null } : null;
  }
  const v = await videoInfo(file);
  return v ? { width: v.width, height: v.height, duration: Math.round(v.duration) } : null;
}

/** Uploads an image or a video and adds it to the media library. */
export async function uploadMedia(file: File, alt: string, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<MediaAsset> {
  const problem = validateMediaFile(file);
  if (problem) throw new AdminError('validation', problem);
  const kind = kindOfFile(file)!;
  const bucket = bucketOf(kind);
  const path = storagePath(file);
  const info = await fileInfo(file, kind);
  if (kind === 'video') await putVideoObject(path, file, onProgress, signal);
  else await putObject(path, file, onProgress);
  const { data, error } = await sb
    .from('media_assets')
    .insert({
      kind, source: 'storage', path, url: publicMediaUrl(path, bucket), file_name: file.name.slice(0, 200), alt: alt.trim(), mime_type: file.type, size_bytes: file.size,
      width: info?.width || null, height: info?.height || null, duration_seconds: info?.duration ?? null,
    })
    .select(MEDIA_SELECT)
    .single();
  if (error) {
    await sb.storage.from(bucket).remove([path]);
    throw toAdminError(error);
  }
  return data as MediaAsset;
}

/** Swaps the file behind an asset; everything that uses the asset shows the new file. */
export async function replaceMedia(asset: MediaAsset, file: File, onProgress: (pct: number) => void, signal?: AbortSignal): Promise<MediaAsset> {
  const problem = validateMediaFile(file);
  if (problem) throw new AdminError('validation', problem);
  const kind = kindOfFile(file)!;
  if (kind !== asset.kind) throw new AdminError('validation', asset.kind === 'video' ? 'Replace a video with another video.' : 'Replace an image with another image.');
  const bucket = bucketOf(kind);
  const path = storagePath(file);
  const info = await fileInfo(file, kind);
  if (kind === 'video') await putVideoObject(path, file, onProgress, signal);
  else await putObject(path, file, onProgress);
  const { data, error } = await sb
    .from('media_assets')
    .update({
      source: 'storage', path, url: publicMediaUrl(path, bucket), file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size,
      width: info?.width || null, height: info?.height || null, duration_seconds: info?.duration ?? null,
    })
    .eq('id', asset.id)
    .eq('version', asset.version)
    .select(MEDIA_SELECT);
  if (error || !data?.length) {
    await sb.storage.from(bucket).remove([path]);
    throw error ? toAdminError(error) : new AdminError('conflict', 'This file was changed by someone else. Reload and try again.');
  }
  if (asset.source === 'storage') await sb.storage.from(bucket).remove([asset.path]);
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
  if (asset.source === 'storage') await sb.storage.from(bucketOf(asset.kind)).remove([asset.path]);
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
