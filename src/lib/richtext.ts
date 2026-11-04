// Report articles are stored as TipTap / ProseMirror JSON (reports.body).
// The admin edits them with TipTap; the public site renders them with
// components/RichText.tsx from this whitelist, never as raw HTML.

export interface RichMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: RichMark[];
  text?: string;
}

export interface RichDoc extends RichNode {
  type: 'doc';
  content?: RichNode[];
}

export function isRichDoc(v: unknown): v is RichDoc {
  return typeof v === 'object' && v !== null && (v as RichNode).type === 'doc';
}

/** Plain text of a document, blocks separated by spaces. */
export function docText(node: RichNode | null | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(docText).join(' ');
}

export function wordCount(doc: RichNode | null | undefined): number {
  const t = docText(doc).trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Reading time at 220 words a minute, at least 1 minute. */
export function readMinutes(doc: RichNode | null | undefined): number {
  return Math.max(1, Math.round(wordCount(doc) / 220));
}

export function hasText(doc: RichNode | null | undefined): boolean {
  return wordCount(doc) > 0 || JSON.stringify(doc ?? {}).includes('"type":"image"') || JSON.stringify(doc ?? {}).includes('"type":"youtube"');
}

/** Links may only go to web pages, email addresses or pages on this site. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== 'string') return null;
  const h = href.trim();
  if (/^(https?:\/\/|mailto:)/i.test(h)) return h;
  if (/^\/(?!\/)/.test(h)) return h;
  return null;
}

/** Article images come from the media library: https uploads or the site's /assets. */
export function safeImageSrc(src: unknown): string | null {
  if (typeof src !== 'string') return null;
  return /^(https:\/\/|\/assets\/)/.test(src.trim()) ? src.trim() : null;
}

/** The 11-character id from any YouTube link the editor accepted. */
export function youtubeIdFromSrc(src: unknown): string | null {
  if (typeof src !== 'string') return null;
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/.exec(src);
  return m ? m[1] : /^[A-Za-z0-9_-]{11}$/.test(src) ? src : null;
}
