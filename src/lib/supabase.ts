import { PostgrestClient } from '@supabase/postgrest-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * The site only reads public content and calls the submission functions, so it
 * uses Supabase's data API client alone (no auth, realtime or storage code).
 * Null when the site was built without Supabase settings (see .env.example).
 */
export const supabase: PostgrestClient | null = url && key ? new PostgrestClient(`${url.replace(/\/$/, '')}/rest/v1`, { headers: { apikey: key } }) : null;
