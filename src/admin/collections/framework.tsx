import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  ExternalLink,
  Eye,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Trash2,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useForm, type DefaultValues, type FieldValues, type Resolver, type UseFormReturn } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type { ZodType } from 'zod';
import { EmptyState, ErrorState, LoadingBlock, Page, PageHeader, StatusBadge, useConfirm, usePageTitle, useUnsavedGuard } from '@/admin/components/common';
import { Button } from '@/admin/components/ui/button';
import { Checkbox } from '@/admin/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/admin/components/ui/dropdown-menu';
import { Input } from '@/admin/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/admin/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { useAuth } from '@/admin/lib/auth';
import { useList, type ContentEntity, type ContentStatus } from '@/admin/lib/data';
import { AdminError, must, toAdminError } from '@/admin/lib/errors';
import { formatDateTime, timeAgo } from '@/admin/lib/format';
import { sb } from '@/admin/lib/supabase';
import { cn } from '@/admin/lib/utils';

export interface ContentRow {
  status: ContentStatus;
  version: number;
  updated_at: string;
  published_at: string | null;
  [key: string]: unknown;
}

export interface CollectionDef<F extends FieldValues, R extends ContentRow = ContentRow> {
  entity: ContentEntity;
  singular: string;
  plural: string;
  basePath: string;
  description: string;
  icon: LucideIcon;
  listSelect: string;
  idOf: (row: R) => string;
  titleOf: (row: R) => string;
  searchColumns: string[];
  sorts: Array<{ value: string; label: string; column: string; ascending: boolean }>;
  filters?: Array<{ key: string; label: string; options: ReadonlyArray<{ value: string; label: string }> }>;
  columns: Array<{ header: string; className?: string; cell: (row: R) => ReactNode }>;
  schema: ZodType<F>;
  empty: () => F;
  fromRow: (row: R) => F;
  toRow: (form: F) => Record<string, unknown>;
  Fields: ComponentType<{ form: UseFormReturn<F>; disabled: boolean; isNew: boolean }>;
  /** Client-chosen primary key (text slugs); otherwise the database generates it. */
  makeId?: (form: F) => string;
  publicUrl?: (row: R) => string | null;
  previewUrl?: (id: string) => string | null;
  ordered?: boolean;
  Preview?: ComponentType<{ values: F }>;
}

const PAGE_SIZE = 20;
const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'archived', label: 'Archived' },
];

function useDraftIds(entity: ContentEntity) {
  return useQuery({
    queryKey: ['drafts', entity],
    queryFn: async () => new Set((must(await sb.from('content_drafts').select('entity_id').eq('entity', entity)) as Array<{ entity_id: string }>).map((d) => d.entity_id)),
  });
}

async function updateWithVersion(table: string, id: string, version: number, payload: Record<string, unknown>) {
  const { data, error } = await sb.from(table).update(payload).eq('id', id).eq('version', version).select('*');
  if (error) throw toAdminError(error);
  if (!data?.length) {
    const cur = must(await sb.from(table).select('version').eq('id', id)) as Array<{ version: number }>;
    if (!cur.length) throw new AdminError('not_found', 'This item no longer exists. It may have been deleted.');
    throw new AdminError('conflict', 'Someone else changed this since you opened it. Reload to see their version before saving again.');
  }
  return data[0] as ContentRow;
}

// ===================================================================== list

export function CollectionList<F extends FieldValues, R extends ContentRow>({ def }: Readonly<{ def: CollectionDef<F, R> }>) {
  usePageTitle(def.plural);
  const { can } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(params.get('q') ?? '');

  const status = params.get('status') ?? 'all';
  const sortKey = params.get('sort') ?? def.sorts[0].value;
  const sort = def.sorts.find((s) => s.value === sortKey) ?? def.sorts[0];
  const page = Math.max(1, Number(params.get('page')) || 1);
  const filters: Record<string, string | undefined> = { status: status === 'all' ? undefined : status };
  for (const f of def.filters ?? []) filters[f.key] = params.get(f.key) ?? undefined;

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
    setSelected(new Set());
  };

  // Debounce the search box into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== search) setParam('q', search || null);
    }, 300);
    return () => clearTimeout(t);
    // setParam is recreated every render; only the typed text matters here.
  }, [search]);

  const list = useList<R>({ table: def.entity, select: def.listSelect, page, pageSize: PAGE_SIZE, search: params.get('q') ?? '', searchColumns: def.searchColumns, filters, sort: { column: sort.column, ascending: sort.ascending } });
  const drafts = useDraftIds(def.entity);
  const rows = list.data?.rows ?? [];
  const count = list.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const filtered = Boolean(params.get('q') || status !== 'all' || (def.filters ?? []).some((f) => params.get(f.key)));
  const orderMode = Boolean(def.ordered && sort.column === 'sort_order' && !filtered);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['list'] }), qc.invalidateQueries({ queryKey: ['drafts'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]);

  const runBulk = async (label: string, fn: (row: R) => Promise<unknown>) => {
    const targets = rows.filter((r) => selected.has(def.idOf(r)));
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const r of targets) {
      try {
        await fn(r);
        ok += 1;
      } catch (err) {
        failed.push(`${def.titleOf(r)}: ${toAdminError(err).message}`);
      }
    }
    setBusy(false);
    setSelected(new Set());
    await refresh();
    if (ok) toast.success(`${label}: ${ok} ${ok === 1 ? def.singular.toLowerCase() : def.plural.toLowerCase()}`);
    if (failed.length) toast.error(`${failed.length} couldn’t be changed`, { description: failed.slice(0, 3).join('\n') });
  };

  const bulk = {
    publish: () => runBulk('Published', async (r) => must(await sb.rpc('admin_publish', { p_entity: def.entity, p_id: def.idOf(r), p_expected_version: r.version }))),
    unpublish: () => runBulk('Unpublished', (r) => updateWithVersion(def.entity, def.idOf(r), r.version, { status: 'draft' })),
    archive: () => runBulk('Archived', (r) => updateWithVersion(def.entity, def.idOf(r), r.version, { status: 'archived' })),
    remove: async () => {
      const ok = await confirm({
        title: `Delete ${selected.size} ${selected.size === 1 ? def.singular.toLowerCase() : def.plural.toLowerCase()}?`,
        description: 'Published items are skipped; unpublish them first. This can’t be undone.',
        confirmLabel: 'Delete',
        destructive: true,
      });
      if (ok)
        await runBulk('Deleted', async (r) => {
          if (r.status === 'published') throw new AdminError('validation', 'Unpublish it first.');
          must(await sb.from(def.entity).delete().eq('id', def.idOf(r)).select('id'));
        });
    },
  };

  const move = async (index: number, dir: -1 | 1) => {
    const a = rows[index];
    const b = rows[index + dir];
    if (!a || !b) return;
    setBusy(true);
    try {
      const aOrder = Number(a.sort_order);
      const bOrder = Number(b.sort_order);
      await updateWithVersion(def.entity, def.idOf(a), a.version, { sort_order: bOrder === aOrder ? bOrder + dir : bOrder });
      await updateWithVersion(def.entity, def.idOf(b), b.version, { sort_order: aOrder });
      await refresh();
    } catch (err) {
      toast.error(toAdminError(err).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(def.idOf(r)));
  const canManage = can('publish');

  return (
    <Page width="wide">
      <PageHeader
        title={def.plural}
        description={def.description}
        actions={
          can('edit_content') && (
            <Button asChild>
              <Link to={`${def.basePath}/new`}>
                <Plus aria-hidden="true" /> New {def.singular.toLowerCase()}
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={status} onValueChange={(v) => setParam('status', v === 'all' ? null : v)}>
          <TabsList>
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${def.plural.toLowerCase()}`} aria-label={`Search ${def.plural.toLowerCase()}`} className="pl-8" />
          </div>
          {(def.filters ?? []).map((f) => (
            <Select key={f.key} value={params.get(f.key) ?? 'all'} onValueChange={(v) => setParam(f.key, v === 'all' ? null : v)}>
              <SelectTrigger className="w-[150px]" aria-label={f.label}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {f.label.toLowerCase()}s</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          <Select value={sort.value} onValueChange={(v) => setParam('sort', v === def.sorts[0].value ? null : v)}>
            <SelectTrigger className="w-[170px]" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {def.sorts.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected.size > 0 && canManage && (
        <div role="region" aria-label="Bulk actions" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-accent/60 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void bulk.publish()}>
            <Send aria-hidden="true" /> Publish
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void bulk.unpublish()}>
            <Undo2 aria-hidden="true" /> Unpublish
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void bulk.archive()}>
            <Archive aria-hidden="true" /> Archive
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => void bulk.remove()}>
            <Trash2 aria-hidden="true" /> Delete
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
          {busy && <Loader2 className="size-4 animate-spin" aria-label="Working" />}
        </div>
      )}

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <LoadingBlock rows={6} />
      ) : rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={Search}
            title={`No ${def.plural.toLowerCase()} match`}
            description="Try a different search or status."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('');
                  setParams(new URLSearchParams(), { replace: true });
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={def.icon}
            title={`No ${def.plural.toLowerCase()} yet`}
            description={def.description}
            action={
              can('edit_content') && (
                <Button asChild>
                  <Link to={`${def.basePath}/new`}>
                    <Plus aria-hidden="true" /> New {def.singular.toLowerCase()}
                  </Link>
                </Button>
              )
            }
          />
        )
      ) : (
        <div className={cn('overflow-hidden rounded-xl border bg-card transition-opacity', list.isFetching && 'opacity-70')}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {canManage && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(v) => setSelected(v ? new Set(rows.map(def.idOf)) : new Set())}
                      aria-label="Select all on this page"
                    />
                  </TableHead>
                )}
                {def.columns.map((c) => (
                  <TableHead key={c.header} className={c.className}>
                    {c.header}
                  </TableHead>
                ))}
                <TableHead className="w-[130px]">Status</TableHead>
                <TableHead className="hidden w-[120px] md:table-cell">Updated</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const id = def.idOf(r);
                const hasDraft = drafts.data?.has(id);
                const editPath = `${def.basePath}/${encodeURIComponent(id)}`;
                return (
                  <TableRow key={id} data-state={selected.has(id) ? 'selected' : undefined} className="group">
                    {canManage && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(id)}
                          onCheckedChange={(v) => {
                            const next = new Set(selected);
                            if (v) next.add(id);
                            else next.delete(id);
                            setSelected(next);
                          }}
                          aria-label={`Select ${def.titleOf(r)}`}
                        />
                      </TableCell>
                    )}
                    {def.columns.map((c, ci) => (
                      <TableCell key={c.header} className={cn('max-w-0', c.className)}>
                        {ci === 0 ? (
                          <Link to={editPath} className="block truncate font-medium text-foreground underline-offset-4 hover:underline">
                            {c.cell(r)}
                          </Link>
                        ) : (
                          c.cell(r)
                        )}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={r.status} />
                        {hasDraft && <StatusBadge status="changes" />}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-[13px] text-muted-foreground md:table-cell" title={formatDateTime(r.updated_at)}>
                      {timeAgo(r.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {orderMode && can('publish') && (
                          <>
                            <Button size="icon-sm" variant="ghost" disabled={busy || i === 0} onClick={() => void move(i, -1)} aria-label={`Move ${def.titleOf(r)} up`}>
                              <ArrowUp />
                            </Button>
                            <Button size="icon-sm" variant="ghost" disabled={busy || i === rows.length - 1} onClick={() => void move(i, 1)} aria-label={`Move ${def.titleOf(r)} down`}>
                              <ArrowDown />
                            </Button>
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${def.titleOf(r)}`}>
                              <Ellipsis />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => navigate(editPath)}>{can('edit_content') ? 'Edit' : 'View'}</DropdownMenuItem>
                            {r.status === 'published' && def.publicUrl?.(r) && (
                              <DropdownMenuItem asChild>
                                <a href={def.publicUrl(r)!} target="_blank" rel="noopener">
                                  View on site <ExternalLink className="ml-auto" />
                                </a>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-[13px] text-muted-foreground">
            <span aria-live="polite">
              {count === 0 ? 'No results' : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, count)} of ${count}`}
              {def.ordered && !orderMode && ' · Sort by “Display order” with no filters to reorder.'}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
                <ChevronLeft aria-hidden="true" /> Previous
              </Button>
              <span className="px-2 tabular-nums">
                {page} / {pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setParam('page', String(page + 1))}>
                Next <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

// =================================================================== editor

interface Loaded<R> {
  row: R | null;
  draft: { data: Record<string, unknown>; base_version: number; updated_at: string } | null;
}

interface Revision {
  id: number;
  version: number | null;
  action: string;
  snapshot: Record<string, unknown>;
  actor_email: string | null;
  created_at: string;
}

const REVISION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Saved',
  published: 'Published',
  unpublished: 'Unpublished',
  archived: 'Archived',
  draft_saved: 'Draft saved',
};

export function CollectionEditor<F extends FieldValues, R extends ContentRow>({ def }: Readonly<{ def: CollectionDef<F, R> }>) {
  const { id: rawId } = useParams();
  const isNew = rawId === 'new' || rawId === undefined;
  const id = isNew ? null : decodeURIComponent(rawId!);
  const { can } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [conflict, setConflict] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const record = useQuery({
    queryKey: ['record', def.entity, id],
    enabled: !isNew,
    queryFn: async (): Promise<Loaded<R>> => {
      const [row, draft] = await Promise.all([
        sb.from(def.entity).select('*').eq('id', id!).maybeSingle(),
        sb.from('content_drafts').select('data, base_version, updated_at').eq('entity', def.entity).eq('entity_id', id!).maybeSingle(),
      ]);
      if (row.error) throw toAdminError(row.error);
      if (draft.error) throw toAdminError(draft.error);
      return { row: row.data as R | null, draft: draft.data as Loaded<R>['draft'] };
    },
  });

  const row = record.data?.row ?? null;
  const draft = record.data?.draft ?? null;
  const initial = useMemo<F>(() => (row ? def.fromRow({ ...row, ...(draft?.data ?? {}) } as R) : def.empty()), [row, draft, def]);

  const form = useForm<F>({ resolver: zodResolver(def.schema as never) as unknown as Resolver<F>, defaultValues: initial as DefaultValues<F>, mode: 'onTouched' });
  useEffect(() => {
    form.reset(initial);
  }, [initial, form]);

  const values = form.watch();
  const title = isNew ? `New ${def.singular.toLowerCase()}` : row ? def.titleOf({ ...row, ...(draft?.data ?? {}) } as R) || `Untitled ${def.singular.toLowerCase()}` : def.singular;
  usePageTitle(title, true);
  useUnsavedGuard(form.formState.isDirty && working === null);

  const readOnly = !can('edit_content');
  const status: ContentStatus = row?.status ?? 'draft';
  const live = status === 'published';

  const afterWrite = async (message: string, nextId?: string) => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['list'] }),
      qc.invalidateQueries({ queryKey: ['drafts', def.entity] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
      qc.invalidateQueries({ queryKey: ['revisions', def.entity, id] }),
    ]);
    toast.success(message);
    if (nextId && nextId !== id) {
      form.reset(form.getValues());
      navigate(`${def.basePath}/${encodeURIComponent(nextId)}`, { replace: true });
    } else {
      const fresh = await record.refetch();
      if (fresh.data?.row) form.reset(def.fromRow({ ...fresh.data.row, ...(fresh.data.draft?.data ?? {}) } as R));
    }
  };

  const fail = (err: unknown) => {
    const e = toAdminError(err);
    if (e.kind === 'conflict') setConflict(e.message);
    else toast.error(e.message);
  };

  /** Writes the form to the right place: the row itself (drafts) or a private draft (live items). */
  const persist = async (data: F): Promise<{ id: string; version: number }> => {
    const payload = def.toRow(data);
    if (isNew) {
      const insert = def.makeId ? { id: def.makeId(data), ...payload } : payload;
      const created = must(await sb.from(def.entity).insert({ ...insert, status: 'draft' }).select('id, version').single()) as { id: string | number; version: number };
      return { id: String(created.id), version: created.version };
    }
    if (live) {
      if (draft) {
        const saved = must(await sb.from('content_drafts').update({ data: payload }).eq('entity', def.entity).eq('entity_id', id!).eq('updated_at', draft.updated_at).select('entity_id'));
        if (!saved?.length) throw new AdminError('conflict', 'Someone else saved a draft of this item since you opened it. Reload to see it.');
      } else {
        must(await sb.from('content_drafts').insert({ entity: def.entity, entity_id: id!, data: payload, base_version: row!.version }).select('entity_id'));
      }
      return { id: id!, version: row!.version };
    }
    const updated = await updateWithVersion(def.entity, id!, row!.version, payload);
    if (draft) await sb.from('content_drafts').delete().eq('entity', def.entity).eq('entity_id', id!);
    return { id: id!, version: updated.version };
  };

  const saveDraft = form.handleSubmit(async (data) => {
    setWorking('save');
    try {
      const saved = await persist(data);
      await afterWrite(live ? 'Draft saved. The live version is unchanged until it’s published.' : 'Draft saved', saved.id);
    } catch (err) {
      fail(err);
    } finally {
      setWorking(null);
    }
  });

  const publish = form.handleSubmit(async (data) => {
    setWorking('publish');
    try {
      const saved = await persist(data);
      must(await sb.rpc('admin_publish', { p_entity: def.entity, p_id: saved.id, p_expected_version: saved.version }));
      await afterWrite(live ? 'Changes published. They’re live on the site.' : 'Published. It’s live on the site.', saved.id);
    } catch (err) {
      fail(err);
    } finally {
      setWorking(null);
    }
  });

  const setStatus = async (next: ContentStatus, message: string, ask?: { title: string; description: string; label: string }) => {
    if (!row || !id) return;
    if (ask && !(await confirm({ title: ask.title, description: ask.description, confirmLabel: ask.label }))) return;
    setWorking(next);
    try {
      await updateWithVersion(def.entity, id, row.version, { status: next });
      await afterWrite(message);
    } catch (err) {
      fail(err);
    } finally {
      setWorking(null);
    }
  };

  const discardDraft = async () => {
    if (!(await confirm({ title: 'Discard unpublished changes?', description: 'The editor goes back to the live version. This can’t be undone.', confirmLabel: 'Discard changes', destructive: true }))) return;
    setWorking('discard');
    try {
      must(await sb.from('content_drafts').delete().eq('entity', def.entity).eq('entity_id', id!).select('entity_id'));
      await afterWrite('Unpublished changes discarded');
    } catch (err) {
      fail(err);
    } finally {
      setWorking(null);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: `Delete “${title}”?`, description: 'It will be removed permanently, with its revision history kept for the record. This can’t be undone.', confirmLabel: 'Delete', destructive: true }))) return;
    setWorking('delete');
    try {
      must(await sb.from(def.entity).delete().eq('id', id!).select('id'));
      form.reset(form.getValues());
      await Promise.all([qc.invalidateQueries({ queryKey: ['list'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]);
      toast.success(`${def.singular} deleted`);
      navigate(def.basePath, { replace: true });
    } catch (err) {
      fail(err);
    } finally {
      setWorking(null);
    }
  };

  if (!isNew && record.isPending) {
    return (
      <Page width="narrow">
        <LoadingBlock rows={8} />
      </Page>
    );
  }
  if (!isNew && record.isError) {
    return (
      <Page width="narrow">
        <ErrorState error={record.error} onRetry={() => void record.refetch()} />
      </Page>
    );
  }
  if (!isNew && !row) {
    return (
      <Page width="narrow">
        <EmptyState
          icon={def.icon}
          title={`This ${def.singular.toLowerCase()} doesn’t exist`}
          description="It may have been deleted, or the link is wrong."
          action={
            <Button variant="outline" asChild>
              <Link to={def.basePath}>Back to {def.plural.toLowerCase()}</Link>
            </Button>
          }
        />
      </Page>
    );
  }

  const publicUrl = row && live ? def.publicUrl?.(row) : null;
  const previewUrl = id ? def.previewUrl?.(id) : null;
  const busy = working !== null;
  const { Fields, Preview } = def;

  return (
    <Page width="narrow">
      <Link to={def.basePath} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden="true" /> {def.plural}
      </Link>
      <PageHeader
        title={title}
        meta={
          <>
            {!isNew && <StatusBadge status={status} />}
            {draft && <StatusBadge status="changes" />}
            {row && (
              <span>
                Version {row.version} · saved {timeAgo(row.updated_at)}
                {row.published_at && ` · first published ${formatDateTime(row.published_at)}`}
              </span>
            )}
          </>
        }
        actions={
          <>
            {Preview && (
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye aria-hidden="true" /> Preview
              </Button>
            )}
            {previewUrl && (live ? draft : true) && !isNew && (
              <Button variant="outline" size="sm" asChild>
                <a href={previewUrl} target="_blank" rel="noopener">
                  <Eye aria-hidden="true" /> Preview on site
                </a>
              </Button>
            )}
            {publicUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={publicUrl} target="_blank" rel="noopener">
                  <ExternalLink aria-hidden="true" /> View live
                </a>
              </Button>
            )}
            {!isNew && (
              <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
                <History aria-hidden="true" /> History
              </Button>
            )}
          </>
        }
      />

      {conflict && (
        <div role="alert" className="mb-5 flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm sm:flex-row sm:items-center">
          <p className="flex-1 text-foreground">{conflict}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              setConflict(null);
              const fresh = await record.refetch();
              if (fresh.data?.row) form.reset(def.fromRow({ ...fresh.data.row, ...(fresh.data.draft?.data ?? {}) } as R));
            }}
          >
            <RotateCcw aria-hidden="true" /> Reload latest (discards your edits)
          </Button>
        </div>
      )}
      {live && draft && (
        <p className="mb-5 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-foreground">
          You’re editing unpublished changes to a live {def.singular.toLowerCase()}. Visitors still see the published version until these changes are published.
        </p>
      )}
      {readOnly && <p className="mb-5 rounded-xl border bg-muted px-4 py-3 text-sm text-muted-foreground">You can view this {def.singular.toLowerCase()} but not change it (viewer access).</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveDraft();
        }}
        noValidate
        className="grid gap-5"
      >
        <fieldset disabled={readOnly || busy} className="grid gap-5">
          <legend className="sr-only">{def.singular} details</legend>
          <Fields form={form} disabled={readOnly || busy} isNew={isNew} />
        </fieldset>

        {!readOnly && (
          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <span className="mr-auto text-[12px] text-muted-foreground" aria-live="polite">
              {form.formState.isDirty ? 'Unsaved changes' : isNew ? 'Not saved yet' : 'All changes saved'}
              {!can('publish') && ' · An admin publishes your changes.'}
            </span>
            {status === 'archived' ? (
              can('publish') && (
                <Button type="button" variant="outline" disabled={busy} onClick={() => void setStatus('draft', 'Restored as a draft')}>
                  <RotateCcw aria-hidden="true" /> Restore as draft
                </Button>
              )
            ) : (
              <>
                <Button type="submit" variant={can('publish') ? 'outline' : 'default'} disabled={busy || (!form.formState.isDirty && !isNew)}>
                  {working === 'save' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                  Save draft
                </Button>
                {can('publish') && (
                  <Button type="button" disabled={busy || (live && !draft && !form.formState.isDirty)} onClick={() => void publish()}>
                    {working === 'publish' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                    {live ? 'Publish changes' : 'Publish'}
                  </Button>
                )}
              </>
            )}
            {!isNew && can('publish') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label="More actions" disabled={busy}>
                    <Ellipsis />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {live && draft && (
                    <DropdownMenuItem onSelect={() => void discardDraft()}>
                      <Undo2 /> Discard unpublished changes
                    </DropdownMenuItem>
                  )}
                  {live && (
                    <DropdownMenuItem
                      onSelect={() =>
                        void setStatus('draft', 'Unpublished. It’s no longer on the site.', {
                          title: 'Unpublish?',
                          description: 'It disappears from the public site straight away. You can publish it again later.',
                          label: 'Unpublish',
                        })
                      }
                    >
                      <Undo2 /> Unpublish
                    </DropdownMenuItem>
                  )}
                  {status !== 'archived' && (
                    <DropdownMenuItem
                      onSelect={() =>
                        void setStatus('archived', 'Archived', {
                          title: 'Archive?',
                          description: live ? 'It disappears from the public site and moves to Archived.' : 'It moves to Archived. You can restore it later.',
                          label: 'Archive',
                        })
                      }
                    >
                      <Archive /> Archive
                    </DropdownMenuItem>
                  )}
                  {!live && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => void remove()}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </form>

      {!isNew && <RevisionsSheet open={historyOpen} onOpenChange={setHistoryOpen} entity={def.entity} id={id!} onRestore={(snap) => {
        if (!row) return;
        form.reset(def.fromRow({ ...row, ...snap } as R), { keepDefaultValues: true });
        setHistoryOpen(false);
        toast.info('Loaded into the editor. Review it, then save a draft to keep it.');
      }} canRestore={!readOnly} />}
      {Preview && (
        <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
            <SheetHeader>
              <SheetTitle>Preview</SheetTitle>
              <SheetDescription>How this {def.singular.toLowerCase()} will look on the site, with your current edits.</SheetDescription>
            </SheetHeader>
            <div className="p-4">
              <Preview values={values as F} />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Page>
  );
}

function RevisionsSheet({
  open,
  onOpenChange,
  entity,
  id,
  onRestore,
  canRestore,
}: Readonly<{ open: boolean; onOpenChange: (o: boolean) => void; entity: ContentEntity; id: string; onRestore: (snapshot: Record<string, unknown>) => void; canRestore: boolean }>) {
  const revisions = useQuery({
    queryKey: ['revisions', entity, id],
    enabled: open,
    queryFn: async () =>
      must(await sb.from('content_revisions').select('id, version, action, snapshot, actor_email, created_at').eq('entity', entity).eq('entity_id', id).order('id', { ascending: false }).limit(50)) as Revision[],
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>History</SheetTitle>
          <SheetDescription>Every save, draft and publish, newest first. Load an older version into the editor to recover it.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {revisions.isPending ? (
            <LoadingBlock rows={5} />
          ) : revisions.isError ? (
            <ErrorState error={revisions.error} onRetry={() => void revisions.refetch()} />
          ) : revisions.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <ol className="grid gap-2">
              {revisions.data.map((r) => (
                <li key={r.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{REVISION_LABELS[r.action] ?? r.action}</span>
                    <span className="text-xs text-muted-foreground" title={formatDateTime(r.created_at)}>
                      {timeAgo(r.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.actor_email ?? 'System (initial import)'}
                    {r.version ? ` · version ${r.version}` : ''}
                  </p>
                  {canRestore && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => onRestore(r.snapshot)}>
                      <RotateCcw aria-hidden="true" /> Load into editor
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
