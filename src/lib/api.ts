import { supabase } from './supabase';
import type { ArchiveItem, Chapter, Episode, LangCode, Report, SiteSettings, Topic } from './types';
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

interface EpisodeRow {
  id: string; number: number; title: string; dek: string; guest: string; topic: Topic; language: LangCode;
  duration_seconds: number; published_on: string; youtube_id: string | null; audio_url: string | null; chapters: Chapter[] | null;
}

export function mapEpisode(r: EpisodeRow): Episode {
  return {
    id: r.id, number: r.number, title: r.title, dek: r.dek, guest: r.guest, topic: r.topic, language: r.language,
    durationSeconds: r.duration_seconds, publishedOn: r.published_on, youtubeId: r.youtube_id, audioUrl: r.audio_url,
    chapters: Array.isArray(r.chapters) ? r.chapters.filter((c) => typeof c?.at === 'number' && typeof c?.label === 'string') : [],
  };
}

export async function fetchEpisodes(): Promise<Episode[]> {
  const rows = await select(() =>
    client()
      .from('episodes')
      .select('id, number, title, dek, guest, topic, language, duration_seconds, published_on, youtube_id, audio_url, chapters')
      .order('published_on', { ascending: false })
      .order('number', { ascending: false })
      .abortSignal(signal()),
  );
  return (rows as EpisodeRow[]).map(mapEpisode);
}

export async function fetchReports(): Promise<Report[]> {
  const rows = await select(() =>
    client().from('reports').select('id, topic, title, dek, read_minutes, published_on, url').order('published_on', { ascending: false }).abortSignal(signal()),
  );
  return (rows as Array<{ id: string; topic: Topic; title: string; dek: string; read_minutes: number; published_on: string; url: string | null }>).map((r) => ({
    id: r.id, topic: r.topic, title: r.title, dek: r.dek, readMinutes: r.read_minutes, publishedOn: r.published_on, url: r.url,
  }));
}

export async function fetchArchive(): Promise<ArchiveItem[]> {
  const rows = await select(() =>
    client().from('archive_items').select('id, name, show, image_url, href').order('sort_order', { ascending: true }).abortSignal(signal()),
  );
  return (rows as Array<{ id: number; name: string; show: string; image_url: string; href: string }>).map((r) => ({
    id: r.id, name: r.name, show: r.show, imageUrl: r.image_url, href: r.href,
  }));
}

export const DEFAULT_SETTINGS: SiteSettings = { showTicker: false, tickerText: '', tickerLinkUrl: '', monthlyGoalCents: null, raisedCents: null, supportersCount: null };

export async function fetchSettings(): Promise<SiteSettings> {
  let r: { show_ticker: boolean; ticker_text: string; ticker_link_url: string; monthly_goal_cents: number | null; raised_cents: number | null; supporters_count: number | null } | null;
  try {
    const { data, error } = await client()
      .from('site_settings')
      .select('show_ticker, ticker_text, ticker_link_url, monthly_goal_cents, raised_cents, supporters_count')
      .eq('id', true)
      .abortSignal(signal())
      .maybeSingle();
    if (error) throw error;
    r = data;
  } catch (err) {
    throw toApiError(err);
  }
  if (!r) return DEFAULT_SETTINGS;
  return {
    showTicker: r.show_ticker, tickerText: r.ticker_text, tickerLinkUrl: r.ticker_link_url,
    monthlyGoalCents: r.monthly_goal_cents, raisedCents: r.raised_cents, supportersCount: r.supporters_count,
  };
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
