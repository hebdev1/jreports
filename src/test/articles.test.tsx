import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RichText } from '../components/RichText';
import * as api from '../lib/api';
import { clearResourceCache } from '../lib/resource';
import { hasText, readMinutes, safeHref, safeImageSrc, youtubeIdFromSrc, type RichDoc } from '../lib/richtext';
import { DEFAULT_CONFIG } from '../lib/siteConfig';
import type { Episode, Report, ReportArticle } from '../lib/types';
import { routes } from '../router';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    fetchEpisodes: vi.fn(),
    fetchReports: vi.fn(),
    fetchReport: vi.fn(),
    fetchArchive: vi.fn(async () => []),
    fetchSponsors: vi.fn(async () => []),
    fetchSiteConfig: vi.fn(async () => ({ config: structuredClone(DEFAULT_CONFIG), media: {} })),
  };
});

const DOC: RichDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What changed' }] },
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [
        { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'a source', marks: [{ type: 'link', attrs: { href: 'https://www.uscis.gov' } }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'bad link', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
      ],
    },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First point' }] }] }] },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A quote' }] }] },
    { type: 'image', attrs: { src: 'https://x.supabase.co/storage/v1/object/public/media/a.jpg', alt: 'A crowd in Miami' } },
    { type: 'image', attrs: { src: 'data:image/svg+xml,<svg onload=alert(1)>', alt: 'nope' } },
    { type: 'youtube', attrs: { src: 'https://www.youtube.com/watch?v=Q_oljAV4Yfs' } },
    { type: 'mysteryWidget', content: [{ type: 'text', text: 'Kept text' }] },
    { type: 'horizontalRule' },
  ],
};

describe('article text helpers', () => {
  it('counts reading time and checks links, images and videos', () => {
    const words = Array.from({ length: 660 }, () => 'mo').join(' ');
    expect(readMinutes({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: words }] }] })).toBe(3);
    expect(readMinutes({ type: 'doc' })).toBe(1);
    expect(hasText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(false);
    expect(hasText(DOC)).toBe(true);
    expect(safeHref('https://a.com')).toBe('https://a.com');
    expect(safeHref('mailto:ads@jamesreports.com')).toBe('mailto:ads@jamesreports.com');
    expect(safeHref('/episodes/ep-48')).toBe('/episodes/ep-48');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('//evil.example')).toBeNull();
    expect(safeImageSrc('/assets/keyart.png')).toBe('/assets/keyart.png');
    expect(safeImageSrc('http://insecure.example/a.jpg')).toBeNull();
    expect(youtubeIdFromSrc('https://youtu.be/Q_oljAV4Yfs')).toBe('Q_oljAV4Yfs');
    expect(youtubeIdFromSrc('https://www.youtube-nocookie.com/embed/Q_oljAV4Yfs?rel=0')).toBe('Q_oljAV4Yfs');
    expect(youtubeIdFromSrc('https://vimeo.com/1')).toBeNull();
  });
});

describe('article renderer', () => {
  it('draws the formatting it knows and drops anything unsafe', () => {
    const { container } = render(<RichText doc={DOC} />);
    expect(screen.getByRole('heading', { level: 2, name: 'What changed' })).toBeInTheDocument();
    expect(screen.getByText('Bold').tagName).toBe('STRONG');
    expect(screen.getByText('Bold').closest('p')).toHaveStyle({ textAlign: 'center' });
    expect(screen.getByRole('link', { name: /a source/ })).toHaveAttribute('href', 'https://www.uscis.gov');
    expect(screen.getByText('Bold').closest('p')).toHaveTextContent('and bad link');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent('First point');
    expect(container.querySelector('blockquote')).toHaveTextContent('A quote');
    expect(screen.getByRole('img', { name: 'A crowd in Miami' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'nope' })).not.toBeInTheDocument();
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain('youtube-nocookie.com/embed/Q_oljAV4Yfs');
    expect(screen.getByText('Kept text')).toBeInTheDocument();
    expect(container.querySelector('hr')).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/javascript:|onload=/);
  });
});

const REPORT: Report = { id: 'tps-explained', topic: 'Immigration', title: 'TPS, explained', dek: 'What the decision means.', readMinutes: 3, publishedOn: '2026-11-02', url: 'https://example.org/tps', hasArticle: true, author: 'James Pierre', image: null };
const OLD: Report = { id: 'old-link', topic: 'Haiti', title: 'An older piece', dek: '', readMinutes: 5, publishedOn: '2026-01-02', url: 'https://example.org/old', hasArticle: false, author: '', image: null };
const ARTICLE: ReportArticle = { ...REPORT, body: DOC, seoTitle: '', seoDescription: 'Search text' };

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  clearResourceCache();
  vi.mocked(api.fetchEpisodes).mockReset().mockResolvedValue([]);
  vi.mocked(api.fetchReports).mockReset().mockResolvedValue([REPORT, OLD]);
  vi.mocked(api.fetchReport).mockReset().mockResolvedValue(ARTICLE);
});

describe('report pages', () => {
  it('links articles to their own page and older reports to the original', async () => {
    renderAt('/reports');
    const main = within(await screen.findByRole('main'));
    expect(await main.findByRole('link', { name: 'TPS, explained' })).toHaveAttribute('href', '/reports/tps-explained');
    expect(main.getByRole('link', { name: /An older piece/ })).toHaveAttribute('href', 'https://example.org/old');
    expect(main.getByText(/By James Pierre · 3 min read/)).toBeInTheDocument();
  });

  it('shows the article with byline, text and the original link', async () => {
    renderAt('/reports/tps-explained');
    expect(await screen.findByRole('heading', { level: 1, name: 'TPS, explained' })).toBeInTheDocument();
    expect(screen.getByText('By James Pierre')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'What changed' })).toBeInTheDocument();
    expect(screen.getByText('Originally published at').closest('p')).toHaveTextContent('example.org');
    expect(api.fetchReport).toHaveBeenCalledWith('tps-explained');
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', 'Search text');
  });

  it('says so when the report does not exist', async () => {
    vi.mocked(api.fetchReport).mockResolvedValue(null);
    renderAt('/reports/missing');
    expect(await screen.findByRole('heading', { name: 'We couldn’t find that report.' })).toBeInTheDocument();
  });

  it('keeps report previews for the team', async () => {
    localStorage.removeItem('jr-admin-auth');
    renderAt('/reports/tps-explained?preview=1');
    expect(await screen.findByRole('heading', { name: 'Sign in to preview' })).toBeInTheDocument();
    expect(api.fetchReport).not.toHaveBeenCalled();
  });
});

describe('uploaded episode video', () => {
  const EP: Episode = {
    id: 'ep-50', number: 50, title: 'With a video', dek: '', guest: '', topic: 'Haiti', language: 'EN', durationSeconds: 600, publishedOn: '2026-11-01',
    youtubeId: 'Q_oljAV4Yfs', audioUrl: null, chapters: [{ at: 120, label: 'Second part' }], image: null,
    video: { id: 'v1', source: 'storage', url: 'https://x.supabase.co/storage/v1/object/public/videos/uploads/ep50.mp4', alt: 'Episode 50', width: 1920, height: 1080, mime_type: 'video/mp4' },
  };

  it('plays on the page, ahead of YouTube, and chapters jump inside it', async () => {
    vi.mocked(api.fetchEpisodes).mockResolvedValue([EP]);
    const user = userEvent.setup();
    renderAt('/episodes/ep-50');
    await user.click(await screen.findByRole('button', { name: 'Watch EP 50' }));
    const video = document.querySelector('video');
    expect(video).toHaveAttribute('src', EP.video!.url);
    expect(document.querySelector('iframe[src*="youtube"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Watch on YouTube' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=Q_oljAV4Yfs');
    await user.click(screen.getByRole('button', { name: /Second part/ }));
    expect(video!.currentTime).toBe(120);
  });
});
