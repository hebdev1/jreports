import { Archive, AudioLines, Clapperboard, Handshake, Newspaper, Video } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { FormSection, SelectField, TextAreaField, TextField } from '@/admin/components/form';
import { ListField } from '@/admin/components/list-field';
import { MediaField, MediaThumb } from '@/admin/components/media-picker';
import { Checkbox } from '@/admin/components/ui/checkbox';
import { Input } from '@/admin/components/ui/input';
import { useMediaByIds } from '@/admin/lib/data';
import { formatDay, todayIso } from '@/admin/lib/format';
import { LANG_CODES, TOPICS } from '@/lib/types';
import type { CollectionDef, ContentRow } from './framework';
import { isHttps, parseClock, slugify, toClock, youtubeId } from './helpers';

const TOPIC_OPTIONS = TOPICS.map((t) => ({ value: t, label: t }));
const LANG_OPTIONS = [
  { value: 'EN', label: 'English' },
  { value: 'FR', label: 'Français' },
  { value: 'KR', label: 'Kreyòl' },
  { value: 'ES', label: 'Español' },
];
const LANG_LABEL = Object.fromEntries(LANG_OPTIONS.map((o) => [o.value, o.label]));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CLOCK = /^(\d{1,2}:)?\d{1,3}:\d{2}$/;

// ================================================================ episodes

const episodeSchema = z
  .object({
    id: z.string().trim().min(1, 'Enter a URL slug.').max(80, 'Keep it under 80 characters.').regex(SLUG, 'Use lowercase letters, numbers and hyphens, e.g. ep-49.'),
    number: z.number({ error: 'Enter the episode number.' }).int('Use a whole number.').positive('Episode numbers start at 1.').max(100000),
    title: z.string().trim().min(1, 'Enter a title.').max(200, 'Keep the title under 200 characters.'),
    dek: z.string().trim().max(600, 'Keep the summary under 600 characters.'),
    guest: z.string().trim().max(200, 'Keep this under 200 characters.'),
    topic: z.enum(TOPICS, { error: 'Choose a topic.' }),
    language: z.enum(LANG_CODES, { error: 'Choose a language.' }),
    duration: z.string().trim().regex(CLOCK, 'Use minutes:seconds, e.g. 58:12, or h:mm:ss.').refine((v) => parseClock(v) > 0, 'Enter a duration longer than 0:00.'),
    published_on: z.string().regex(DAY, 'Choose the release date.'),
    youtube: z.string().trim().refine((v) => v === '' || youtubeId(v) !== null, 'Paste a YouTube video link or its 11-character ID.'),
    audio_url: z.string().trim().max(500).refine((v) => v === '' || isHttps(v), 'Use an https:// link to the audio file.'),
    chapters: z.array(z.object({ time: z.string().trim().regex(CLOCK, 'Use m:ss'), label: z.string().trim().min(1, 'Add a label.').max(120, 'Keep it under 120 characters.') })).max(30),
    image_id: z.string().nullable(),
    seo_title: z.string().trim().max(70, 'Search engines show about 70 characters.'),
    seo_description: z.string().trim().max(200, 'Keep it under 200 characters.'),
  })
  .superRefine((v, ctx) => {
    const total = parseClock(v.duration);
    v.chapters.forEach((c, i) => {
      const at = parseClock(c.time);
      if (!Number.isNaN(at) && !Number.isNaN(total) && at >= total) ctx.addIssue({ code: 'custom', path: ['chapters', i, 'time'], message: 'This is after the end of the episode.' });
    });
  });
type EpisodeForm = z.infer<typeof episodeSchema>;

interface EpisodeRow extends ContentRow {
  id: string;
  number: number;
  title: string;
  dek: string;
  guest: string;
  topic: (typeof TOPICS)[number];
  language: (typeof LANG_CODES)[number];
  duration_seconds: number;
  published_on: string;
  youtube_id: string | null;
  audio_url: string | null;
  chapters: Array<{ at: number; label: string }>;
  image_id: string | null;
  seo_title: string;
  seo_description: string;
}

function EpisodeFields({ form, disabled, isNew }: Readonly<{ form: UseFormReturn<EpisodeForm>; disabled: boolean; isNew: boolean }>) {
  const { control } = form;
  const chapters = useFieldArray({ control, name: 'chapters' });
  const number = useWatch({ control, name: 'number' });
  const youtube = useWatch({ control, name: 'youtube' });
  const parsedYt = youtube ? youtubeId(youtube) : null;

  // Suggest the slug from the episode number while creating.
  useEffect(() => {
    if (isNew && number && !form.getFieldState('id').isDirty) form.setValue('id', `ep-${number}`, { shouldValidate: false });
  }, [isNew, number, form]);

  return (
    <>
      <FormSection title="Episode">
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <TextField control={control} name="number" label="Number" type="number" inputMode="numeric" required disabled={disabled} />
          <TextField control={control} name="title" label="Title" required max={200} disabled={disabled} />
        </div>
        <TextAreaField control={control} name="dek" label="Summary" description="One or two sentences shown under the title." max={600} disabled={disabled} />
        <TextField control={control} name="guest" label="Guest line" description="E.g. “With an immigration attorney”." max={200} disabled={disabled} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField control={control} name="topic" label="Topic" required options={TOPIC_OPTIONS} disabled={disabled} />
          <SelectField control={control} name="language" label="Language" required options={LANG_OPTIONS} disabled={disabled} />
          <TextField control={control} name="published_on" label="Release date" type="date" required disabled={disabled} description="Episodes are listed newest first by this date." />
          <TextField control={control} name="duration" label="Duration" required placeholder="58:12" disabled={disabled} />
        </div>
        <TextField
          control={control}
          name="id"
          label="URL slug"
          required
          disabled={disabled || !isNew}
          description={isNew ? 'Used in the episode’s address: /episodes/your-slug. It can’t be changed after creation.' : `Address: /episodes/${form.getValues('id')}. Fixed after creation so shared links keep working.`}
        />
      </FormSection>

      <FormSection title="Watch and listen" description="Play buttons only appear on the site when the episode has a video or an audio file.">
        <TextField
          control={control}
          name="youtube"
          label="YouTube video"
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={disabled}
          description={parsedYt ? `Video ID: ${parsedYt}` : 'Paste the video link or ID. Leave empty if the episode isn’t on YouTube yet.'}
        />
        <TextField control={control} name="audio_url" label="Audio file (https link)" placeholder="https://…/episode.mp3" disabled={disabled} description="An MP3 or M4A URL. Enables the site’s audio player." />
        <ListField
          label="Chapters"
          description="Timestamps listed on the episode page. Visitors can jump to them when the episode has a video or audio."
          items={chapters.fields}
          getKey={(f) => f.id}
          max={30}
          addLabel="Add chapter"
          disabled={disabled}
          onAdd={() => chapters.append({ time: '', label: '' })}
          onRemove={chapters.remove}
          onMove={chapters.move}
          renderItem={(_, i) => (
            <div className="grid gap-2 sm:grid-cols-[100px_1fr]">
              <Controller
                control={control}
                name={`chapters.${i}.time`}
                render={({ field, fieldState }) => (
                  <div>
                    <Input {...field} placeholder="4:12" aria-label={`Chapter ${i + 1} time`} aria-invalid={Boolean(fieldState.error) || undefined} disabled={disabled} />
                    {fieldState.error && <p className="mt-1 text-[11px] text-destructive">{fieldState.error.message}</p>}
                  </div>
                )}
              />
              <Controller
                control={control}
                name={`chapters.${i}.label`}
                render={({ field, fieldState }) => (
                  <div>
                    <Input {...field} placeholder="Where things stand today" aria-label={`Chapter ${i + 1} label`} aria-invalid={Boolean(fieldState.error) || undefined} disabled={disabled} />
                    {fieldState.error && <p className="mt-1 text-[11px] text-destructive">{fieldState.error.message}</p>}
                  </div>
                )}
              />
            </div>
          )}
        />
      </FormSection>

      <FormSection title="Image">
        <Controller
          control={control}
          name="image_id"
          render={({ field }) => (
            <MediaField
              label="Episode image"
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
              description="Shown on the episode page. Without one, the default episode image (Brand & SEO → Page images) is used."
            />
          )}
        />
      </FormSection>

      <FormSection title="Search and sharing" description="Optional. Defaults to the episode title and summary.">
        <TextField control={control} name="seo_title" label="Search title" max={70} disabled={disabled} />
        <TextAreaField control={control} name="seo_description" label="Search description" max={200} rows={2} disabled={disabled} />
      </FormSection>
    </>
  );
}

export const episodesDef: CollectionDef<EpisodeForm, EpisodeRow> = {
  entity: 'episodes',
  singular: 'Episode',
  plural: 'Episodes',
  basePath: '/admin/episodes',
  description: 'Interviews shown on Home, Episodes and each episode page. Only published episodes are visible to visitors.',
  icon: Clapperboard,
  listSelect: 'id, number, title, guest, topic, language, published_on, youtube_id, audio_url, status, version, updated_at, published_at',
  idOf: (r) => r.id,
  titleOf: (r) => r.title,
  searchColumns: ['title', 'guest', 'id'],
  sorts: [
    { value: 'newest', label: 'Newest release', column: 'published_on', ascending: false },
    { value: 'number', label: 'Episode number', column: 'number', ascending: false },
    { value: 'updated', label: 'Recently edited', column: 'updated_at', ascending: false },
    { value: 'title', label: 'Title A–Z', column: 'title', ascending: true },
  ],
  filters: [
    { key: 'topic', label: 'Topic', options: TOPIC_OPTIONS },
    { key: 'language', label: 'Language', options: LANG_OPTIONS },
  ],
  columns: [
    {
      header: 'Episode',
      className: 'w-[40%]',
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">
            <span className="mr-1.5 text-muted-foreground">EP {r.number}</span>
            {r.title}
          </span>
          {r.guest && <span className="truncate text-xs font-normal text-muted-foreground">{r.guest}</span>}
        </span>
      ),
    },
    { header: 'Topic', className: 'hidden lg:table-cell', cell: (r) => r.topic },
    { header: 'Language', className: 'hidden lg:table-cell', cell: (r) => LANG_LABEL[r.language] },
    { header: 'Released', className: 'hidden sm:table-cell whitespace-nowrap', cell: (r) => formatDay(r.published_on) },
    {
      header: 'Media',
      className: 'hidden md:table-cell',
      cell: (r) =>
        r.youtube_id || r.audio_url ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {r.youtube_id && <Video className="size-4" aria-label="YouTube video" />}
            {r.audio_url && <AudioLines className="size-4" aria-label="Audio file" />}
          </span>
        ) : (
          <span className="text-xs text-warning">No video or audio</span>
        ),
    },
  ],
  schema: episodeSchema,
  empty: () => ({
    id: '', number: null as unknown as number, title: '', dek: '', guest: '', topic: 'Haiti', language: 'EN', duration: '', published_on: todayIso(),
    youtube: '', audio_url: '', chapters: [], image_id: null, seo_title: '', seo_description: '',
  }),
  fromRow: (r) => ({
    id: r.id, number: r.number, title: r.title, dek: r.dek ?? '', guest: r.guest ?? '', topic: r.topic, language: r.language,
    duration: toClock(r.duration_seconds), published_on: r.published_on, youtube: r.youtube_id ?? '', audio_url: r.audio_url ?? '',
    chapters: (r.chapters ?? []).map((c) => ({ time: toClock(c.at), label: c.label })), image_id: r.image_id ?? null,
    seo_title: r.seo_title ?? '', seo_description: r.seo_description ?? '',
  }),
  toRow: (f) => ({
    number: f.number, title: f.title.trim(), dek: f.dek.trim(), guest: f.guest.trim(), topic: f.topic, language: f.language,
    duration_seconds: parseClock(f.duration), published_on: f.published_on, youtube_id: f.youtube ? youtubeId(f.youtube) : null,
    audio_url: f.audio_url.trim() || null, chapters: f.chapters.map((c) => ({ at: parseClock(c.time), label: c.label.trim() })).sort((a, b) => a.at - b.at),
    image_id: f.image_id, seo_title: f.seo_title.trim(), seo_description: f.seo_description.trim(),
  }),
  makeId: (f) => f.id.trim(),
  Fields: EpisodeFields,
  publicUrl: (r) => `/episodes/${encodeURIComponent(r.id)}`,
  previewUrl: (id) => `/episodes/${encodeURIComponent(id)}?preview=1`,
};

// ================================================================= reports

const reportSchema = z.object({
  id: z.string().trim().min(1, 'Enter a slug.').max(120).regex(SLUG, 'Use lowercase letters, numbers and hyphens.'),
  title: z.string().trim().min(1, 'Enter a title.').max(200),
  dek: z.string().trim().max(600),
  topic: z.enum(TOPICS, { error: 'Choose a topic.' }),
  read_minutes: z.number({ error: 'Enter the reading time.' }).int().min(1, 'At least 1 minute.').max(120, 'At most 120 minutes.'),
  published_on: z.string().regex(DAY, 'Choose the publication date.'),
  url: z.string().trim().max(500).refine((v) => v === '' || isHttps(v), 'Use an https:// link.'),
});
type ReportForm = z.infer<typeof reportSchema>;

interface ReportRow extends ContentRow {
  id: string;
  title: string;
  dek: string;
  topic: (typeof TOPICS)[number];
  read_minutes: number;
  published_on: string;
  url: string | null;
}

function ReportFields({ form, disabled, isNew }: Readonly<{ form: UseFormReturn<ReportForm>; disabled: boolean; isNew: boolean }>) {
  const { control } = form;
  const title = useWatch({ control, name: 'title' });
  useEffect(() => {
    if (isNew && !form.getFieldState('id').isDirty) form.setValue('id', slugify(title ?? ''), { shouldValidate: false });
  }, [isNew, title, form]);
  return (
    <FormSection title="Report">
      <TextField control={control} name="title" label="Title" required max={200} disabled={disabled} />
      <TextAreaField control={control} name="dek" label="Summary" max={600} disabled={disabled} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField control={control} name="topic" label="Topic" required options={TOPIC_OPTIONS} disabled={disabled} />
        <TextField control={control} name="read_minutes" label="Reading time (minutes)" type="number" inputMode="numeric" required disabled={disabled} />
        <TextField control={control} name="published_on" label="Publication date" type="date" required disabled={disabled} />
      </div>
      <TextField control={control} name="url" label="Link to the full report" placeholder="https://…" disabled={disabled} description="Optional. With a link, the report’s title on the site opens it in a new tab." />
      <TextField control={control} name="id" label="Slug" required disabled={disabled || !isNew} description="Internal identifier, fixed after creation." />
    </FormSection>
  );
}

export const reportsDef: CollectionDef<ReportForm, ReportRow> = {
  entity: 'reports',
  singular: 'Report',
  plural: 'Reports',
  basePath: '/admin/reports',
  description: 'Written reporting shown on the Reports page and the four newest on Home.',
  icon: Newspaper,
  listSelect: 'id, title, topic, read_minutes, published_on, url, status, version, updated_at, published_at',
  idOf: (r) => r.id,
  titleOf: (r) => r.title,
  searchColumns: ['title', 'dek'],
  sorts: [
    { value: 'newest', label: 'Newest', column: 'published_on', ascending: false },
    { value: 'updated', label: 'Recently edited', column: 'updated_at', ascending: false },
    { value: 'title', label: 'Title A–Z', column: 'title', ascending: true },
  ],
  filters: [{ key: 'topic', label: 'Topic', options: TOPIC_OPTIONS }],
  columns: [
    { header: 'Report', className: 'w-[50%]', cell: (r) => r.title },
    { header: 'Topic', className: 'hidden md:table-cell', cell: (r) => r.topic },
    { header: 'Published', className: 'hidden sm:table-cell whitespace-nowrap', cell: (r) => formatDay(r.published_on) },
    { header: 'Read', className: 'hidden lg:table-cell', cell: (r) => `${r.read_minutes} min` },
  ],
  schema: reportSchema,
  empty: () => ({ id: '', title: '', dek: '', topic: 'Haiti', read_minutes: 5, published_on: todayIso(), url: '' }),
  fromRow: (r) => ({ id: r.id, title: r.title, dek: r.dek ?? '', topic: r.topic, read_minutes: r.read_minutes, published_on: r.published_on, url: r.url ?? '' }),
  toRow: (f) => ({ title: f.title.trim(), dek: f.dek.trim(), topic: f.topic, read_minutes: f.read_minutes, published_on: f.published_on, url: f.url.trim() || null }),
  makeId: (f) => f.id.trim(),
  Fields: ReportFields,
  publicUrl: () => '/reports',
};

// ================================================================= archive

const archiveSchema = z.object({
  name: z.string().trim().min(1, 'Enter the name or title.').max(160),
  show: z.string().trim().max(160),
  image_url: z.string().trim().max(500).refine(isHttps, 'Use an https:// image link, or choose an uploaded image.'),
  href: z.string().trim().max(500).refine(isHttps, 'Use an https:// link to the interview.'),
  sort_order: z.number({ error: 'Enter a position.' }).int().min(0).max(100000),
});
type ArchiveForm = z.infer<typeof archiveSchema>;

interface ArchiveRow extends ContentRow {
  id: number;
  name: string;
  show: string;
  image_url: string;
  href: string;
  sort_order: number;
}

function ArchiveFields({ form, disabled }: Readonly<{ form: UseFormReturn<ArchiveForm>; disabled: boolean; isNew: boolean }>) {
  const { control } = form;
  const imageUrl = useWatch({ control, name: 'image_url' });
  return (
    <FormSection title="Interview">
      <TextField control={control} name="name" label="Guest or title" required max={160} disabled={disabled} />
      <TextField control={control} name="show" label="Show" placeholder="The Talk with James Pierre" max={160} disabled={disabled} />
      <TextField control={control} name="href" label="Link to the interview" required placeholder="https://www.jamespierre.com/…" disabled={disabled} />
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <TextField control={control} name="image_url" label="Image link" required placeholder="https://…" disabled={disabled} description="Paste an https image link, e.g. from jamespierre.com." />
        <div className="overflow-hidden rounded-lg border" style={{ aspectRatio: '4 / 3' }}>
          <MediaThumb asset={isHttps(imageUrl ?? '') ? { url: imageUrl, alt: '' } : null} className="size-full" alt="Preview of the image link" />
        </div>
      </div>
      <TextField control={control} name="sort_order" label="Display position" type="number" inputMode="numeric" required disabled={disabled} description="Lower numbers appear first. You can also reorder from the list." />
    </FormSection>
  );
}

export const archiveDef: CollectionDef<ArchiveForm, ArchiveRow> = {
  entity: 'archive_items',
  singular: 'Archive interview',
  plural: 'Archive',
  basePath: '/admin/archive',
  description: 'Past interviews (The Talk, WPBT2, PBS Miami) linking to jamespierre.com. The first five appear on Home.',
  icon: Archive,
  listSelect: 'id, name, show, image_url, href, sort_order, status, version, updated_at, published_at',
  idOf: (r) => String(r.id),
  titleOf: (r) => r.name,
  searchColumns: ['name', 'show'],
  sorts: [
    { value: 'order', label: 'Display order', column: 'sort_order', ascending: true },
    { value: 'updated', label: 'Recently edited', column: 'updated_at', ascending: false },
    { value: 'name', label: 'Name A–Z', column: 'name', ascending: true },
  ],
  columns: [
    {
      header: 'Interview',
      className: 'w-[55%]',
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <MediaThumb asset={{ url: r.image_url, alt: '' }} className="h-9 w-12 shrink-0 rounded" alt="" />
          <span className="truncate">{r.name}</span>
        </span>
      ),
    },
    { header: 'Show', className: 'hidden md:table-cell', cell: (r) => r.show },
    { header: 'Position', className: 'hidden sm:table-cell tabular-nums', cell: (r) => r.sort_order },
  ],
  schema: archiveSchema,
  empty: () => ({ name: '', show: '', image_url: '', href: '', sort_order: 100 }),
  fromRow: (r) => ({ name: r.name, show: r.show ?? '', image_url: r.image_url, href: r.href, sort_order: r.sort_order }),
  toRow: (f) => ({ name: f.name.trim(), show: f.show.trim(), image_url: f.image_url.trim(), href: f.href.trim(), sort_order: f.sort_order }),
  Fields: ArchiveFields,
  publicUrl: () => '/archive',
  ordered: true,
};

// ================================================================ sponsors

const PLACEMENTS = [
  { value: 'home_feature', label: 'Sponsor card', description: 'Full-width card with the sponsor image, phone and website (Home).' },
  { value: 'home_thanks', label: 'Thank-you block', description: '“Our sponsors” block with the name, thank-you text and a photo (Home).' },
] as const;

const sponsorSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter the sponsor’s name.').max(120),
    name_accent: z.string().trim().max(60),
    tagline: z.string().trim().max(200),
    website_url: z.string().trim().max(500).refine((v) => v === '' || isHttps(v), 'Use an https:// link.'),
    phone: z.string().trim().max(40).refine((v) => v === '' || /^[+()\d\s.-]{7,40}$/.test(v), 'Enter a valid phone number.'),
    image_id: z.string().nullable(),
    thanks_text: z.string().trim().max(400),
    thanks_image_id: z.string().nullable(),
    placements: z.array(z.enum(['home_feature', 'home_thanks'])),
    sort_order: z.number({ error: 'Enter a position.' }).int().min(0).max(100000),
  })
  .superRefine((v, ctx) => {
    if (v.name_accent && !v.name.endsWith(v.name_accent)) ctx.addIssue({ code: 'custom', path: ['name_accent'], message: 'Must be the end of the name, e.g. “Nurses” for FowenNurses.' });
    if (v.placements.includes('home_feature') && !v.image_id) ctx.addIssue({ code: 'custom', path: ['image_id'], message: 'The sponsor card needs an image.' });
    if (v.placements.includes('home_thanks') && !v.thanks_text) ctx.addIssue({ code: 'custom', path: ['thanks_text'], message: 'The thank-you block needs a message.' });
  });
type SponsorForm = z.infer<typeof sponsorSchema>;

interface SponsorRow extends ContentRow {
  id: string;
  name: string;
  name_accent: string;
  tagline: string;
  website_url: string | null;
  phone: string;
  image_id: string | null;
  thanks_text: string;
  thanks_image_id: string | null;
  placements: Array<'home_feature' | 'home_thanks'>;
  sort_order: number;
}

function SponsorFields({ form, disabled }: Readonly<{ form: UseFormReturn<SponsorForm>; disabled: boolean; isNew: boolean }>) {
  const { control } = form;
  return (
    <>
      <FormSection title="Sponsor">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <TextField control={control} name="name" label="Name" required max={120} disabled={disabled} />
          <TextField control={control} name="name_accent" label="Accent ending" max={60} disabled={disabled} description="Shown in red, e.g. “Nurses”." />
        </div>
        <TextField control={control} name="tagline" label="Tagline" max={200} disabled={disabled} description="E.g. “NCLEX preparation · 2,300+ nurses trained”." />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField control={control} name="website_url" label="Website" placeholder="https://…" disabled={disabled} />
          <TextField control={control} name="phone" label="Phone" type="tel" disabled={disabled} />
        </div>
      </FormSection>
      <FormSection title="Where it appears">
        <Controller
          control={control}
          name="placements"
          render={({ field }) => (
            <div role="group" aria-label="Placements" className="grid gap-2">
              {PLACEMENTS.map((p) => {
                const checked = field.value.includes(p.value);
                return (
                  <label key={p.value} className="flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(v) => field.onChange(v ? [...field.value, p.value] : field.value.filter((x) => x !== p.value))}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-[13px] font-medium">{p.label}</span>
                      <span className="block text-[12px] text-muted-foreground">{p.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        />
        <TextField control={control} name="sort_order" label="Display position" type="number" inputMode="numeric" required disabled={disabled} description="Lower numbers appear first when several sponsors share a placement." />
      </FormSection>
      <FormSection title="Sponsor card">
        <Controller
          control={control}
          name="image_id"
          render={({ field, fieldState }) => (
            <div>
              <MediaField label="Card image" value={field.value} onChange={field.onChange} disabled={disabled} aspect="3162 / 1796" description="Shown at its own proportions, never cropped." />
              {fieldState.error && <p className="mt-1 text-[12px] font-medium text-destructive">{fieldState.error.message}</p>}
            </div>
          )}
        />
      </FormSection>
      <FormSection title="Thank-you block">
        <TextAreaField control={control} name="thanks_text" label="Thank-you message" max={400} disabled={disabled} />
        <Controller
          control={control}
          name="thanks_image_id"
          render={({ field }) => <MediaField label="Photo" value={field.value} onChange={field.onChange} disabled={disabled} aspect="16 / 9" />}
        />
      </FormSection>
    </>
  );
}

/** Mirrors the public site's sponsor card and thank-you block. */
function SponsorPreview({ values }: Readonly<{ values: SponsorForm }>) {
  const media = useMediaByIds([values.image_id, values.thanks_image_id]);
  const card = values.image_id ? media.data?.[values.image_id] : null;
  const thanks = values.thanks_image_id ? media.data?.[values.thanks_image_id] : null;
  const head = values.name_accent && values.name.endsWith(values.name_accent) ? values.name.slice(0, -values.name_accent.length) : values.name;
  return (
    <div className="grid gap-8">
      {values.placements.includes('home_feature') ? (
        <div className="overflow-hidden rounded-[20px] bg-[#050B22] text-white">
          <div className="relative" style={{ aspectRatio: card?.width && card.height ? `${card.width} / ${card.height}` : '3162 / 1796' }}>
            <MediaThumb asset={card} className="absolute inset-0 size-full object-cover" />
            <span className="absolute right-3 top-3 rounded border border-white/30 bg-[#050B22]/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">Sponsor</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-[#081230] px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold uppercase tracking-wide">{values.name || 'Sponsor name'}</p>
              <p className="text-[13px] text-[#C3CCE6]">{values.tagline}</p>
            </div>
            {values.phone && <span className="text-sm font-semibold">{values.phone}</span>}
            {values.website_url && <span className="rounded-full bg-[#D21034] px-4 py-2 text-[13px] font-semibold">Visit {values.website_url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not shown as a sponsor card.</p>
      )}
      {values.placements.includes('home_thanks') ? (
        <div className="grid gap-4 rounded-xl border bg-white p-5 text-[#0B1F5C] sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#D21034]">Our sponsors</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none">
              {head}
              <span className="text-[#D21034]">{values.name_accent && values.name.endsWith(values.name_accent) ? values.name_accent : ''}</span>
            </p>
            <p className="mt-3 text-sm text-[#4A5578]">{values.thanks_text}</p>
          </div>
          <div className="overflow-hidden rounded-xl" style={{ aspectRatio: '16 / 9' }}>
            <MediaThumb asset={thanks} className="size-full object-cover" />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not shown in the thank-you block.</p>
      )}
    </div>
  );
}

export const sponsorsDef: CollectionDef<SponsorForm, SponsorRow> = {
  entity: 'sponsors',
  singular: 'Sponsor',
  plural: 'Sponsors',
  basePath: '/admin/sponsors',
  description: 'Sponsors shown on the home page, as a full sponsor card and/or in the thank-you block.',
  icon: Handshake,
  listSelect: 'id, name, tagline, placements, sort_order, image_id, status, version, updated_at, published_at',
  idOf: (r) => r.id,
  titleOf: (r) => r.name,
  searchColumns: ['name', 'tagline'],
  sorts: [
    { value: 'order', label: 'Display order', column: 'sort_order', ascending: true },
    { value: 'updated', label: 'Recently edited', column: 'updated_at', ascending: false },
    { value: 'name', label: 'Name A–Z', column: 'name', ascending: true },
  ],
  columns: [
    { header: 'Sponsor', className: 'w-[40%]', cell: (r) => r.name },
    {
      header: 'Placements',
      className: 'hidden md:table-cell',
      cell: (r) => (r.placements?.length ? r.placements.map((p) => PLACEMENTS.find((x) => x.value === p)?.label).join(', ') : <span className="text-warning">Not placed</span>),
    },
    { header: 'Position', className: 'hidden sm:table-cell tabular-nums', cell: (r) => r.sort_order },
  ],
  schema: sponsorSchema,
  empty: () => ({ name: '', name_accent: '', tagline: '', website_url: '', phone: '', image_id: null, thanks_text: '', thanks_image_id: null, placements: [], sort_order: 10 }),
  fromRow: (r) => ({
    name: r.name, name_accent: r.name_accent ?? '', tagline: r.tagline ?? '', website_url: r.website_url ?? '', phone: r.phone ?? '',
    image_id: r.image_id, thanks_text: r.thanks_text ?? '', thanks_image_id: r.thanks_image_id, placements: r.placements ?? [], sort_order: r.sort_order,
  }),
  toRow: (f) => ({
    name: f.name.trim(), name_accent: f.name_accent.trim(), tagline: f.tagline.trim(), website_url: f.website_url.trim() || null, phone: f.phone.trim(),
    image_id: f.image_id, thanks_text: f.thanks_text.trim(), thanks_image_id: f.thanks_image_id, placements: f.placements, sort_order: f.sort_order,
  }),
  Fields: SponsorFields,
  Preview: SponsorPreview,
  publicUrl: () => '/',
  ordered: true,
};

