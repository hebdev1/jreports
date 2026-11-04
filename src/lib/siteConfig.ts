// Shape of the site_config documents shared by the public site and the admin.
// DEFAULT_CONFIG equals the values seeded in supabase/migrations/*_admin_seed.sql;
// the public site only uses it for the header/footer while settings load, or
// if they fail to load (with a visible notice), so the site stays navigable.

export interface NavLink {
  label: string;
  href: string;
  visible: boolean;
}

export const HOME_SECTIONS = [
  { key: 'hero', label: 'Latest episode (hero)', description: 'Newest published episode, host photo and highlight figures.' },
  { key: 'appearances', label: '“James has appeared on” strip', description: 'The outlets list from Credits.' },
  { key: 'story', label: 'Our story video', description: 'YouTube video with title and text.' },
  { key: 'recent', label: 'Recent episodes', description: 'The four published episodes after the latest one.' },
  { key: 'youtube', label: 'Latest on the podcast', description: 'Four newest uploads from the YouTube channel.' },
  { key: 'reports', label: 'Reports and coverage history', description: 'Four newest reports and the timeline.' },
  { key: 'fundraising', label: 'Fundraising', description: 'Monthly goal, raised amount and supporters.' },
  { key: 'archive', label: 'From the archive', description: 'First five archive interviews.' },
  { key: 'sponsor_feature', label: 'Sponsor card', description: 'Sponsors placed as “Sponsor card”.' },
  { key: 'sponsor_thanks', label: 'Sponsor thank-you', description: 'Sponsors placed as “Thank-you block”.' },
] as const;
export type HomeSectionKey = (typeof HOME_SECTIONS)[number]['key'];

export const IMAGE_SLOTS = [
  { key: 'homeHero', label: 'Home hero portrait', where: 'Home page, next to the latest episode', aspect: '4 / 5' },
  { key: 'aboutPortrait', label: 'About portrait', where: 'About page, top', aspect: '4 / 5' },
  { key: 'bookingHero', label: 'Booking hero', where: 'Booking page, top right', aspect: '4 / 5' },
  { key: 'vipHero', label: 'VIP Club portrait', where: 'VIP Club page, behind the member card', aspect: '4 / 5' },
  { key: 'guestPhoto', label: 'Guest request photo', where: '“Request to be a guest” section on every page', aspect: '16 / 10' },
  { key: 'episodeDefault', label: 'Default episode image', where: 'Episode pages without their own image', aspect: '16 / 9' },
] as const;
export type ImageSlot = (typeof IMAGE_SLOTS)[number]['key'];

export interface WatchChannel {
  name: string;
  description: string;
  guideLabel: string;
  playlistId: string;
  videoId: string;
  start: number;
}

export interface SiteConfig {
  brand: { siteName: string; tagline: string; description: string };
  seo: { defaultTitle: string; defaultDescription: string };
  contact: { bookingEmail: string; adsEmail: string };
  social: { youtube: string; facebook: string; x: string; vimeo: string };
  navigation: { header: NavLink[] };
  footer: { languages: string; privacyUrl: string; termsUrl: string };
  ticker: { enabled: boolean; label: string; text: string; linkLabel: string; linkUrl: string };
  fundraising: { goalCents: number | null; raisedCents: number | null; supportersCount: number | null };
  home: {
    sections: Array<{ key: HomeSectionKey; visible: boolean }>;
    highlights: Array<{ value: string; label: string }>;
    story: { youtubeId: string; start: number; title: string; body: string };
    timelineIntro: string;
    timeline: Array<{ year: string; text: string }>;
  };
  credits: { appearances: string[]; clients: string[] };
  about: { intro: string; paragraphs: string[]; facts: Array<{ label: string; value: string }> };
  watch: { channels: WatchChannel[]; headlines: string[]; premiereTitle: string; premiereSubtitle: string };
  podcast: { uploadsPlaylistId: string; playlists: Array<{ id: string; label: string }> };
  images: Partial<Record<ImageSlot, string | null>>;
}
export type ConfigKey = keyof SiteConfig;

export const UPLOADS_PLAYLIST = 'UUXOdc4wPeeSxOOVakrf9wlg';

export const DEFAULT_CONFIG: SiteConfig = {
  brand: { siteName: 'James Reports', tagline: 'with James Pierre', description: 'Trusted coverage of immigration, politics and Haiti. Miami, Florida.' },
  seo: {
    defaultTitle: 'James Reports with James Pierre',
    defaultDescription:
      'Independent interviews and reporting on immigration, politics, Haiti and the Haitian community, with 4-time Emmy Award winner James Pierre. In English, Français, Kreyòl and Español.',
  },
  contact: { bookingEmail: 'booking@jamesreports.com', adsEmail: 'ads@jamesreports.com' },
  social: {
    youtube: 'https://www.youtube.com/@JamesReports',
    facebook: 'https://www.facebook.com/pages/JAMES-PIERRE/284513110117',
    x: 'https://twitter.com/lovejamespierre',
    vimeo: 'https://vimeo.com/jamespierre',
  },
  navigation: {
    header: [
      { label: 'Home', href: '/', visible: true },
      { label: 'Watch', href: '/watch', visible: true },
      { label: 'Podcast', href: '/podcast', visible: true },
      { label: 'Episodes', href: '/episodes', visible: true },
      { label: 'Reports', href: '/reports', visible: true },
      { label: 'Archive', href: '/archive', visible: true },
      { label: 'About', href: '/about', visible: true },
      { label: 'Booking', href: '/booking', visible: true },
    ],
  },
  footer: { languages: 'English · Français · Kreyòl · Español', privacyUrl: '', termsUrl: '' },
  ticker: { enabled: true, label: 'Premiere', text: 'New episode of James Reports premieres Thursday at 8 PM ET on YouTube', linkLabel: 'Set a reminder', linkUrl: 'https://www.youtube.com/@JamesReports' },
  fundraising: { goalCents: 1_200_000, raisedCents: null, supportersCount: null },
  home: {
    sections: HOME_SECTIONS.map((s) => ({ key: s.key, visible: true })),
    highlights: [
      { value: '4×', label: 'Emmy Award winner' },
      { value: '20+', label: 'Years in broadcast' },
      { value: '4', label: 'Languages · EN FR KR ES' },
    ],
    story: { youtubeId: 'Q_oljAV4Yfs', start: 31, title: 'How James Reports began', body: 'James tells the story of why he created James Reports and what the channel stands for.' },
    timelineIntro: 'Two decades on the biggest stories in Haiti and South Florida.',
    timeline: [
      { year: '2004', text: 'Protests in Haiti that forced President Aristide into exile' },
      { year: '2010', text: 'The earthquake that struck Haiti, and the cholera outbreak that followed' },
      { year: '2017', text: 'TPS for Haitians' },
      { year: '2021', text: 'Arrest of former Panamanian president Ricardo Martinelli' },
      { year: 'Now', text: 'James Reports: independent interviews and reporting' },
    ],
  },
  credits: {
    appearances: ['CNN en Español', 'MSNBC', 'NewsNation', 'Univision', 'Telemundo', 'NBC 6', 'CBS 4', 'PBS'],
    clients: ['FCC', 'Humana', 'FPL', 'DoorDash', 'Kay Jewelers', 'City National Bank', 'Conviva', 'Simple Mobile'],
  },
  about: {
    intro: '4-time Emmy Award-winning Haitian-American journalist, television producer and multilingual news anchor with more than 20 years of experience in broadcast journalism.',
    paragraphs: [
      'James has been featured on CNN en Español, MSNBC, NewsNation, Telemundo, Univision, Fox Sports, CBS 4, NBC 6, RT America and Canal 9 in Argentina. He was a contributor to the Rick Sanchez Show and Prohibido Callarse on Mira TV, and serves as TV producer and anchor at MDC-TV, where he hosts The Talk with James Pierre.',
      'He is fluent in English, French, Creole and Spanish. Beyond the newsroom, he hosts events for nonprofits and educational institutions and speaks to students across South Florida and the Caribbean.',
    ],
    facts: [
      { label: 'Awards', value: 'Emmy · Davey · Telly · Communicator' },
      { label: 'Education', value: 'B.S. Miami Dade College · M.A. St. Thomas University' },
      { label: 'Based in', value: 'Miami, Florida' },
    ],
  },
  watch: {
    channels: [
      { name: 'Latest', description: 'Newest episodes, back to back', guideLabel: 'James Reports: latest episodes', playlistId: UPLOADS_PLAYLIST, videoId: '', start: 0 },
      { name: 'Our Story', description: 'How James Reports began', guideLabel: 'The Story of James Reports', playlistId: '', videoId: 'Q_oljAV4Yfs', start: 31 },
      { name: 'English', description: 'English-language interviews', guideLabel: 'English interviews', playlistId: 'PLYsDWrWXrYqKp2pvk5Seg-r8A3Vic_XWo', videoId: '', start: 0 },
      { name: 'Promos', description: 'Highlights and trailers', guideLabel: 'Highlights & promos', playlistId: 'PLYsDWrWXrYqL0zJ9oXmqSS5nA3FM47R9Z', videoId: '', start: 0 },
    ],
    headlines: [
      'Welcome to James Reports TV',
      'Immigration · Politics · Haiti · Community',
      'New episode premieres Thursday at 8 PM ET',
      'Available in English, Français, Kreyòl and Español',
      'Support independent journalism at jamesreports.com/support',
    ],
    premiereTitle: 'Thursday · 8 PM ET',
    premiereSubtitle: 'New episode premiere',
  },
  podcast: {
    uploadsPlaylistId: UPLOADS_PLAYLIST,
    playlists: [
      { id: UPLOADS_PLAYLIST, label: 'Latest uploads' },
      { id: 'PLYsDWrWXrYqKp2pvk5Seg-r8A3Vic_XWo', label: 'English' },
      { id: 'PLYsDWrWXrYqL0zJ9oXmqSS5nA3FM47R9Z', label: 'Promos' },
    ],
  },
  images: {},
};

/** Merges stored documents over the defaults, key by key. */
export function mergeConfig(rows: Array<{ key: string; value: unknown }>): SiteConfig {
  const out: SiteConfig = structuredClone(DEFAULT_CONFIG);
  for (const r of rows) {
    if (r.key in out && r.value && typeof r.value === 'object') {
      (out as unknown as Record<string, unknown>)[r.key] = { ...(out as unknown as Record<string, object>)[r.key], ...(r.value as object) };
    }
  }
  return out;
}

/** Visible home sections in their saved order. */
export function visibleSections(cfg: SiteConfig): HomeSectionKey[] {
  return cfg.home.sections.filter((s) => s.visible).map((s) => s.key);
}
