import { mergeConfig, type SiteConfig } from './siteConfig';
import { supabase } from './supabase';
import type { ArchiveItem, Chapter, Episode, LangCode, PublicMedia, Report, Sponsor, Topic } from './types';
import type { BookingInput, GuestInput, NewsletterInput, PledgeInput, ReleaseInput } from './validation';

const TIMEOUT_MS = 15_000;

export type ApiErrorCode = 'not_configured' | 'network' | 'timeout' | 'validation' | 'rate_limited' | 'server';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly field?: string;
  constructor(code: ApiErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.field = field;
  }
}

const MESSAGES: Record<Exclude<ApiErrorCode, 'validation'>, string> = {
  not_configured: 'This feature isn’t connected yet. Please try again later.',
  network: 'We couldn’t reach the server. Check your connection and try again.',
  timeout: 'The server took too long to answer. Please try again.',
  rate_limited: 'You’ve sent several requests in a short time. Please wait a few minutes and try again.',
  server: 'Something went wrong on our side. Please try again.',
};

/** Field names used by the database functions, mapped to readable labels. */
const FIELD_LABELS: Record<string, string> = {
  email: 'email address',
  full_name: 'full name',
  legal_name: 'full legal name',
  signature: 'signature',
  message: 'request details',
  pitch: 'story or topic',
  amount_cents: 'amount',
};

/** Maps a supabase-js / PostgREST error (or a thrown fetch error) to an ApiError. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const e = (err ?? {}) as { name?: string; message?: string; code?: string };
  const msg = e.message ?? '';
  if (e.name === 'AbortError' || e.name === 'TimeoutError' || /abort|timed? ?out/i.test(msg)) return new ApiError('timeout', MESSAGES.timeout);
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(msg)) return new ApiError('network', MESSAGES.network);
  if (msg.startsWith('rate_limited')) return new ApiError('rate_limited', MESSAGES.rate_limited);
  const m = /^(required|invalid|too_long):([a-z_]+)/.exec(msg);
  if (m) {
    const [, kind, field] = m;
    const label = FIELD_LABELS[field] ?? field.replace(/_/g, ' ');
    const text = kind === 'required' ? `Please add your ${label}.` : kind === 'too_long' ? `Your ${label} is too long.` : `Please check your ${label}.`;
    return new ApiError('validation', text, field);
  }
  return new ApiError('server', MESSAGES.server);
}

function client() {
  if (!supabase) throw new ApiError('not_configured', MESSAGES.not_configured);
  return supabase;
}

function signal() {
  return AbortSignal.timeout(TIMEOUT_MS);
}

async function rpc<T>(fn: string, payload: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await client().rpc(fn, { payload }).abortSignal(signal());
    if (error) throw error;
    return data as T;
  } catch (err) {
    throw toApiError(err);
  }
}

async function select<T>(run: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  try {
    const { data, error } = await run();
    if (error) throw error;
    if (data === null) throw new ApiError('server', MESSAGES.server);
    return data;
  } catch (err) {
    throw toApiError(err);
  }
}

// ------------------------------------------------------------------ content

// Only published rows are readable by visitors (row-level security); the
// status filters below say so explicitly and keep the queries index-friendly.

/** Columns visitors may read from media_assets. */
export const MEDIA_COLUMNS = 'id, source, url, alt, width, height';

export interface EpisodeRow {
  id: string; number: number; title: string; dek: string; guest: string; topic: Topic; language: LangCode;
  duration_seconds: number; published_on: string; youtube_id: string | null; audio_url: string | null; chapters: Chapter[] | null;
  image?: PublicMedia | null; seo_title?: string; seo_description?: string;
}

export const EPISODE_COLUMNS = `id, number, title, dek, guest, topic, language, duration_seconds, published_on, youtube_id, audio_url, chapters, seo_title, seo_description, image:media_assets!episodes_image_id_fkey(${MEDIA_COLUMNS})`;

export function mapEpisode(r: EpisodeRow): Episode {
  return {
    id: r.id, number: r.number, title: r.title, dek: r.dek, guest: r.guest, topic: r.topic, language: r.language,
    durationSeconds: r.duration_seconds, publishedOn: r.published_on, youtubeId: r.youtube_id, audioUrl: r.audio_url,
    chapters: Array.isArray(r.chapters) ? r.chapters.filter((c) => typeof c?.at === 'number' && typeof c?.label === 'string') : [],
    image: r.image ?? null, seoTitle: r.seo_title ?? '', seoDescription: r.seo_description ?? '',
  };
}

export async function fetchEpisodes(): Promise<Episode[]> {
  const rows = await select(() =>
    client()
      .from('episodes')
      .select(EPISODE_COLUMNS)
      .eq('status', 'published')
      .order('published_on', { ascending: false })
      .order('number', { ascending: false })
      .abortSignal(signal()),
  );
  return (rows as unknown as EpisodeRow[]).map(mapEpisode);
}

export async function fetchReports(): Promise<Report[]> {
  const rows = await select(() =>
    client().from('reports').select('id, topic, title, dek, read_minutes, published_on, url').eq('status', 'published').order('published_on', { ascending: false }).abortSignal(signal()),
  );
  return (rows as Array<{ id: string; topic: Topic; title: string; dek: string; read_minutes: number; published_on: string; url: string | null }>).map((r) => ({
    id: r.id, topic: r.topic, title: r.title, dek: r.dek, readMinutes: r.read_minutes, publishedOn: r.published_on, url: r.url,
  }));
}

export async function fetchArchive(): Promise<ArchiveItem[]> {
  const rows = await select(() =>
    client().from('archive_items').select('id, name, show, image_url, href').eq('status', 'published').order('sort_order', { ascending: true }).abortSignal(signal()),
  );
  return (rows as Array<{ id: number; name: string; show: string; image_url: string; href: string }>).map((r) => ({
    id: r.id, name: r.name, show: r.show, imageUrl: r.image_url, href: r.href,
  }));
}

interface SponsorRow {
  id: string; name: string; name_accent: string; tagline: string; website_url: string | null; phone: string;
  thanks_text: string; placements: Sponsor['placements']; image: PublicMedia | null; thanks_image: PublicMedia | null;
}

export async function fetchSponsors(): Promise<Sponsor[]> {
  const rows = await select(() =>
    client()
      .from('sponsors')
      .select(
        `id, name, name_accent, tagline, website_url, phone, thanks_text, placements, image:media_assets!sponsors_image_id_fkey(${MEDIA_COLUMNS}), thanks_image:media_assets!sponsors_thanks_image_id_fkey(${MEDIA_COLUMNS})`,
      )
      .eq('status', 'published')
      .order('sort_order', { ascending: true })
      .abortSignal(signal()),
  );
  return (rows as unknown as SponsorRow[]).map((r) => ({
    id: r.id, name: r.name, nameAccent: r.name_accent, tagline: r.tagline, websiteUrl: r.website_url, phone: r.phone,
    image: r.image, thanksText: r.thanks_text, thanksImage: r.thanks_image, placements: r.placements ?? [],
  }));
}

export interface PublicConfig {
  config: SiteConfig;
  /** Images chosen for the fixed page positions, by media id. */
  media: Record<string, PublicMedia>;
}

/** Site settings managed in the admin (header, footer, home page, images…). */
export async function fetchSiteConfig(): Promise<PublicConfig> {
  const rows = await select(() => client().from('site_config').select('key, value').abortSignal(signal()));
  const config = mergeConfig(rows as Array<{ key: string; value: unknown }>);
  const ids = [...new Set(Object.values(config.images).filter((v): v is string => typeof v === 'string' && v !== ''))];
  if (ids.length === 0) return { config, media: {} };
  const media = await select(() => client().from('media_assets').select(MEDIA_COLUMNS).in('id', ids).abortSignal(signal()));
  return { config, media: Object.fromEntries((media as unknown as PublicMedia[]).map((m) => [m.id, m])) };
}

// -------------------------------------------------------------- submissions
// Every write goes through a SECURITY DEFINER function that validates the
// payload server-side and returns a reference. Visitors can't read any of
// these tables back.

export type Honeypot = { website?: string };

export function subscribeNewsletter(f: NewsletterInput & Honeypot, source: 'subscribe_dialog' | 'footer'): Promise<void> {
  return rpc<null>('subscribe_newsletter', {
    email: f.email.trim(), language: f.language, alert_premiere: f.alerts.premiere, alert_briefing: f.alerts.briefing,
    alert_breaking: f.alerts.breaking, source, website: f.website ?? '',
  }).then(() => undefined);
}

export function submitBookingRequest(f: BookingInput & Honeypot): Promise<string> {
  const isAd = f.requestType === 'Advertising';
  return rpc<string>('submit_booking_request', {
    request_type: f.requestType, full_name: f.fullName, organization: f.organization, email: f.email.trim(), phone: f.phone,
    event_date: !isAd && f.eventDate ? f.eventDate : null, venue: isAd ? '' : f.venue, audience: isAd ? null : f.audience,
    campaign_start: isAd && f.campaignStart ? f.campaignStart : null, product: isAd ? f.product : '',
    languages: f.languages, budget: f.budget, message: f.message, website: f.website ?? '',
  });
}

export function submitGuestRequest(f: GuestInput & Honeypot): Promise<string> {
  return rpc<string>('submit_guest_request', {
    full_name: f.fullName, title_org: f.titleOrg, email: f.email.trim(), phone: f.phone, topic: f.topic,
    languages: f.languages, format: f.format, links: f.links, pitch: f.pitch, website: f.website ?? '',
  });
}

export interface SignedRelease {
  reference: string;
  signedAt: string;
}

export async function signTalentRelease(f: ReleaseInput & Honeypot, termsVersion: string): Promise<SignedRelease> {
  const r = await rpc<{ reference: string; signed_at: string }>('sign_talent_release', {
    legal_name: f.legalName, screen_name: f.screenName, email: f.email.trim(), phone: f.phone, mailing_address: f.address,
    date_of_birth: f.dateOfBirth, episode: f.episode, recording_date: f.recordingDate, is_minor: f.isMinor,
    guardian_name: f.isMinor ? f.guardianName : '', guardian_relationship: f.isMinor ? f.guardianRelationship : '',
    consents: f.consents, signature: f.signature, terms_version: termsVersion,
    user_agent: typeof navigator === 'undefined' ? '' : navigator.userAgent.slice(0, 400), website: f.website ?? '',
  });
  return { reference: r.reference, signedAt: r.signed_at };
}

export function submitPledge(f: PledgeInput & Honeypot): Promise<string> {
  return rpc<string>('submit_support_pledge', {
    kind: f.kind, frequency: f.frequency, amount_cents: f.amountCents, cover_fees: f.coverFees, method: f.method,
    tier: f.tier, full_name: f.fullName, email: f.email.trim(), agreed: f.agreed, website: f.website ?? '',
  });
}
