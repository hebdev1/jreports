import { useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Download, FileSignature, Loader2, Mail, Mic, Search, Trash2, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { EmptyState, ErrorState, Forbidden, LoadingBlock, Page, PageHeader, StatusBadge, STATUS_LABELS, useConfirm, usePageTitle } from '@/admin/components/common';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/admin/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { Textarea } from '@/admin/components/ui/textarea';
import { useAuth } from '@/admin/lib/auth';
import { downloadCsv, pgrstLike, toCsv, useList } from '@/admin/lib/data';
import { must, toAdminError } from '@/admin/lib/errors';
import { formatDateTime, formatDay, timeAgo } from '@/admin/lib/format';
import type { Permission } from '@/admin/lib/permissions';
import { sb } from '@/admin/lib/supabase';
import { cn } from '@/admin/lib/utils';
import { NotFoundPage } from './not-found';

type Row = Record<string, unknown> & { id: string; status: string; updated_at: string | null };

interface InboxDef {
  title: string;
  description: string;
  icon: LucideIcon;
  table: string;
  dateColumn: 'created_at' | 'signed_at';
  searchColumns: string[];
  statuses: string[];
  readPermission: Permission;
  updatePermission: Permission;
  deletable: boolean;
  notes: boolean;
  columns: Array<{ header: string; className?: string; cell: (r: Row) => ReactNode }>;
  detail: Array<{ label: string; value: (r: Row) => ReactNode }>;
  exportColumns: Array<{ key: string; label: string }>;
  titleOf: (r: Row) => string;
}

const list = (v: unknown) => (Array.isArray(v) ? v.join(', ') : '—');
const text = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
const mail = (v: unknown) => (v ? <a href={`mailto:${String(v)}`} className="underline underline-offset-4">{String(v)}</a> : '—');
const tel = (v: unknown) => (v ? <a href={`tel:${String(v).replace(/[^+\d]/g, '')}`} className="underline underline-offset-4">{String(v)}</a> : '—');
const long = (v: unknown) => <span className="whitespace-pre-wrap">{text(v)}</span>;

export const INBOX: Record<string, InboxDef> = {
  bookings: {
    title: 'Booking & ad requests',
    description: 'Requests sent from the Booking page form. Mark them as you handle them.',
    icon: CalendarCheck,
    table: 'booking_requests',
    dateColumn: 'created_at',
    searchColumns: ['full_name', 'email', 'organization', 'reference', 'message'],
    statuses: ['new', 'in_review', 'closed'],
    readPermission: 'view',
    updatePermission: 'triage',
    deletable: true,
    notes: true,
    titleOf: (r) => `${r.reference} · ${r.full_name}`,
    columns: [
      { header: 'From', className: 'w-[32%]', cell: (r) => <span className="flex flex-col"><span className="truncate font-medium">{text(r.full_name)}</span><span className="truncate text-xs text-muted-foreground">{text(r.organization) === '—' ? text(r.email) : String(r.organization)}</span></span> },
      { header: 'Type', className: 'hidden md:table-cell', cell: (r) => text(r.request_type) },
      { header: 'Reference', className: 'hidden lg:table-cell font-mono text-xs', cell: (r) => text(r.reference) },
    ],
    detail: [
      { label: 'Reference', value: (r) => text(r.reference) },
      { label: 'Type', value: (r) => text(r.request_type) },
      { label: 'Name', value: (r) => text(r.full_name) },
      { label: 'Organization', value: (r) => text(r.organization) },
      { label: 'Email', value: (r) => mail(r.email) },
      { label: 'Phone', value: (r) => tel(r.phone) },
      { label: 'Event date', value: (r) => formatDay(r.event_date as string | null) },
      { label: 'City or venue', value: (r) => text(r.venue) },
      { label: 'Audience', value: (r) => text(r.audience) },
      { label: 'Campaign start', value: (r) => formatDay(r.campaign_start as string | null) },
      { label: 'Product or message', value: (r) => text(r.product) },
      { label: 'Languages', value: (r) => list(r.languages) },
      { label: 'Budget', value: (r) => text(r.budget) },
      { label: 'Details', value: (r) => long(r.message) },
    ],
    exportColumns: [
      { key: 'reference', label: 'Reference' }, { key: 'created_at', label: 'Received' }, { key: 'status', label: 'Status' }, { key: 'request_type', label: 'Type' },
      { key: 'full_name', label: 'Name' }, { key: 'organization', label: 'Organization' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
      { key: 'event_date', label: 'Event date' }, { key: 'venue', label: 'Venue' }, { key: 'audience', label: 'Audience' }, { key: 'campaign_start', label: 'Campaign start' },
      { key: 'product', label: 'Product' }, { key: 'languages', label: 'Languages' }, { key: 'budget', label: 'Budget' }, { key: 'message', label: 'Details' }, { key: 'notes', label: 'Notes' },
    ],
  },
  guests: {
    title: 'Guest requests',
    description: 'Pitches from people who want to be on the show.',
    icon: Mic,
    table: 'guest_requests',
    dateColumn: 'created_at',
    searchColumns: ['full_name', 'email', 'title_org', 'reference', 'pitch'],
    statuses: ['new', 'in_review', 'accepted', 'declined'],
    readPermission: 'view',
    updatePermission: 'triage',
    deletable: true,
    notes: true,
    titleOf: (r) => `${r.reference} · ${r.full_name}`,
    columns: [
      { header: 'Guest', className: 'w-[32%]', cell: (r) => <span className="flex flex-col"><span className="truncate font-medium">{text(r.full_name)}</span><span className="truncate text-xs text-muted-foreground">{text(r.title_org)}</span></span> },
      { header: 'Topic', className: 'hidden md:table-cell', cell: (r) => text(r.topic) },
      { header: 'Format', className: 'hidden lg:table-cell', cell: (r) => text(r.format) },
    ],
    detail: [
      { label: 'Reference', value: (r) => text(r.reference) },
      { label: 'Name', value: (r) => text(r.full_name) },
      { label: 'Title or organization', value: (r) => text(r.title_org) },
      { label: 'Email', value: (r) => mail(r.email) },
      { label: 'Phone', value: (r) => tel(r.phone) },
      { label: 'Topic', value: (r) => text(r.topic) },
      { label: 'Languages', value: (r) => list(r.languages) },
      { label: 'Format', value: (r) => text(r.format) },
      { label: 'Links', value: (r) => long(r.links) },
      { label: 'Pitch', value: (r) => long(r.pitch) },
    ],
    exportColumns: [
      { key: 'reference', label: 'Reference' }, { key: 'created_at', label: 'Received' }, { key: 'status', label: 'Status' }, { key: 'full_name', label: 'Name' },
      { key: 'title_org', label: 'Title / org' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'topic', label: 'Topic' },
      { key: 'languages', label: 'Languages' }, { key: 'format', label: 'Format' }, { key: 'links', label: 'Links' }, { key: 'pitch', label: 'Pitch' }, { key: 'notes', label: 'Notes' },
    ],
  },
  releases: {
    title: 'Talent releases',
    description: 'Signed guest releases. They contain personal data: open them only when needed.',
    icon: FileSignature,
    table: 'talent_releases',
    dateColumn: 'signed_at',
    searchColumns: ['legal_name', 'screen_name', 'email', 'reference', 'episode'],
    statuses: ['valid', 'void'],
    readPermission: 'view_releases',
    updatePermission: 'view_releases',
    deletable: false,
    notes: true,
    titleOf: (r) => `${r.reference} · ${r.legal_name}`,
    columns: [
      { header: 'Guest', className: 'w-[32%]', cell: (r) => <span className="flex flex-col"><span className="truncate font-medium">{text(r.legal_name)}</span><span className="truncate text-xs text-muted-foreground">{text(r.episode)}</span></span> },
      { header: 'Recording', className: 'hidden md:table-cell', cell: (r) => formatDay(r.recording_date as string) },
      { header: 'Minor', className: 'hidden lg:table-cell', cell: (r) => (r.is_minor ? `Yes · ${text(r.guardian_name)}` : 'No') },
    ],
    detail: [
      { label: 'Document', value: (r) => text(r.reference) },
      { label: 'Signed', value: (r) => formatDateTime(r.signed_at as string) },
      { label: 'Terms version', value: (r) => text(r.terms_version) },
      { label: 'Legal name', value: (r) => text(r.legal_name) },
      { label: 'Name on screen', value: (r) => text(r.screen_name) },
      { label: 'Email', value: (r) => mail(r.email) },
      { label: 'Phone', value: (r) => tel(r.phone) },
      { label: 'Mailing address', value: (r) => text(r.mailing_address) },
      { label: 'Date of birth', value: (r) => formatDay(r.date_of_birth as string) },
      { label: 'Episode or segment', value: (r) => text(r.episode) },
      { label: 'Recording date', value: (r) => formatDay(r.recording_date as string) },
      { label: 'Guardian', value: (r) => (r.is_minor ? `${text(r.guardian_name)} (${text(r.guardian_relationship)})` : 'Not a minor') },
      { label: 'Signature', value: (r) => <span className="font-[cursive] text-lg">{text(r.signature)}</span> },
      { label: 'Signed from', value: (r) => `${text(r.signer_ip)} · ${text(r.user_agent)}` },
    ],
    exportColumns: [
      { key: 'reference', label: 'Document' }, { key: 'signed_at', label: 'Signed' }, { key: 'status', label: 'Status' }, { key: 'legal_name', label: 'Legal name' },
      { key: 'screen_name', label: 'Name on screen' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'episode', label: 'Episode' },
      { key: 'recording_date', label: 'Recording date' }, { key: 'is_minor', label: 'Minor' }, { key: 'guardian_name', label: 'Guardian' }, { key: 'terms_version', label: 'Terms' },
    ],
  },
  subscribers: {
    title: 'Subscribers',
    description: 'People who signed up for the James Reports briefing and premiere alerts. Export the list into your email tool.',
    icon: Mail,
    table: 'newsletter_subscribers',
    dateColumn: 'created_at',
    searchColumns: ['email'],
    statuses: ['subscribed', 'unsubscribed'],
    readPermission: 'view',
    updatePermission: 'triage',
    deletable: true,
    notes: false,
    titleOf: (r) => String(r.email),
    columns: [
      { header: 'Email', className: 'w-[36%]', cell: (r) => <span className="truncate font-medium">{text(r.email)}</span> },
      { header: 'Language', className: 'hidden md:table-cell', cell: (r) => text(r.language) },
      {
        header: 'Alerts',
        className: 'hidden lg:table-cell',
        cell: (r) => [r.alert_premiere && 'Premieres', r.alert_briefing && 'Briefing', r.alert_breaking && 'Breaking'].filter(Boolean).join(', ') || '—',
      },
    ],
    detail: [
      { label: 'Email', value: (r) => mail(r.email) },
      { label: 'Language', value: (r) => text(r.language) },
      { label: 'Premiere alerts', value: (r) => (r.alert_premiere ? 'Yes' : 'No') },
      { label: 'Weekly briefing', value: (r) => (r.alert_briefing ? 'Yes' : 'No') },
      { label: 'Breaking news', value: (r) => (r.alert_breaking ? 'Yes' : 'No') },
      { label: 'Signed up from', value: (r) => (r.source === 'footer' ? 'Footer form' : 'Subscribe button') },
    ],
    exportColumns: [
      { key: 'email', label: 'Email' }, { key: 'language', label: 'Language' }, { key: 'status', label: 'Status' }, { key: 'alert_premiere', label: 'Premieres' },
      { key: 'alert_briefing', label: 'Briefing' }, { key: 'alert_breaking', label: 'Breaking' }, { key: 'source', label: 'Source' }, { key: 'created_at', label: 'Signed up' },
    ],
  },
};

const PAGE_SIZE = 25;

export function InboxPage() {
  const { kind = '' } = useParams();
  const def = INBOX[kind];
  if (!def) return <NotFoundPage />;
  return <InboxView key={kind} def={def} />;
}

function InboxView({ def }: Readonly<{ def: InboxDef }>) {
  usePageTitle(def.title);
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const status = params.get('status') ?? 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => (params.get('q') ?? '') !== search && setParam('q', search || null), 300);
    return () => clearTimeout(t);
    // Only the typed text should trigger this.
  }, [search]);

  const rows = useList<Row>({
    table: def.table,
    select: '*',
    page,
    pageSize: PAGE_SIZE,
    search: params.get('q') ?? '',
    searchColumns: def.searchColumns,
    filters: { status: status === 'all' ? undefined : status },
    sort: { column: def.dateColumn, ascending: false },
  });

  if (!can(def.readPermission)) return <Forbidden permission={def.readPermission} />;

  const exportCsv = async () => {
    setExporting(true);
    try {
      let q = sb.from(def.table).select('*').order(def.dateColumn, { ascending: false }).limit(5000);
      if (status !== 'all') q = q.eq('status', status);
      const term = params.get('q')?.trim();
      if (term) q = q.or(def.searchColumns.map((c) => `${c}.ilike.${pgrstLike(term)}`).join(','));
      const data = must(await q) as Row[];
      downloadCsv(`${def.table}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data, def.exportColumns));
      toast.success(`Exported ${data.length} row${data.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(toAdminError(err).message);
    } finally {
      setExporting(false);
    }
  };

  const data = rows.data?.rows ?? [];
  const count = rows.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const selected = data.find((r) => r.id === openId) ?? null;

  return (
    <Page width="wide">
      <PageHeader
        title={def.title}
        description={def.description}
        actions={
          can('export') && (
            <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting || count === 0}>
              {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />} Export CSV
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={status} onValueChange={(v) => setParam('status', v === 'all' ? null : v)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">All</TabsTrigger>
            {def.statuses.map((s) => (
              <TabsTrigger key={s} value={s}>
                {STATUS_LABELS[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label={`Search ${def.title.toLowerCase()}`} className="pl-8" />
        </div>
      </div>

      {rows.isError ? (
        <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />
      ) : rows.isPending ? (
        <LoadingBlock rows={6} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={def.icon}
          title={params.get('q') || status !== 'all' ? 'Nothing matches' : 'Nothing here yet'}
          description={params.get('q') || status !== 'all' ? 'Try another search or status.' : 'New submissions from the website appear here as soon as they’re sent.'}
        />
      ) : (
        <div className={cn('overflow-hidden rounded-xl border bg-card', rows.isFetching && 'opacity-70')}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {def.columns.map((c) => (
                  <TableHead key={c.header} className={c.className}>
                    {c.header}
                  </TableHead>
                ))}
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="hidden w-[130px] sm:table-cell">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                  {def.columns.map((c, i) => (
                    <TableCell key={c.header} className={cn('max-w-0', c.className)}>
                      {i === 0 ? (
                        <button type="button" className="block w-full min-w-0 text-left" onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }} aria-label={`Open ${def.titleOf(r)}`}>
                          {c.cell(r)}
                        </button>
                      ) : (
                        c.cell(r)
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="hidden text-[13px] text-muted-foreground sm:table-cell" title={formatDateTime(r[def.dateColumn] as string)}>
                    {timeAgo(r[def.dateColumn] as string)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-[13px] text-muted-foreground">
            <span aria-live="polite">{`Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, count)} of ${count}`}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
                Previous
              </Button>
              <span className="px-2 tabular-nums">
                {page} / {pages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setParam('page', String(page + 1))}>
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      <SubmissionSheet def={def} row={selected} onClose={() => setOpenId(null)} />
    </Page>
  );
}

function SubmissionSheet({ def, row, onClose }: Readonly<{ def: InboxDef; row: Row | null; onClose: () => void }>) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const stamp = row ? `${row.id}:${row.updated_at}` : null;
  if (row && loadedFor !== stamp) {
    setLoadedFor(stamp);
    setStatus(row.status);
    setNotes(String(row.notes ?? ''));
  }
  const editable = can(def.updatePermission);
  const dirty = row !== null && (status !== row.status || (def.notes && notes !== String(row.notes ?? '')));

  const save = async () => {
    if (!row) return;
    setSaving(true);
    try {
      let q = sb.from(def.table).update(def.notes ? { status, notes } : { status }).eq('id', row.id);
      q = row.updated_at ? q.eq('updated_at', row.updated_at) : q.is('updated_at', null);
      const res = must(await q.select('id'));
      if (!res?.length) throw toAdminError({ message: 'conflict' });
      await Promise.all([qc.invalidateQueries({ queryKey: ['list'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]);
      toast.success('Saved');
    } catch (err) {
      toast.error(toAdminError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!row) return;
    const ok = await confirm({ title: 'Delete this submission?', description: 'Use this for spam or at the sender’s request. It can’t be undone.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      must(await sb.from(def.table).delete().eq('id', row.id).select('id'));
      await Promise.all([qc.invalidateQueries({ queryKey: ['list'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]);
      toast.success('Deleted');
      onClose();
    } catch (err) {
      toast.error(toAdminError(err).message);
    }
  };

  return (
    <Sheet open={row !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {row && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">{def.titleOf(row)}</SheetTitle>
              <SheetDescription>
                Received {formatDateTime(row[def.dateColumn] as string)}
                {row.updated_at && ` · updated ${timeAgo(row.updated_at)}`}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-6 px-4 pb-8">
              <dl className="grid gap-x-4 gap-y-3 text-[13px] sm:grid-cols-[150px_1fr]">
                {def.detail.map((d) => (
                  <div key={d.label} className="contents">
                    <dt className="text-muted-foreground">{d.label}</dt>
                    <dd className="min-w-0 break-words">{d.value(row)}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid gap-4 rounded-xl border p-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="sub-status">Status</Label>
                  <Select value={status} onValueChange={setStatus} disabled={!editable}>
                    <SelectTrigger id="sub-status" className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {def.statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {def.notes && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="sub-notes">Team notes</Label>
                    <Textarea id="sub-notes" rows={4} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable} aria-describedby="sub-notes-help" />
                    <p id="sub-notes-help" className="text-[12px] text-muted-foreground">
                      Only the team sees these.
                    </p>
                  </div>
                )}
                {!editable && <p className="text-[12px] text-muted-foreground">You can read this but not change it.</p>}
                <div className="flex flex-wrap gap-2">
                  {editable && (
                    <Button onClick={() => void save()} disabled={!dirty || saving}>
                      {saving && <Loader2 className="animate-spin" aria-hidden="true" />} Save
                    </Button>
                  )}
                  {def.deletable && can('delete') && (
                    <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => void remove()}>
                      <Trash2 aria-hidden="true" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
