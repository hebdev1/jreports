import { useQueryClient } from '@tanstack/react-query';
import { Film, ImageOff, Images, Loader2, Search, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/admin/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/admin/components/ui/dialog';
import { Input } from '@/admin/components/ui/input';
import { useAuth } from '@/admin/lib/auth';
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES, MEDIA_SELECT, uploadMedia, useList, useMediaByIds, validateImageFile, validateVideoFile, type MediaAsset, type MediaKind } from '@/admin/lib/data';
import { formatBytes } from '@/admin/lib/format';
import { cn } from '@/admin/lib/utils';
import { toClock } from '@/admin/collections/helpers';
import { EmptyState, ErrorState, LoadingBlock } from './common';

/** Thumbnail for a media asset: the image itself, or a video's first frame with its length. */
export function MediaThumb({ asset, className, alt, kind }: Readonly<{ asset: Pick<MediaAsset, 'url' | 'alt'> & Partial<Pick<MediaAsset, 'kind' | 'duration_seconds'>> | null | undefined; className?: string; alt?: string; kind?: MediaKind }>) {
  const [broken, setBroken] = useState(false);
  if (!asset || broken) {
    return (
      <span className={cn('grid place-items-center bg-muted text-muted-foreground', className)}>
        {(asset?.kind ?? kind) === 'video' ? <Film className="size-5" aria-hidden="true" /> : <ImageOff className="size-5" aria-hidden="true" />}
        <span className="sr-only">{asset ? 'Preview failed to load' : 'Nothing selected'}</span>
      </span>
    );
  }
  if (asset.kind === 'video') {
    return (
      <span className={cn('relative block overflow-hidden bg-black', className)}>
        {/* #t=1 asks the browser for a frame one second in, without playing. */}
        <video src={`${asset.url}#t=1`} preload="metadata" muted playsInline aria-label={alt ?? (asset.alt || 'Video')} onError={() => setBroken(true)} className="size-full object-cover" />
        <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          <Film className="size-3" aria-hidden="true" />
          {asset.duration_seconds ? toClock(asset.duration_seconds) : 'Video'}
        </span>
      </span>
    );
  }
  return <img src={asset.url} alt={alt ?? asset.alt} loading="lazy" decoding="async" onError={() => setBroken(true)} className={cn('bg-muted object-cover', className)} />;
}

interface PickerProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (asset: MediaAsset) => void;
  /** Only files hosted on Supabase Storage (absolute https URLs). */
  storageOnly?: boolean;
  kind?: MediaKind;
}

export function MediaPickerDialog({ open, onOpenChange, onSelect, storageOnly, kind = 'image' }: Readonly<PickerProps>) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const video = kind === 'video';
  const noun = video ? 'video' : 'image';
  const list = useList<MediaAsset>({
    table: 'media_assets',
    select: MEDIA_SELECT,
    page,
    pageSize: 24,
    search,
    searchColumns: ['file_name', 'alt'],
    filters: { kind, ...(storageOnly ? { source: 'storage' } : {}) },
    sort: { column: 'created_at', ascending: false },
  });

  // Closing the dialog cancels an upload that is still running.
  useEffect(() => {
    if (!open) abort.current?.abort();
  }, [open]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = video ? validateVideoFile(file) : validateImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setProgress(0);
    abort.current = new AbortController();
    try {
      const asset = await uploadMedia(file, '', setProgress, abort.current.signal);
      await qc.invalidateQueries({ queryKey: ['list'] });
      toast.success(`${video ? 'Video' : 'Image'} uploaded. Add a description in the media library.`);
      onSelect(asset);
      onOpenChange(false);
    } catch (err) {
      if (!abort.current?.signal.aborted) toast.error((err as Error).message);
    } finally {
      abort.current = null;
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pages = Math.max(1, Math.ceil((list.data?.count ?? 0) / 24));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] w-[min(100vw-2rem,56rem)] max-w-none overflow-y-auto sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Choose {video ? 'a video' : 'an image'}</DialogTitle>
          <DialogDescription>
            {storageOnly ? `Only uploaded ${noun}s can be used here.` : `Pick from the media library or upload a new ${noun}.`}
            {video && ' MP4 (H.264) plays in every browser; up to 5 GB.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by file name or description"
              aria-label={`Search ${noun}s`}
              className="pl-8"
            />
          </div>
          {can('upload_media') && (
            <>
              <input ref={fileRef} type="file" accept={(video ? ACCEPTED_VIDEO_TYPES : ACCEPTED_IMAGE_TYPES).join(',')} className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} aria-hidden="true" />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={progress !== null}>
                {progress !== null ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                {progress !== null ? `Uploading ${progress}%` : 'Upload'}
              </Button>
              {progress !== null && video && (
                <Button variant="ghost" onClick={() => abort.current?.abort()}>
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
        {progress !== null && (
          <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress" className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        )}
        {list.isPending ? (
          <LoadingBlock rows={3} />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data!.rows.length === 0 ? (
          <EmptyState icon={video ? Film : Images} title={search ? `No ${noun}s match your search` : `No ${noun}s yet`} description={can('upload_media') ? `Upload ${video ? 'a video' : 'an image'} to use it here.` : undefined} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label={video ? 'Videos' : 'Images'}>
            {list.data!.rows.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(m);
                    onOpenChange(false);
                  }}
                  className="group w-full overflow-hidden rounded-lg border text-left transition hover:border-primary focus-visible:border-primary"
                >
                  <MediaThumb asset={m} className="aspect-[4/3] w-full" />
                  <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground group-hover:text-foreground">
                    {m.file_name || m.path}
                    {video && m.size_bytes ? ` · ${formatBytes(m.size_bytes)}` : ''}
                  </span>
                  {!m.alt && <span className="sr-only">(no description)</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Form control: shows the chosen image or video with Change / Remove. Value is a media id. */
export function MediaField({
  value,
  onChange,
  label,
  description,
  disabled,
  aspect = '16 / 9',
  allowClear = true,
  kind = 'image',
}: Readonly<{ value: string | null; onChange: (id: string | null) => void; label: string; description?: string; disabled?: boolean; aspect?: string; allowClear?: boolean; kind?: MediaKind }>) {
  const [open, setOpen] = useState(false);
  const media = useMediaByIds([value]);
  const asset = value ? media.data?.[value] : null;
  const video = kind === 'video';
  return (
    <div className="grid gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="flex flex-wrap items-start gap-4 rounded-lg border p-3">
        <div className="w-40 overflow-hidden rounded-md border" style={{ aspectRatio: aspect }}>
          {media.isFetching && value && !asset ? <div className="size-full animate-pulse bg-muted" /> : <MediaThumb asset={asset} kind={kind} className="size-full" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-[13px]">
            {asset ? asset.file_name || asset.path : value ? 'Loading…' : `No ${video ? 'video' : 'image'} selected`}
            {asset?.size_bytes && video ? <span className="text-muted-foreground"> · {formatBytes(asset.size_bytes)}</span> : null}
          </p>
          {asset && !asset.alt && <p className="text-[12px] text-warning">This {video ? 'video' : 'image'} has no description. Add one in the media library.</p>}
          {!disabled && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
                {video ? <Film aria-hidden="true" /> : <Images aria-hidden="true" />} {value ? 'Change' : video ? 'Choose video' : 'Choose image'}
              </Button>
              {value && allowClear && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                  <X aria-hidden="true" /> Remove
                </Button>
              )}
            </div>
          )}
          {description && <p className="text-[12px] text-muted-foreground">{description}</p>}
        </div>
      </div>
      <MediaPickerDialog open={open} onOpenChange={setOpen} onSelect={(a) => onChange(a.id)} kind={kind} />
    </div>
  );
}
