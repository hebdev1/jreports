import { useQueryClient } from '@tanstack/react-query';
import { ImageOff, Images, Loader2, Search, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/admin/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/admin/components/ui/dialog';
import { Input } from '@/admin/components/ui/input';
import { useAuth } from '@/admin/lib/auth';
import { MEDIA_SELECT, uploadMedia, useList, useMediaByIds, validateImageFile, type MediaAsset } from '@/admin/lib/data';
import { cn } from '@/admin/lib/utils';
import { EmptyState, ErrorState, LoadingBlock } from './common';

/** Thumbnail for a media asset; bundled images resolve against the site's /assets folder. */
export function MediaThumb({ asset, className, alt }: Readonly<{ asset: Pick<MediaAsset, 'url' | 'alt'> | null | undefined; className?: string; alt?: string }>) {
  const [broken, setBroken] = useState(false);
  if (!asset || broken) {
    return (
      <span className={cn('grid place-items-center bg-muted text-muted-foreground', className)}>
        <ImageOff className="size-5" aria-hidden="true" />
        <span className="sr-only">{asset ? 'Image failed to load' : 'No image'}</span>
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
}

export function MediaPickerDialog({ open, onOpenChange, onSelect, storageOnly }: Readonly<PickerProps>) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [progress, setProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = useList<MediaAsset>({
    table: 'media_assets',
    select: MEDIA_SELECT,
    page,
    pageSize: 24,
    search,
    searchColumns: ['file_name', 'alt'],
    filters: storageOnly ? { source: 'storage' } : undefined,
    sort: { column: 'created_at', ascending: false },
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setProgress(0);
    try {
      const asset = await uploadMedia(file, '', setProgress);
      await qc.invalidateQueries({ queryKey: ['list'] });
      toast.success('Image uploaded. Add a description in the media library.');
      onSelect(asset);
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pages = Math.max(1, Math.ceil((list.data?.count ?? 0) / 24));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] w-[min(100vw-2rem,56rem)] max-w-none overflow-y-auto sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
          <DialogDescription>{storageOnly ? 'Only uploaded images can be used here.' : 'Pick from the media library or upload a new image.'}</DialogDescription>
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
              aria-label="Search images"
              className="pl-8"
            />
          </div>
          {can('upload_media') && (
            <>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e.target.files?.[0])} aria-hidden="true" />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={progress !== null}>
                {progress !== null ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                {progress !== null ? `Uploading ${progress}%` : 'Upload'}
              </Button>
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
          <EmptyState icon={Images} title={search ? 'No images match your search' : 'No images yet'} description={can('upload_media') ? 'Upload an image to use it here.' : undefined} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Images">
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
                  <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground group-hover:text-foreground">{m.file_name || m.path}</span>
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

/** Form control: shows the chosen image with Change / Remove. Value is a media id. */
export function MediaField({
  value,
  onChange,
  label,
  description,
  disabled,
  aspect = '16 / 9',
  allowClear = true,
}: Readonly<{ value: string | null; onChange: (id: string | null) => void; label: string; description?: string; disabled?: boolean; aspect?: string; allowClear?: boolean }>) {
  const [open, setOpen] = useState(false);
  const media = useMediaByIds([value]);
  const asset = value ? media.data?.[value] : null;
  return (
    <div className="grid gap-1.5">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="flex flex-wrap items-start gap-4 rounded-lg border p-3">
        <div className="w-40 overflow-hidden rounded-md border" style={{ aspectRatio: aspect }}>
          {media.isFetching && value && !asset ? <div className="size-full animate-pulse bg-muted" /> : <MediaThumb asset={asset} className="size-full" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-[13px]">{asset ? asset.file_name || asset.path : value ? 'Loading…' : 'No image selected'}</p>
          {asset && !asset.alt && <p className="text-[12px] text-warning">This image has no description (alt text). Add one in the media library.</p>}
          {!disabled && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
                <Images aria-hidden="true" /> {value ? 'Change' : 'Choose image'}
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
      <MediaPickerDialog open={open} onOpenChange={setOpen} onSelect={(a) => onChange(a.id)} />
    </div>
  );
}
