import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);
export const SUPABASE_URL = url ?? '';

/** Session key shared with the public site's draft preview (same origin). */
export const AUTH_STORAGE_KEY = 'jr-admin-auth';

/**
 * Admin client: signs team members in and reads/writes through row-level
 * security. Only the publishable key is used here; every permission is
 * enforced by the database (see supabase/migrations/*_admin_foundation.sql).
 */
export const sb = createClient(url || 'http://localhost', key || 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY },
});

export function publicMediaUrl(path: string, bucket: 'media' | 'videos' = 'media'): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/**
 * Endpoint for resumable (TUS) uploads. Supabase recommends the direct
 * storage host (<ref>.storage.supabase.co) for large files.
 */
export function resumableUploadUrl(base = SUPABASE_URL): string {
  try {
    const u = new URL(base);
    if (u.hostname.endsWith('.supabase.co') && !u.hostname.endsWith('.storage.supabase.co')) u.hostname = u.hostname.replace(/\.supabase\.co$/, '.storage.supabase.co');
    return `${u.origin}/storage/v1/upload/resumable`;
  } catch {
    return `${base}/storage/v1/upload/resumable`;
  }
}
