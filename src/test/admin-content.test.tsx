import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportsDef } from '@/admin/collections/defs';
import { RichTextEditor } from '@/admin/components/rich-text-editor';
import { useAuth } from '@/admin/lib/auth';
import { bucketOf, kindOfFile, MAX_VIDEO_BYTES, validateMediaFile, validateVideoFile } from '@/admin/lib/data';
import { resumableUploadUrl } from '@/admin/lib/supabase';
import type { RichDoc } from '@/lib/richtext';

vi.mock('@/admin/lib/auth', () => ({ useAuth: vi.fn() }));

const file = (name: string, type: string, size = 1000) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('media files', () => {
  it('sorts uploads into images and videos with their own limits', () => {
    expect(kindOfFile(file('a.jpg', 'image/jpeg'))).toBe('image');
    expect(kindOfFile(file('ep.mp4', 'video/mp4'))).toBe('video');
    expect(kindOfFile(file('ep.mov', 'video/quicktime'))).toBe('video');
    expect(kindOfFile(file('doc.pdf', 'application/pdf'))).toBeNull();
    expect(bucketOf('video')).toBe('videos');
    expect(bucketOf('image')).toBe('media');
    expect(validateMediaFile(file('doc.pdf', 'application/pdf'))).toMatch(/isn’t a supported file/);
    expect(validateMediaFile(file('big.jpg', 'image/jpeg', 11 * 1024 * 1024))).toMatch(/larger than 10 MB/);
    expect(validateMediaFile(file('ep.mp4', 'video/mp4', 2 * 1024 * 1024 * 1024))).toBeNull();
    expect(validateVideoFile(file('huge.mp4', 'video/mp4', MAX_VIDEO_BYTES + 1))).toMatch(/larger than 5 GB/);
    expect(validateVideoFile(file('clip.avi', 'video/x-msvideo'))).toMatch(/isn’t a supported video/);
  });

  it('sends large uploads to the direct storage host', () => {
    expect(resumableUploadUrl('https://abc.supabase.co')).toBe('https://abc.storage.supabase.co/storage/v1/upload/resumable');
    expect(resumableUploadUrl('https://api.jamesreports.com')).toBe('https://api.jamesreports.com/storage/v1/upload/resumable');
  });
});

const BODY: RichDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The decision' }] },
    { type: 'paragraph', content: [{ type: 'text', text: Array.from({ length: 450 }, () => 'word').join(' ') }] },
  ],
};

describe('report articles', () => {
  const base = { ...reportsDef.empty(), id: 'tps-explained', title: 'TPS, explained' };

  it('accepts a report without article text, and rejects text that is too long', () => {
    expect(reportsDef.schema.safeParse(base).success).toBe(true);
    const huge: RichDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(950_000) }] }] };
    const r = reportsDef.schema.safeParse({ ...base, body: huge });
    expect(r.success).toBe(false);
    expect(reportsDef.schema.safeParse({ ...base, body: { type: 'not-a-doc' } }).success).toBe(false);
  });

  it('saves the reading time from the text and drops an empty article', () => {
    expect(reportsDef.toRow({ ...base, body: BODY, read_minutes: 30 })).toMatchObject({ read_minutes: 2, body: BODY });
    expect(reportsDef.toRow({ ...base, body: { type: 'doc', content: [{ type: 'paragraph' }] }, read_minutes: 4 })).toMatchObject({ read_minutes: 4, body: null });
    expect(reportsDef.publicUrl?.({ id: 'tps-explained' } as never)).toBe('/reports/tps-explained');
  });
});

describe('article editor', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ status: 'ready', session: null, member: null, error: null, can: () => true, signOut: vi.fn(), reload: vi.fn() } as never);
  });

  it('shows the saved text, the formatting tools and the reading time', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RichTextEditor label="Article text" value={BODY} onChange={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { level: 2, name: 'The decision' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Article text' })).toBeInTheDocument();
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' });
    for (const name of ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Highlight', 'Link', 'Bulleted list', 'Numbered list', 'Quote', 'Insert image', 'Embed a YouTube video', 'Center']) {
      expect(toolbar.querySelector(`[aria-label="${name}"]`), name).not.toBeNull();
    }
    expect(screen.getByText(/452 words · about 2 min read/)).toBeInTheDocument();
  });

  it('becomes read-only for people who can’t edit', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RichTextEditor label="Article text" value={BODY} onChange={vi.fn()} disabled />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('textbox', { name: 'Article text' })).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();
  });
});
