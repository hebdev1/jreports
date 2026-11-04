import type { RichDoc } from './richtext';

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
  image?: PublicMedia | null;
  /** An uploaded video file, played on the episode page. */
  video?: PublicMedia | null;
  seoTitle?: string;
  seoDescription?: string;
}

export interface Report {
  id: string;
  topic: Topic;
  title: string;
  dek: string;
  readMinutes: number;
  publishedOn: string;
  url: string | null;
  /** True when the report has its own article page with full text. */
  hasArticle?: boolean;
  author?: string;
  image?: PublicMedia | null;
}

/** A report with its article text, for /reports/:id. */
export interface ReportArticle extends Report {
  body: RichDoc | null;
  seoTitle: string;
  seoDescription: string;
}

export interface ArchiveItem {
  id: number;
  name: string;
  show: string;
  imageUrl: string;
  href: string;
}

/** An image from the media library (the admin's "Media" section). */
export interface PublicMedia {
  id: string;
  source: 'bundled' | 'storage';
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  mime_type?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  /** Trailing part of the name shown in red, e.g. "Nurses" in FowenNurses. */
  nameAccent: string;
  tagline: string;
  websiteUrl: string | null;
  phone: string;
  image: PublicMedia | null;
  thanksText: string;
  thanksImage: PublicMedia | null;
  placements: Array<'home_feature' | 'home_thanks'>;
}
