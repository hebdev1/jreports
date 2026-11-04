import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Eye, EyeOff, Loader2, RotateCcw, Save } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type Control, type DefaultValues, type FieldValues, type Resolver, type UseFormReturn } from 'react-hook-form';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { playlistId, youtubeId } from '@/admin/collections/helpers';
import { ErrorState, LoadingBlock, Page, PageHeader, useConfirm, usePageTitle, useUnsavedGuard } from '@/admin/components/common';
import { SelectField, SwitchField, TextAreaField, TextField } from '@/admin/components/form';
import { ListField } from '@/admin/components/list-field';
import { MediaField } from '@/admin/components/media-picker';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Switch } from '@/admin/components/ui/switch';
import { useAuth } from '@/admin/lib/auth';
import { useSaveConfig, useSiteConfig } from '@/admin/lib/data';
import { toAdminError } from '@/admin/lib/errors';
import { timeAgo } from '@/admin/lib/format';
import { DEFAULT_CONFIG, HOME_SECTIONS, IMAGE_SLOTS, type ConfigKey, type HomeSectionKey, type SiteConfig } from '@/lib/siteConfig';

const httpsOrEmpty = z.string().trim().max(500).refine((v) => v === '' || /^https:\/\/\S+$/.test(v), 'Use an https:// link, or leave it empty.');
const email = z.string().trim().min(1, 'Enter an email address.').email('Enter a valid email address.');
const NAV_HREF = /^(\/[A-Za-z0-9/_?=&#-]*|https:\/\/\S+)$/;

// --------------------------------------------------------- dirty registry

const DirtyContext = createContext<(key: string, dirty: boolean) => void>(() => {});

/** One unsaved-changes guard for a page holding several settings forms. */
function SettingsPage({ title, description, children }: Readonly<{ title: string; description: string; children: ReactNode }>) {
  usePageTitle(title);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const report = useCallback((key: string, d: boolean) => setDirty((s) => (s[key] === d ? s : { ...s, [key]: d })), []);
  useUnsavedGuard(Object.values(dirty).some(Boolean));
  const { can } = useAuth();
  const config = useSiteConfig();
  return (
    <Page width="narrow">
      <PageHeader title={title} description={description} />
      {!can('manage_settings') && <p className="mb-5 rounded-xl border bg-muted px-4 py-3 text-sm text-muted-foreground">Only admins and owners can change site settings. You can view them here.</p>}
      {config.isPending ? (
        <LoadingBlock rows={8} />
      ) : config.isError ? (
        <ErrorState error={config.error} onRetry={() => void config.refetch()} />
      ) : (
        <DirtyContext.Provider value={report}>
          <div className="grid gap-6">{children}</div>
        </DirtyContext.Provider>
      )}
    </Page>
  );
}

// ------------------------------------------------------------ config form

interface ConfigFormProps<K extends ConfigKey, F extends FieldValues> {
  configKey: K;
  title: string;
  description?: ReactNode;
  schema: z.ZodType<F>;
  toForm: (v: SiteConfig[K]) => F;
  fromForm: (f: F, previous: SiteConfig[K]) => SiteConfig[K];
  children: (form: UseFormReturn<F>, disabled: boolean) => ReactNode;
  viewOnSite?: string;
  id?: string;
}

function ConfigForm<K extends ConfigKey, F extends FieldValues>({ configKey, title, description, schema, toForm, fromForm, children, viewOnSite, id }: Readonly<ConfigFormProps<K, F>>) {
  const { can } = useAuth();
  const confirm = useConfirm();
  const report = useContext(DirtyContext);
  const config = useSiteConfig();
  const save = useSaveConfig(configKey);
  const [conflict, setConflict] = useState<string | null>(null);
  const row = config.data?.rows[configKey];
  const value = config.data!.config[configKey];
  const initial = useMemo(() => toForm(value), [value, toForm]);
  const form = useForm<F>({ resolver: zodResolver(schema as never) as unknown as Resolver<F>, defaultValues: initial as DefaultValues<F>, mode: 'onTouched' });
  const disabled = !can('manage_settings') || save.isPending;

  useEffect(() => {
    form.reset(initial);
  }, [initial, form]);
  useEffect(() => {
    report(configKey, form.formState.isDirty);
  }, [form.formState.isDirty, configKey, report]);

  const onSubmit = form.handleSubmit(async (f) => {
    if (!row) {
      toast.error('These settings haven’t been set up in the database.');
      return;
    }
    try {
      await save.mutateAsync({ value: fromForm(f, value), version: row.version });
      setConflict(null);
      toast.success(`${title} saved. The website shows the change on the next page load.`);
    } catch (err) {
      const e = toAdminError(err);
      if (e.kind === 'conflict') setConflict(e.message);
      else toast.error(e.message);
    }
  });

  const resetDefaults = async () => {
    const ok = await confirm({ title: `Reset “${title}” to the original values?`, description: 'The form is filled with the values the site launched with. Nothing changes on the site until you save.', confirmLabel: 'Fill in defaults' });
    if (ok) form.reset(toForm(DEFAULT_CONFIG[configKey]), { keepDefaultValues: true });
  };

  return (
    <section id={id} aria-labelledby={`cfg-${configKey}`} className="scroll-mt-20 rounded-xl border bg-card shadow-[0_1px_2px_rgba(11,31,92,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 id={`cfg-${configKey}`} className="text-[15px] font-semibold">
            {title}
          </h2>
          {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {viewOnSite && (
          <Button variant="ghost" size="sm" asChild>
            <a href={viewOnSite} target="_blank" rel="noopener">
              View on site <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        )}
      </div>
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={disabled} className="grid gap-5 p-5">
          <legend className="sr-only">{title}</legend>
          {conflict && (
            <div role="alert" className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm sm:flex-row sm:items-center">
              <p className="flex-1">{conflict}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  setConflict(null);
                  await config.refetch();
                }}
              >
                <RotateCcw aria-hidden="true" /> Reload latest
              </Button>
            </div>
          )}
          {children(form, disabled)}
        </fieldset>
        {can('manage_settings') && (
          <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
            <span className="mr-auto text-[12px] text-muted-foreground" aria-live="polite">
              {form.formState.isDirty ? 'Unsaved changes' : row ? `Saved ${timeAgo(row.updated_at)}` : ''}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void resetDefaults()} disabled={save.isPending}>
              <RotateCcw aria-hidden="true" /> Defaults
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!form.formState.isDirty || save.isPending} onClick={() => form.reset(initial)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!form.formState.isDirty || save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />} Save
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}

/** A list of plain strings edited with inputs. */
function StringList<F extends FieldValues>({ control, name, label, description, max, placeholder, disabled, maxLength }: Readonly<{ control: Control<F>; name: string; label: string; description?: string; max: number; placeholder?: string; disabled: boolean; maxLength: number }>) {
  const arr = useFieldArray({ control: control as Control<FieldValues>, name });
  return (
    <ListField
      label={label}
      description={description}
      items={arr.fields}
      getKey={(f) => f.id}
      max={max}
      disabled={disabled}
      onAdd={() => arr.append({ value: '' })}
      onRemove={arr.remove}
      onMove={arr.move}
      renderItem={(_, i) => (
        <Controller
          control={control as Control<FieldValues>}
          name={`${name}.${i}.value`}
          render={({ field, fieldState }) => (
            <div>
              <Input {...field} maxLength={maxLength} placeholder={placeholder} aria-label={`${label} ${i + 1}`} aria-invalid={Boolean(fieldState.error) || undefined} disabled={disabled} />
              {fieldState.error && <p className="mt-1 text-[11px] text-destructive">{fieldState.error.message}</p>}
            </div>
          )}
        />
      )}
    />
  );
}

const valueList = (max: number, maxLength: number, what: string) =>
  z.array(z.object({ value: z.string().trim().min(1, `Enter ${what} or remove the row.`).max(maxLength, `Keep it under ${maxLength} characters.`) })).max(max);
const wrap = (xs: string[]) => xs.map((value) => ({ value }));
const unwrap = (xs: Array<{ value: string }>) => xs.map((x) => x.value.trim());

// =============================================================== homepage

const homeSchema = z.object({
  sections: z.array(z.object({ key: z.string(), visible: z.boolean() })),
  highlights: z.array(z.object({ value: z.string().trim().min(1, 'Enter the figure.').max(12), label: z.string().trim().min(1, 'Enter the label.').max(60) })).max(6),
  storyVideo: z.string().trim().refine((v) => youtubeId(v) !== null, 'Paste a YouTube video link or its 11-character ID.'),
  storyStart: z.number({ error: 'Enter a number of seconds (0 to start at the beginning).' }).int().min(0).max(86400),
  storyTitle: z.string().trim().min(1, 'Enter a heading.').max(120),
  storyBody: z.string().trim().max(400),
  timelineIntro: z.string().trim().max(200),
  timeline: z.array(z.object({ year: z.string().trim().min(1, 'Enter a year.').max(8), text: z.string().trim().min(1, 'Enter the event.').max(200) })).max(12),
});
type HomeForm = z.infer<typeof homeSchema>;

const fundraisingSchema = z.object({
  goal: z.number({ error: 'Enter an amount or leave it empty.' }).min(1, 'Use at least $1.').max(10_000_000).nullable(),
  raised: z.number({ error: 'Enter an amount or leave it empty.' }).min(0).max(10_000_000).nullable(),
  supporters: z.number({ error: 'Enter a whole number or leave it empty.' }).int().min(0).max(10_000_000).nullable(),
});

const creditsSchema = z.object({ appearances: valueList(20, 40, 'an outlet'), clients: valueList(20, 40, 'a client') });

function SectionOrder({ form, disabled }: Readonly<{ form: UseFormReturn<HomeForm>; disabled: boolean }>) {
  const arr = useFieldArray({ control: form.control, name: 'sections' });
  return (
    <ListField
      label="Sections, in order"
      description="Reorder or hide sections of the home page. Hidden sections keep their content."
      items={arr.fields}
      getKey={(f) => f.id}
      max={HOME_SECTIONS.length}
      disabled={disabled}
      onAdd={() => {}}
      onRemove={() => {}}
      onMove={arr.move}
      renderItem={(f, i) => {
        const meta = HOME_SECTIONS.find((s) => s.key === f.key);
        return (
          <Controller
            control={form.control}
            name={`sections.${i}.visible`}
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[13px] font-medium">
                    {field.value ? <Eye className="size-3.5 text-success" aria-hidden="true" /> : <EyeOff className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                    {meta?.label ?? f.key}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">{meta?.description}</span>
                </span>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} aria-label={`Show ${meta?.label ?? f.key}`} />
              </label>
            )}
          />
        );
      }}
    />
  );
}

export function HomeSettingsPage() {
  return (
    <SettingsPage title="Homepage" description="Section order, highlight figures, the story video, the coverage timeline, credits and fundraising figures.">
      <ConfigForm
        configKey="home"
        title="Home page layout and copy"
        viewOnSite="/"
        schema={homeSchema}
        toForm={(v) => ({
          sections: [...v.sections, ...HOME_SECTIONS.filter((s) => !v.sections.some((x) => x.key === s.key)).map((s) => ({ key: s.key, visible: false }))],
          highlights: v.highlights,
          storyVideo: v.story.youtubeId,
          storyStart: v.story.start,
          storyTitle: v.story.title,
          storyBody: v.story.body,
          timelineIntro: v.timelineIntro,
          timeline: v.timeline,
        })}
        fromForm={(f) => ({
          sections: f.sections.map((s) => ({ key: s.key as HomeSectionKey, visible: s.visible })),
          highlights: f.highlights.map((h) => ({ value: h.value.trim(), label: h.label.trim() })),
          story: { youtubeId: youtubeId(f.storyVideo)!, start: f.storyStart, title: f.storyTitle.trim(), body: f.storyBody.trim() },
          timelineIntro: f.timelineIntro.trim(),
          timeline: f.timeline.map((t) => ({ year: t.year.trim(), text: t.text.trim() })),
        })}
      >
        {(form, disabled) => <HomeFields form={form} disabled={disabled} />}
      </ConfigForm>

      <ConfigForm
        configKey="fundraising"
        title="Fundraising"
        description="Shown in the home page fundraising card and on episode pages. Leave a figure empty to hide it: never publish estimates."
        viewOnSite="/"
        schema={fundraisingSchema}
        toForm={(v) => ({ goal: v.goalCents === null ? null : v.goalCents / 100, raised: v.raisedCents === null ? null : v.raisedCents / 100, supporters: v.supportersCount })}
        fromForm={(f) => ({ goalCents: f.goal === null ? null : Math.round(f.goal * 100), raisedCents: f.raised === null ? null : Math.round(f.raised * 100), supportersCount: f.supporters })}
      >
        {(form, disabled) => (
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField control={form.control} name="goal" label="Monthly goal ($)" type="number" inputMode="numeric" disabled={disabled} />
            <TextField control={form.control} name="raised" label="Raised this month ($)" type="number" inputMode="numeric" disabled={disabled} description="Shows the progress bar when set together with the goal." />
            <TextField control={form.control} name="supporters" label="Monthly supporters" type="number" inputMode="numeric" disabled={disabled} />
          </div>
        )}
      </ConfigForm>

      <ConfigForm
        configKey="credits"
        title="Credits"
        description="“James has appeared on” (Home) and “James has produced for” (Booking)."
        schema={creditsSchema}
        toForm={(v) => ({ appearances: wrap(v.appearances), clients: wrap(v.clients) })}
        fromForm={(f) => ({ appearances: unwrap(f.appearances), clients: unwrap(f.clients) })}
      >
        {(form, disabled) => (
          <>
            <StringList control={form.control} name="appearances" label="Appeared on" max={20} maxLength={40} placeholder="CNN en Español" disabled={disabled} />
            <StringList control={form.control} name="clients" label="Produced for" max={20} maxLength={40} placeholder="Humana" disabled={disabled} />
          </>
        )}
      </ConfigForm>
    </SettingsPage>
  );
}

function HomeFields({ form, disabled }: Readonly<{ form: UseFormReturn<HomeForm>; disabled: boolean }>) {
  const highlights = useFieldArray({ control: form.control, name: 'highlights' });
  const timeline = useFieldArray({ control: form.control, name: 'timeline' });
  const video = useWatch({ control: form.control, name: 'storyVideo' });
  return (
    <>
      <SectionOrder form={form} disabled={disabled} />
      <ListField
        label="Highlight figures"
        description="Under the latest episode, e.g. “4× · Emmy Award winner”."
        items={highlights.fields}
        getKey={(f) => f.id}
        max={6}
        disabled={disabled}
        addLabel="Add figure"
        onAdd={() => highlights.append({ value: '', label: '' })}
        onRemove={highlights.remove}
        onMove={highlights.move}
        renderItem={(_, i) => (
          <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
            <Controller control={form.control} name={`highlights.${i}.value`} render={({ field, fieldState }) => <Input {...field} maxLength={12} placeholder="4×" aria-label={`Figure ${i + 1}`} aria-invalid={Boolean(fieldState.error) || undefined} />} />
            <Controller control={form.control} name={`highlights.${i}.label`} render={({ field, fieldState }) => <Input {...field} maxLength={60} placeholder="Emmy Award winner" aria-label={`Figure ${i + 1} label`} aria-invalid={Boolean(fieldState.error) || undefined} />} />
          </div>
        )}
      />
      <div className="grid gap-4 rounded-lg border p-4">
        <h3 className="text-[13px] font-semibold">“Our story” video</h3>
        <TextField control={form.control} name="storyVideo" label="YouTube video" required disabled={disabled} description={youtubeId(video ?? '') ? `Video ID: ${youtubeId(video ?? '')}` : 'Paste the video link.'} />
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <TextField control={form.control} name="storyTitle" label="Heading" required max={120} disabled={disabled} />
          <TextField control={form.control} name="storyStart" label="Start at (seconds)" type="number" inputMode="numeric" disabled={disabled} />
        </div>
        <TextAreaField control={form.control} name="storyBody" label="Text" max={400} rows={2} disabled={disabled} />
      </div>
      <TextField control={form.control} name="timelineIntro" label="Coverage history intro" max={200} disabled={disabled} />
      <ListField
        label="Coverage history timeline"
        items={timeline.fields}
        getKey={(f) => f.id}
        max={12}
        disabled={disabled}
        addLabel="Add year"
        onAdd={() => timeline.append({ year: '', text: '' })}
        onRemove={timeline.remove}
        onMove={timeline.move}
        renderItem={(_, i) => (
          <div className="grid gap-2 sm:grid-cols-[90px_1fr]">
            <Controller control={form.control} name={`timeline.${i}.year`} render={({ field, fieldState }) => <Input {...field} maxLength={8} placeholder="2010" aria-label={`Timeline ${i + 1} year`} aria-invalid={Boolean(fieldState.error) || undefined} />} />
            <Controller control={form.control} name={`timeline.${i}.text`} render={({ field, fieldState }) => <Input {...field} maxLength={200} aria-label={`Timeline ${i + 1} event`} aria-invalid={Boolean(fieldState.error) || undefined} />} />
          </div>
        )}
      />
    </>
  );
}

// ========================================================= header & footer

const navSchema = z.object({
  header: z
    .array(z.object({ label: z.string().trim().min(1, 'Enter a label.').max(40), href: z.string().trim().regex(NAV_HREF, 'Use a site path like /episodes or an https:// link.'), visible: z.boolean() }))
    .min(1, 'Keep at least one link.')
    .max(12),
});
const tickerSchema = z
  .object({ enabled: z.boolean(), label: z.string().trim().max(30), text: z.string().trim().max(200), linkLabel: z.string().trim().max(40), linkUrl: httpsOrEmpty })
  .superRefine((v, ctx) => {
    if (v.enabled && !v.text) ctx.addIssue({ code: 'custom', path: ['text'], message: 'Enter the announcement, or turn the bar off.' });
    if (v.linkUrl && !v.linkLabel) ctx.addIssue({ code: 'custom', path: ['linkLabel'], message: 'Enter the link text.' });
  });
const socialSchema = z.object({ youtube: httpsOrEmpty, facebook: httpsOrEmpty, x: httpsOrEmpty, vimeo: httpsOrEmpty });
const footerSchema = z.object({ languages: z.string().trim().max(120), privacyUrl: httpsOrEmpty, termsUrl: httpsOrEmpty });

const SITE_PAGES = [
  { value: '/', label: 'Home' },
  { value: '/watch', label: 'Watch (James Reports TV)' },
  { value: '/podcast', label: 'Podcast' },
  { value: '/episodes', label: 'Episodes' },
  { value: '/reports', label: 'Reports' },
  { value: '/archive', label: 'Archive' },
  { value: '/about', label: 'About' },
  { value: '/booking', label: 'Booking' },
  { value: '/support', label: 'Support (donate)' },
  { value: '/vip', label: 'VIP Club' },
  { value: '/guest', label: 'Guest request' },
];

function NavFields({ form, disabled }: Readonly<{ form: UseFormReturn<z.infer<typeof navSchema>>; disabled: boolean }>) {
  const arr = useFieldArray({ control: form.control, name: 'header' });
  return (
    <ListField
      label="Header links"
      description="Shown in the header (and its mobile menu) and the footer’s Explore column. Episodes and Podcast keep their drop-down menus."
      items={arr.fields}
      getKey={(f) => f.id}
      max={12}
      disabled={disabled}
      addLabel="Add link"
      error={form.formState.errors.header?.root?.message ?? form.formState.errors.header?.message}
      onAdd={() => arr.append({ label: '', href: '/', visible: true })}
      onRemove={arr.remove}
      onMove={arr.move}
      renderItem={(_, i) => (
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-center">
          <Controller control={form.control} name={`header.${i}.label`} render={({ field, fieldState }) => <Input {...field} maxLength={40} placeholder="Label" aria-label={`Link ${i + 1} label`} aria-invalid={Boolean(fieldState.error) || undefined} />} />
          <Controller
            control={form.control}
            name={`header.${i}.href`}
            render={({ field, fieldState }) => (
              <div>
                <Input {...field} list="site-pages" placeholder="/episodes or https://…" aria-label={`Link ${i + 1} destination`} aria-invalid={Boolean(fieldState.error) || undefined} />
                {fieldState.error && <p className="mt-1 text-[11px] text-destructive">{fieldState.error.message}</p>}
              </div>
            )}
          />
          <Controller
            control={form.control}
            name={`header.${i}.visible`}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} aria-label={`Show link ${i + 1}`} /> Shown
              </label>
            )}
          />
        </div>
      )}
    />
  );
}

export function HeaderSettingsPage() {
  return (
    <SettingsPage title="Header & footer" description="Navigation links, the announcement bar, social links and footer details.">
      <datalist id="site-pages">
        {SITE_PAGES.map((p) => (
          <option key={p.value} value={p.value} label={p.label} />
        ))}
      </datalist>
      <ConfigForm configKey="navigation" title="Navigation" schema={navSchema} toForm={(v) => v} fromForm={(f) => ({ header: f.header.map((h) => ({ label: h.label.trim(), href: h.href.trim(), visible: h.visible })) })} viewOnSite="/">
        {(form, disabled) => <NavFields form={form} disabled={disabled} />}
      </ConfigForm>
      <ConfigForm configKey="ticker" title="Announcement bar" description="The dark bar above the header on every page." schema={tickerSchema} toForm={(v) => v} fromForm={(f) => ({ ...f, label: f.label.trim(), text: f.text.trim(), linkLabel: f.linkLabel.trim(), linkUrl: f.linkUrl.trim() })} viewOnSite="/">
        {(form, disabled) => (
          <>
            <SwitchField control={form.control} name="enabled" label="Show the announcement bar" disabled={disabled} />
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <TextField control={form.control} name="label" label="Label" max={30} disabled={disabled} description="E.g. Premiere" />
              <TextField control={form.control} name="text" label="Announcement" max={200} disabled={disabled} />
            </div>
            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <TextField control={form.control} name="linkLabel" label="Link text" max={40} disabled={disabled} />
              <TextField control={form.control} name="linkUrl" label="Link" placeholder="https://…" disabled={disabled} />
            </div>
          </>
        )}
      </ConfigForm>
      <ConfigForm configKey="social" title="Social links" description="Footer “Follow” column. Leave a link empty to hide it." schema={socialSchema} toForm={(v) => v} fromForm={(f) => ({ youtube: f.youtube.trim(), facebook: f.facebook.trim(), x: f.x.trim(), vimeo: f.vimeo.trim() })}>
        {(form, disabled) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="youtube" label="YouTube" placeholder="https://www.youtube.com/@…" disabled={disabled} description="Also used for every “Subscribe on YouTube” button." />
            <TextField control={form.control} name="facebook" label="Facebook" placeholder="https://www.facebook.com/…" disabled={disabled} />
            <TextField control={form.control} name="x" label="X (Twitter)" placeholder="https://x.com/…" disabled={disabled} />
            <TextField control={form.control} name="vimeo" label="Vimeo" placeholder="https://vimeo.com/…" disabled={disabled} />
          </div>
        )}
      </ConfigForm>
      <ConfigForm configKey="footer" title="Footer" schema={footerSchema} toForm={(v) => v} fromForm={(f) => ({ languages: f.languages.trim(), privacyUrl: f.privacyUrl.trim(), termsUrl: f.termsUrl.trim() })} viewOnSite="/">
        {(form, disabled) => (
          <>
            <TextField control={form.control} name="languages" label="Languages line" max={120} disabled={disabled} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="privacyUrl" label="Privacy policy link" placeholder="https://…" disabled={disabled} description="Leave empty to show “Privacy” as plain text." />
              <TextField control={form.control} name="termsUrl" label="Terms link" placeholder="https://…" disabled={disabled} />
            </div>
          </>
        )}
      </ConfigForm>
    </SettingsPage>
  );
}

// ========================================================= watch & podcast

const watchSchema = z.object({
  channels: z
    .array(
      z
        .object({
          name: z.string().trim().min(1, 'Enter a name.').max(40),
          description: z.string().trim().max(80),
          guideLabel: z.string().trim().max(60),
          source: z.enum(['playlist', 'video']),
          link: z.string().trim(),
          start: z.number({ error: 'Enter seconds.' }).int().min(0).max(86400),
        })
        .superRefine((c, ctx) => {
          const ok = c.source === 'playlist' ? playlistId(c.link) : youtubeId(c.link);
          if (!ok) ctx.addIssue({ code: 'custom', path: ['link'], message: c.source === 'playlist' ? 'Paste a YouTube playlist link or ID.' : 'Paste a YouTube video link or ID.' });
        }),
    )
    .min(1, 'Keep at least one channel.')
    .max(8),
  headlines: valueList(10, 120, 'a headline'),
  premiereTitle: z.string().trim().max(60),
  premiereSubtitle: z.string().trim().max(80),
});
type WatchForm = z.infer<typeof watchSchema>;

const podcastSchema = z.object({
  uploads: z.string().trim().refine((v) => playlistId(v) !== null, 'Paste the channel’s uploads playlist link or ID.'),
  playlists: z.array(z.object({ label: z.string().trim().min(1, 'Enter a label.').max(40), link: z.string().trim().refine((v) => playlistId(v) !== null, 'Paste a playlist link or ID.') })).min(1).max(6),
});

function WatchFields({ form, disabled }: Readonly<{ form: UseFormReturn<WatchForm>; disabled: boolean }>) {
  const channels = useFieldArray({ control: form.control, name: 'channels' });
  return (
    <>
      <ListField
        label="TV channels"
        description="Each channel plays a YouTube playlist or one video, in the order shown."
        items={channels.fields}
        getKey={(f) => f.id}
        max={8}
        disabled={disabled}
        addLabel="Add channel"
        onAdd={() => channels.append({ name: '', description: '', guideLabel: '', source: 'playlist', link: '', start: 0 })}
        onRemove={channels.remove}
        onMove={channels.move}
        renderItem={(_, i) => (
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField control={form.control} name={`channels.${i}.name`} label="Name" required max={40} disabled={disabled} />
              <TextField control={form.control} name={`channels.${i}.description`} label="Description" max={80} disabled={disabled} />
            </div>
            <div className="grid gap-3 sm:grid-cols-[150px_1fr_110px]">
              <SelectField control={form.control} name={`channels.${i}.source`} label="Plays" options={[{ value: 'playlist', label: 'A playlist' }, { value: 'video', label: 'One video' }]} disabled={disabled} />
              <TextField control={form.control} name={`channels.${i}.link`} label="YouTube link or ID" required disabled={disabled} />
              <TextField control={form.control} name={`channels.${i}.start`} label="Start (s)" type="number" inputMode="numeric" disabled={disabled} />
            </div>
            <TextField control={form.control} name={`channels.${i}.guideLabel`} label="Program guide title" max={60} disabled={disabled} />
          </div>
        )}
      />
      <StringList control={form.control} name="headlines" label="Scrolling headlines" max={10} maxLength={120} disabled={disabled} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField control={form.control} name="premiereTitle" label="Premiere slot" max={60} disabled={disabled} description="E.g. Thursday · 8 PM ET" />
        <TextField control={form.control} name="premiereSubtitle" label="Premiere text" max={80} disabled={disabled} />
      </div>
    </>
  );
}

function PlaylistFields({ form, disabled }: Readonly<{ form: UseFormReturn<z.infer<typeof podcastSchema>>; disabled: boolean }>) {
  const arr = useFieldArray({ control: form.control, name: 'playlists' });
  return (
    <>
      <TextField control={form.control} name="uploads" label="Channel uploads playlist" required disabled={disabled} description="Feeds “Latest on the podcast” (Home) and “Watch the latest” (Podcast)." />
      <ListField
        label="Playlist buttons"
        description="The playlist switcher above the main player on the Podcast page."
        items={arr.fields}
        getKey={(f) => f.id}
        max={6}
        disabled={disabled}
        addLabel="Add playlist"
        onAdd={() => arr.append({ label: '', link: '' })}
        onRemove={arr.remove}
        onMove={arr.move}
        renderItem={(_, i) => (
          <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr]">
            <Controller control={form.control} name={`playlists.${i}.label`} render={({ field, fieldState }) => <Input {...field} maxLength={40} placeholder="Label" aria-label={`Playlist ${i + 1} label`} aria-invalid={Boolean(fieldState.error) || undefined} />} />
            <Controller
              control={form.control}
              name={`playlists.${i}.link`}
              render={({ field, fieldState }) => (
                <div>
                  <Input {...field} placeholder="Playlist link or ID" aria-label={`Playlist ${i + 1} link`} aria-invalid={Boolean(fieldState.error) || undefined} />
                  {fieldState.error && <p className="mt-1 text-[11px] text-destructive">{fieldState.error.message}</p>}
                </div>
              )}
            />
          </div>
        )}
      />
    </>
  );
}

export function WatchSettingsPage() {
  return (
    <SettingsPage title="Watch & podcast" description="James Reports TV channels and headlines, and the YouTube playlists on the Podcast page.">
      <ConfigForm
        configKey="watch"
        title="James Reports TV"
        viewOnSite="/watch"
        schema={watchSchema}
        toForm={(v) => ({
          channels: v.channels.map((c) => ({ name: c.name, description: c.description, guideLabel: c.guideLabel, source: (c.videoId ? 'video' : 'playlist') as WatchForm['channels'][number]['source'], link: c.videoId || c.playlistId, start: c.start })),
          headlines: wrap(v.headlines),
          premiereTitle: v.premiereTitle,
          premiereSubtitle: v.premiereSubtitle,
        })}
        fromForm={(f) => ({
          channels: f.channels.map((c) => ({
            name: c.name.trim(),
            description: c.description.trim(),
            guideLabel: c.guideLabel.trim(),
            playlistId: c.source === 'playlist' ? playlistId(c.link)! : '',
            videoId: c.source === 'video' ? youtubeId(c.link)! : '',
            start: c.start,
          })),
          headlines: unwrap(f.headlines),
          premiereTitle: f.premiereTitle.trim(),
          premiereSubtitle: f.premiereSubtitle.trim(),
        })}
      >
        {(form, disabled) => <WatchFields form={form} disabled={disabled} />}
      </ConfigForm>
      <ConfigForm
        configKey="podcast"
        title="Podcast playlists"
        viewOnSite="/podcast"
        schema={podcastSchema}
        toForm={(v) => ({ uploads: v.uploadsPlaylistId, playlists: v.playlists.map((p) => ({ label: p.label, link: p.id })) })}
        fromForm={(f) => ({ uploadsPlaylistId: playlistId(f.uploads)!, playlists: f.playlists.map((p) => ({ id: playlistId(p.link)!, label: p.label.trim() })) })}
      >
        {(form, disabled) => <PlaylistFields form={form} disabled={disabled} />}
      </ConfigForm>
    </SettingsPage>
  );
}

// ==================================================================== about

const aboutSchema = z.object({
  intro: z.string().trim().min(1, 'Enter the introduction.').max(600),
  paragraphs: valueList(6, 1200, 'a paragraph'),
  facts: z.array(z.object({ label: z.string().trim().min(1, 'Enter a label.').max(40), value: z.string().trim().min(1, 'Enter the text.').max(120) })).max(6),
});

function AboutFields({ form, disabled }: Readonly<{ form: UseFormReturn<z.infer<typeof aboutSchema>>; disabled: boolean }>) {
  const paragraphs = useFieldArray({ control: form.control, name: 'paragraphs' });
  const facts = useFieldArray({ control: form.control, name: 'facts' });
  return (
    <>
      <TextAreaField control={form.control} name="intro" label="Introduction" required max={600} rows={3} disabled={disabled} description="The large paragraph under “James Pierre”." />
      <ListField
        label="Biography paragraphs"
        items={paragraphs.fields}
        getKey={(f) => f.id}
        max={6}
        disabled={disabled}
        addLabel="Add paragraph"
        onAdd={() => paragraphs.append({ value: '' })}
        onRemove={paragraphs.remove}
        onMove={paragraphs.move}
        renderItem={(_, i) => <TextAreaField control={form.control} name={`paragraphs.${i}.value`} label={`Paragraph ${i + 1}`} max={1200} rows={4} disabled={disabled} />}
      />
      <ListField
        label="Facts"
        description="The three boxes: Awards, Education, Based in."
        items={facts.fields}
        getKey={(f) => f.id}
        max={6}
        disabled={disabled}
        addLabel="Add fact"
        onAdd={() => facts.append({ label: '', value: '' })}
        onRemove={facts.remove}
        onMove={facts.move}
        renderItem={(_, i) => (
          <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
            <Controller control={form.control} name={`facts.${i}.label`} render={({ field, fieldState }) => <Input {...field} maxLength={40} placeholder="Awards" aria-label={`Fact ${i + 1} label`} aria-invalid={Boolean(fieldState.error) || undefined} />} />
            <Controller control={form.control} name={`facts.${i}.value`} render={({ field, fieldState }) => <Input {...field} maxLength={120} aria-label={`Fact ${i + 1} text`} aria-invalid={Boolean(fieldState.error) || undefined} />} />
          </div>
        )}
      />
    </>
  );
}

export function AboutSettingsPage() {
  return (
    <SettingsPage title="About page" description="James Pierre’s biography. The portrait is under Brand & SEO → Page images; award and gallery photos are part of the page design.">
      <ConfigForm
        configKey="about"
        title="Biography"
        viewOnSite="/about"
        schema={aboutSchema}
        toForm={(v) => ({ intro: v.intro, paragraphs: wrap(v.paragraphs), facts: v.facts })}
        fromForm={(f) => ({ intro: f.intro.trim(), paragraphs: unwrap(f.paragraphs), facts: f.facts.map((x) => ({ label: x.label.trim(), value: x.value.trim() })) })}
      >
        {(form, disabled) => <AboutFields form={form} disabled={disabled} />}
      </ConfigForm>
      <p className="text-sm text-muted-foreground">
        To change the portrait, go to{' '}
        <Link to="/admin/site/brand#page-images" className="font-medium text-foreground underline underline-offset-4">
          Brand & SEO → Page images
        </Link>
        .
      </p>
    </SettingsPage>
  );
}

// =============================================================== brand & seo

const brandSchema = z.object({ siteName: z.string().trim().min(1, 'Enter the site name.').max(60), tagline: z.string().trim().max(60), description: z.string().trim().max(200) });
const seoSchema = z.object({ defaultTitle: z.string().trim().min(1, 'Enter a title.').max(70), defaultDescription: z.string().trim().min(1, 'Enter a description.').max(200) });
const contactSchema = z.object({ bookingEmail: email, adsEmail: email });
const imagesSchema = z.object(Object.fromEntries(IMAGE_SLOTS.map((s) => [s.key, z.string().nullable()])) as Record<string, z.ZodNullable<z.ZodString>>);

export function BrandSettingsPage() {
  return (
    <SettingsPage title="Brand & SEO" description="Site name, search engine defaults, contact addresses and the photos used on fixed page positions.">
      <ConfigForm configKey="brand" title="Brand" description="The header logo and colours are part of the site design and don’t change here." schema={brandSchema} toForm={(v) => v} fromForm={(f) => ({ siteName: f.siteName.trim(), tagline: f.tagline.trim(), description: f.description.trim() })}>
        {(form, disabled) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="siteName" label="Site name" required max={60} disabled={disabled} description="Used in browser tab titles." />
              <TextField control={form.control} name="tagline" label="Tagline" max={60} disabled={disabled} />
            </div>
            <TextAreaField control={form.control} name="description" label="Footer description" max={200} rows={2} disabled={disabled} />
          </>
        )}
      </ConfigForm>
      <ConfigForm
        configKey="seo"
        title="Search engines"
        description="The default title and description for pages that don’t set their own. Social previews (Facebook, WhatsApp, X) use the fixed values in the site’s HTML; see the admin guide."
        schema={seoSchema}
        toForm={(v) => v}
        fromForm={(f) => ({ defaultTitle: f.defaultTitle.trim(), defaultDescription: f.defaultDescription.trim() })}
      >
        {(form, disabled) => (
          <>
            <TextField control={form.control} name="defaultTitle" label="Default title" required max={70} disabled={disabled} />
            <TextAreaField control={form.control} name="defaultDescription" label="Default description" max={200} rows={3} disabled={disabled} />
          </>
        )}
      </ConfigForm>
      <ConfigForm configKey="contact" title="Contact addresses" description="Shown on the Booking page and used by the media-kit button." schema={contactSchema} toForm={(v) => v} fromForm={(f) => ({ bookingEmail: f.bookingEmail.trim(), adsEmail: f.adsEmail.trim() })} viewOnSite="/booking">
        {(form, disabled) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="bookingEmail" label="Bookings email" type="email" required disabled={disabled} />
            <TextField control={form.control} name="adsEmail" label="Advertising email" type="email" required disabled={disabled} />
          </div>
        )}
      </ConfigForm>
      <ConfigForm
        id="page-images"
        configKey="images"
        title="Page images"
        description="Photos in fixed positions on the site. Changes take effect when you save. Remove an image to go back to the original photo."
        schema={imagesSchema}
        toForm={(v) => Object.fromEntries(IMAGE_SLOTS.map((s) => [s.key, v[s.key] ?? null])) as Record<string, string | null>}
        fromForm={(f) => f as SiteConfig['images']}
      >
        {(form, disabled) => (
          <div className="grid gap-4">
            {IMAGE_SLOTS.map((s) => (
              <Controller
                key={s.key}
                control={form.control}
                name={s.key}
                render={({ field }) => <MediaField label={s.label} description={s.where} value={field.value} onChange={field.onChange} disabled={disabled} aspect={s.aspect} />}
              />
            ))}
          </div>
        )}
      </ConfigForm>
    </SettingsPage>
  );
}
