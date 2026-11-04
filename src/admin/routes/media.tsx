import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Images, Loader2, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { EmptyState, ErrorState, LoadingBlock, Page, PageHeader, useConfirm, usePageTitle } from '@/admin/components/common';
import { MediaThumb } from '@/admin/components/media-picker';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/admin/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { Textarea } from '@/admin/components/ui/textarea';
import { useAuth } from '@/admin/lib/auth';
import { deleteMedia, MEDIA_SELECT, mediaUsage, replaceMedia, uploadMedia, useList, validateImageFile, type MediaAsset } from '@/admin/lib/data';
import { must, toAdminError } from '@/admin/lib/errors';
import { formatBytes, formatDateTime } from '@/admin/lib/format';
import { sb } from '@/admin/lib/supabase';
import { cn } from '@/admin/lib/utils';

interface UploadItem {
  key: string;
  name: string;
  progress: number;
  error?: string;
  done?: boolean;
}

const USAGE_LINK: Record<string, (id: string) => string> = {
  episodes: (id) => `/admin/episodes/${encodeURIComponent(id)}`,
  sponsors: (id) => `/admin/sponsors/${encodeURIComponent(id)}`,
  site_config: () => '/admin/site/brand#page-images',
};

export function MediaPage() {
  usePageTitle('Media library');
  const { can } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const source = params.get('source') ?? 'all';

  const list = useList<MediaAsset>({
    table: 'media_assets',
    select: MEDIA_SELECT,
    page,
    pageSize: 30,
    search,
    searchColumns: ['file_name', 'alt'],
    filters: { source: source === 'all' ? undefined : source },
    sort: { column: 'created_at', ascending: false },
  });
  const pages = Math.max(1, Math.ceil((list.data?.count ?? 0) / 30));

  const upload = async (files: FileList | File[]) => {
    const items = [...files].map((f) => ({ file: f, key: crypto.randomUUID(), problem: validateImageFile(f) }));
    setUploads((u) => [...items.map((i) => ({ key: i.key, name: i.file.name, progress: 0, error: i.problem ?? undefined })), ...u]);
    let ok = 0;
    for (const i of items) {
      if (i.problem) continue;
      try {
        await uploadMedia(i.file, '', (p) => setUploads((u) => u.map((x) => (x.key === i.key ? { ...x, progress: p } : x))));
        setUploads((u) => u.map((x) => (x.key === i.key ? { ...x, progress: 100, done: true } : x)));
        ok += 1;
      } catch (err) {
        setUploads((u) => u.map((x) => (x.key === i.key ? { ...x, error: toAdminError(err).message } : x)));
      }
    }
    if (fileRef.current) fileRef.current.value = '';
    await qc.invalidateQueries({ queryKey: ['list'] });
    if (ok) toast.success(`${ok} image${ok === 1 ? '' : 's'} uploaded. Add a description (alt text) to each.`);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (can('upload_media') && e.dataTransfer.files.length) void upload(e.dataTransfer.files);
  };

  return (
    <Page width="wide">
      <PageHeader
        title="Media library"
        description="Images used across the site. Uploaded images are stored in Supabase; “Site images” are the photos that shipped with the site design."
        actions={
          can('upload_media') && (
            <>
              <input ref={fileRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => e.target.files && void upload(e.target.files)} />
              <Button onClick={() => fileRef.current?.click()}>
                <Upload aria-hidden="true" /> Upload images
              </Button>
            </>
          )
        }
      />

      {can('upload_media') && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn('mb-5 rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground transition-colors', dragging && 'border-primary bg-accent', params.get('upload') && 'border-primary')}
        >
          Drag images here, or{' '}
          <button type="button" className="font-medium text-foreground underline underline-offset-4" onClick={() => fileRef.current?.click()}>
            choose files
          </button>
          . PNG, JPEG, WebP, GIF or AVIF, up to 10 MB each.
        </div>
      )}

      {uploads.length > 0 && (
        <ul className="mb-5 grid gap-2" aria-label="Uploads">
          {uploads.slice(0, 8).map((u) => (
            <li key={u.key} className="rounded-lg border bg-card px-3 py-2 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">{u.name}</span>
                <span className={cn('shrink-0 text-xs', u.error ? 'text-destructive' : u.done ? 'text-success' : 'text-muted-foreground')}>{u.error ? 'Failed' : u.done ? 'Uploaded' : `${u.progress}%`}</span>
              </div>
              {u.error ? (
                <p className="mt-1 text-xs text-destructive">{u.error}</p>
              ) : (
                !u.done && (
                  <div role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.name}`} className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${u.progress}%` }} />
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={source}
          onValueChange={(v) => {
            const next = new URLSearchParams(params);
            if (v === 'all') next.delete('source');
            else next.set('source', v);
            setParams(next, { replace: true });
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="storage">Uploaded</TabsTrigger>
            <TabsTrigger value="bundled">Site images</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search file name or description"
            aria-label="Search images"
            className="pl-8"
          />
        </div>
      </div>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <LoadingBlock rows={4} />
      ) : list.data.rows.length === 0 ? (
        <EmptyState icon={Images} title={search ? 'No images match your search' : 'No images here yet'} description={can('upload_media') ? 'Upload images to use them in episodes, sponsors and page settings.' : undefined} />
      ) : (
        <>
          <ul className={cn('grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5', list.isFetching && 'opacity-70')}>
            {list.data.rows.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setSelected(m)} className="group block w-full overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary/60 focus-visible:border-primary">
                  <MediaThumb asset={m} className="aspect-[4/3] w-full" />
                  <span className="block px-3 py-2">
                    <span className="block truncate text-[13px] font-medium">{m.file_name || m.path}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {m.source === 'bundled' ? 'Site image' : 'Uploaded'} · {m.width && m.height ? `${m.width}×${m.height}` : formatBytes(m.size_bytes)}
                    </span>
                    {!m.alt && <span className="mt-1 block text-[11px] font-medium text-warning">No description</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="mt-5 flex items-center justify-between text-[13px] text-muted-foreground">
              <span>
                Page {page} of {pages} · {list.data.count} images
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <MediaDetail asset={selected} onClose={() => setSelected(null)} onChanged={(a) => setSelected(a)} />
    </Page>
  );
}

function MediaDetail({ asset, onClose, onChanged }: Readonly<{ asset: MediaAsset | null; onClose: () => void; onChanged: (a: MediaAsset | null) => void }>) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [alt, setAlt] = useState('');
  const [altFor, setAltFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState<number | null>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  if (asset && altFor !== asset.id + asset.version) {
    setAltFor(asset.id + asset.version);
    setAlt(asset.alt);
  }
  const usage = useQuery({ queryKey: ['media-usage', asset?.id], enabled: Boolean(asset), queryFn: () => mediaUsage(asset!.id) });

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['list'] }), qc.invalidateQueries({ queryKey: ['media-by-id'] })]);

  const saveAlt = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      const rows = must(await sb.from('media_assets').update({ alt: alt.trim() }).eq('id', asset.id).eq('version', asset.version).select(MEDIA_SELECT)) as MediaAsset[];
      if (!rows.length) throw toAdminError({ message: 'conflict' });
      onChanged(rows[0]);
      await refresh();
      toast.success('Description saved');
    } catch (err) {
      toast.error(toAdminError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const replace = async (file: File | undefined) => {
    if (!asset || !file) return;
    setReplacing(0);
    try {
      const next = await replaceMedia(asset, file, setReplacing);
      onChanged(next);
      await refresh();
      toast.success('Image replaced everywhere it’s used.');
    } catch (err) {
      toast.error(toAdminError(err).message);
    } finally {
      setReplacing(null);
      if (replaceRef.current) replaceRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!asset) return;
    if ((usage.data?.length ?? 0) > 0) return;
    const ok = await confirm({
      title: 'Delete this image?',
      description: asset.source === 'bundled' ? 'It’s removed from the library. The original file stays with the site code.' : 'The file is deleted from storage. This can’t be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteMedia(asset);
      await refresh();
      toast.success('Image deleted');
      onChanged(null);
      onClose();
    } catch (err) {
      toast.error(toAdminError(err).message);
    }
  };

  const used = usage.data ?? [];
  return (
    <Sheet open={asset !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {asset && (
          <>
            <SheetHeader>
              <SheetTitle className="truncate pr-6">{asset.file_name || asset.path}</SheetTitle>
              <SheetDescription>{asset.source === 'bundled' ? 'Site image (shipped with the design)' : 'Uploaded image'}</SheetDescription>
            </SheetHeader>
            <div className="grid gap-5 px-4 pb-8">
              <div className="overflow-hidden rounded-xl border bg-muted">
                <MediaThumb asset={asset} className="max-h-80 w-full object-contain" />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                <dt className="text-muted-foreground">Dimensions</dt>
                <dd>{asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—'}</dd>
                <dt className="text-muted-foreground">Size</dt>
                <dd>{formatBytes(asset.size_bytes)}</dd>
                <dt className="text-muted-foreground">Type</dt>
                <dd>{asset.mime_type || '—'}</dd>
                <dt className="text-muted-foreground">Added</dt>
                <dd>{formatDateTime(asset.created_at)}</dd>
              </dl>
              <div className="flex items-center gap-2">
                <Input readOnly value={asset.url.startsWith('/') ? `${window.location.origin}${asset.url}` : asset.url} aria-label="Image address" className="text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy image address"
                  onClick={() => void navigator.clipboard.writeText(asset.url.startsWith('/') ? `${window.location.origin}${asset.url}` : asset.url).then(() => toast.success('Copied'), () => toast.error('Couldn’t copy'))}
                >
                  <Copy />
                </Button>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="media-alt">Description (alt text)</Label>
                <Textarea id="media-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} rows={3} disabled={!can('upload_media')} aria-describedby="media-alt-help" />
                <p id="media-alt-help" className="text-[12px] text-muted-foreground">
                  Describe what the image shows for people using screen readers. {alt.length}/300
                </p>
                {can('upload_media') && (
                  <Button size="sm" className="justify-self-start" disabled={saving || alt.trim() === asset.alt} onClick={() => void saveAlt()}>
                    {saving && <Loader2 className="animate-spin" aria-hidden="true" />} Save description
                  </Button>
                )}
              </div>
              <div className="grid gap-2">
                <h3 className="text-[13px] font-medium">Used in</h3>
                {usage.isPending ? (
                  <LoadingBlock rows={1} />
                ) : usage.isError ? (
                  <ErrorState error={usage.error} onRetry={() => void usage.refetch()} compact />
                ) : used.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">Not used by any episode, sponsor or page setting.</p>
                ) : (
                  <ul className="grid gap-1 text-[13px]">
                    {used.map((u) => (
                      <li key={`${u.entity}-${u.entity_id}-${u.field}-${u.label}`}>
                        <Link to={USAGE_LINK[u.entity]?.(u.entity_id) ?? '/admin'} className="underline underline-offset-4" onClick={onClose}>
                          {u.label}
                        </Link>{' '}
                        <span className="text-muted-foreground">· {u.field}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {can('upload_media') && (
                  <>
                    <input ref={replaceRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void replace(e.target.files?.[0])} />
                    <Button variant="outline" disabled={replacing !== null} onClick={() => replaceRef.current?.click()}>
                      {replacing !== null ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                      {replacing !== null ? `Replacing ${replacing}%` : 'Replace file'}
                    </Button>
                  </>
                )}
                {can('delete') && (
                  <Button variant="outline" className="text-destructive hover:text-destructive" disabled={usage.isPending || used.length > 0} onClick={() => void remove()} title={used.length > 0 ? 'Remove it from the places listed above first' : undefined}>
                    <Trash2 aria-hidden="true" /> Delete
                  </Button>
                )}
              </div>
              {used.length > 0 && can('delete') && <p className="-mt-3 text-[12px] text-muted-foreground">Images that are in use can’t be deleted. Replace the file instead, or remove it from the places listed above first.</p>}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
