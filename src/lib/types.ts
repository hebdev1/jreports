export const TOPICS = ['Haiti', 'Immigration', 'Politics', 'Community', 'Culture', 'Sports', 'Entertainment'] as const;
export type Topic = (typeof TOPICS)[number];

export const LANG_CODES = ['EN', 'FR', 'KR', 'ES'] as const;
export type LangCode = (typeof LANG_CODES)[number];

export const LANGUAGES = ['English', 'Français', 'Kreyòl', 'Español'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface Chapter {
  at: number; // seconds from the start
  label: string;
}

export interface Episode {
  id: string;
  number: number;
  title: string;
  dek: string;
  guest: string;
  topic: Topic;
  language: LangCode;
  durationSeconds: number;
  publishedOn: string; // ISO date
  youtubeId: string | null;
  audioUrl: string | null;
  chapters: Chapter[];
}

export interface Report {
  id: string;
  topic: Topic;
  title: string;
  dek: string;
  readMinutes: number;
  publishedOn: string;
  url: string | null;
}

export interface ArchiveItem {
  id: number;
  name: string;
  show: string;
  imageUrl: string;
  href: string;
}

export interface SiteSettings {
  showTicker: boolean;
  tickerText: string;
  tickerLinkUrl: string;
  monthlyGoalCents: number | null;
  raisedCents: number | null;
  supportersCount: number | null;
}
