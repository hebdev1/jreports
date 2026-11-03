import { LANGUAGES, TOPICS, type Language, type Topic } from './types';

// Client-side checks mirror the database functions in
// supabase/migrations/*_submission_functions.sql, which re-validate every
// field. Keep the limits in sync.
export const LIMITS = {
  name: 120,
  org: 160,
  email: 254,
  phone: 25,
  short: 200,
  address: 300,
  links: 500,
  long: 4000,
} as const;

export type Errors<T> = Partial<Record<keyof T, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\d\s.-]{7,25}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isEmail(v: string): boolean {
  const t = v.trim();
  return t.length <= LIMITS.email && EMAIL.test(t);
}

export function isDate(v: string): boolean {
  if (!DATE.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Whole years between an ISO birth date and `today` (local calendar). */
export function ageOn(dob: string, today = new Date()): number {
  const [y, m, d] = dob.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

export function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return norm(a) !== '' && norm(a) === norm(b);
}

function text(errors: Record<string, string>, key: string, value: string, label: string, max: number, required = false) {
  const t = value.trim();
  if (required && !t) errors[key] = `Enter ${label}.`;
  else if (t.length > max) errors[key] = `Keep ${label} under ${max} characters.`;
}

function email(errors: Record<string, string>, key: string, value: string, required = true) {
  if (!value.trim()) {
    if (required) errors[key] = 'Enter your email address.';
  } else if (!isEmail(value)) errors[key] = 'Enter a valid email address, like name@example.com.';
}

function phone(errors: Record<string, string>, key: string, value: string, required = false) {
  if (!value.trim()) {
    if (required) errors[key] = 'Enter a phone number.';
  } else if (!PHONE.test(value.trim())) errors[key] = 'Enter a valid phone number.';
}

// ---------------------------------------------------------------- newsletter

export interface NewsletterInput {
  email: string;
  language: Language;
  alerts: { premiere: boolean; briefing: boolean; breaking: boolean };
}

export function validateNewsletter(f: NewsletterInput): Errors<NewsletterInput> {
  const e: Record<string, string> = {};
  email(e, 'email', f.email);
  if (!LANGUAGES.includes(f.language)) e.language = 'Choose a briefing language.';
  if (!f.alerts.premiere && !f.alerts.briefing && !f.alerts.breaking) e.alerts = 'Choose at least one alert.';
  return e as Errors<NewsletterInput>;
}

// ------------------------------------------------------------------- booking

export const REQUEST_TYPES = ['Event hosting', 'Keynote / appearance', 'Sponsored coverage', 'Advertising'] as const;
export const AUDIENCES = ['Under 100', '100–500', '500–2,000', '2,000+'] as const;
export const BUDGETS = ['Under $2.5k', '$2.5k–$10k', '$10k–$25k', '$25k+'] as const;

export interface BookingInput {
  requestType: (typeof REQUEST_TYPES)[number];
  fullName: string;
  organization: string;
  email: string;
  phone: string;
  eventDate: string;
  venue: string;
  audience: (typeof AUDIENCES)[number];
  campaignStart: string;
  product: string;
  languages: Language[];
  budget: (typeof BUDGETS)[number];
  message: string;
}

export function validateBooking(f: BookingInput, today = new Date()): Errors<BookingInput> {
  const e: Record<string, string> = {};
  text(e, 'fullName', f.fullName, 'your full name', LIMITS.name, true);
  text(e, 'organization', f.organization, 'the organization or brand', LIMITS.org);
  email(e, 'email', f.email);
  phone(e, 'phone', f.phone);
  const isAd = f.requestType === 'Advertising';
  const date = isAd ? f.campaignStart : f.eventDate;
  const dateKey = isAd ? 'campaignStart' : 'eventDate';
  if (date) {
    if (!isDate(date)) e[dateKey] = 'Enter a valid date.';
    else if (date < localIso(today)) e[dateKey] = 'Choose a date that hasn’t passed.';
  }
  text(e, 'venue', f.venue, 'the city or venue', LIMITS.short);
  text(e, 'product', f.product, 'the product or message', LIMITS.short);
  if (f.languages.length === 0) e.languages = 'Choose at least one language.';
  text(e, 'message', f.message, 'a few details about your request', LIMITS.long, true);
  return e as Errors<BookingInput>;
}

// --------------------------------------------------------------------- guest

export const GUEST_FORMATS = ['One-on-one interview', 'Remote · video call'] as const;

export interface GuestInput {
  fullName: string;
  titleOrg: string;
  email: string;
  phone: string;
  topic: Topic;
  languages: Language[];
  format: (typeof GUEST_FORMATS)[number];
  links: string;
  pitch: string;
}

export function validateGuest(f: GuestInput): Errors<GuestInput> {
  const e: Record<string, string> = {};
  text(e, 'fullName', f.fullName, 'your full name', LIMITS.name, true);
  text(e, 'titleOrg', f.titleOrg, 'your title or organization', LIMITS.org);
  email(e, 'email', f.email);
  phone(e, 'phone', f.phone);
  if (!TOPICS.includes(f.topic)) e.topic = 'Choose a topic.';
  if (f.languages.length === 0) e.languages = 'Choose at least one interview language.';
  text(e, 'links', f.links, 'your links', LIMITS.links);
  text(e, 'pitch', f.pitch, 'your story or topic', LIMITS.long, true);
  return e as Errors<GuestInput>;
}

// ------------------------------------------------------------ talent release

export interface ReleaseInput {
  legalName: string;
  screenName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  episode: string;
  recordingDate: string;
  isMinor: boolean;
  guardianName: string;
  guardianRelationship: string;
  consents: [boolean, boolean, boolean, boolean];
  signature: string;
}

export function validateRelease(f: ReleaseInput, today = new Date()): Errors<ReleaseInput> {
  const e: Record<string, string> = {};
  text(e, 'legalName', f.legalName, 'your full legal name', LIMITS.name, true);
  text(e, 'screenName', f.screenName, 'the name to show on screen', LIMITS.name, true);
  email(e, 'email', f.email);
  phone(e, 'phone', f.phone, true);
  text(e, 'address', f.address, 'your mailing address', LIMITS.address, true);
  if (!f.dateOfBirth) e.dateOfBirth = 'Enter your date of birth.';
  else if (!isDate(f.dateOfBirth) || f.dateOfBirth >= localIso(today)) e.dateOfBirth = 'Enter a valid date of birth.';
  else if (!f.isMinor && ageOn(f.dateOfBirth, today) < 18) e.dateOfBirth = 'This date makes the guest under 18. Check the box below so a parent or guardian can sign.';
  text(e, 'episode', f.episode, 'the episode or segment', LIMITS.short, true);
  if (!f.recordingDate) e.recordingDate = 'Enter the recording date.';
  else if (!isDate(f.recordingDate)) e.recordingDate = 'Enter a valid recording date.';
  if (f.isMinor) {
    text(e, 'guardianName', f.guardianName, 'the parent or guardian’s name', LIMITS.name, true);
    text(e, 'guardianRelationship', f.guardianRelationship, 'the relationship to the guest', LIMITS.short, true);
  }
  if (!f.consents.every(Boolean)) e.consents = 'Check all four boxes to accept the release terms.';
  const signer = f.isMinor ? f.guardianName : f.legalName;
  if (!f.signature.trim()) e.signature = 'Type your full legal name to sign.';
  else if (!sameName(f.signature, signer))
    e.signature = f.isMinor ? 'The signature must match the parent or guardian’s name above.' : 'The signature must match your full legal name above.';
  return e as Errors<ReleaseInput>;
}

// ------------------------------------------------------------------ pledges

export const PAYMENT_METHODS = ['Card', 'PayPal', 'Apple Pay', 'Google Pay', 'Cash App', 'Zelle'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const MAX_PLEDGE_CENTS = 100_000_00;

export interface PledgeInput {
  kind: 'donation' | 'vip';
  frequency: 'monthly' | 'once';
  amountCents: number;
  coverFees: boolean;
  method: PaymentMethod;
  tier: string | null;
  fullName: string;
  email: string;
  agreed: boolean;
}

export function validatePledge(f: PledgeInput): Errors<PledgeInput> {
  const e: Record<string, string> = {};
  if (!Number.isInteger(f.amountCents) || f.amountCents < 100) e.amountCents = 'Choose an amount of at least $1.';
  else if (f.amountCents > MAX_PLEDGE_CENTS) e.amountCents = 'For gifts over $100,000, please contact the team directly.';
  if (!PAYMENT_METHODS.includes(f.method)) e.method = 'Choose a payment method.';
  text(e, 'fullName', f.fullName, 'your full name', LIMITS.name, f.kind === 'vip');
  email(e, 'email', f.email);
  if (f.kind === 'vip' && !f.agreed) e.agreed = 'Agree to the monthly billing terms to continue.';
  return e as Errors<PledgeInput>;
}

export function hasErrors(e: object): boolean {
  return Object.keys(e).length > 0;
}

/** Today's date as YYYY-MM-DD in the visitor's local calendar. */
export function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
