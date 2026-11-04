import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, Copy, Crown, Download, HandHeart, Loader2, Mail, RotateCcw, Search, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { EmptyState, ErrorState, Forbidden, LoadingBlock, Page, PageHeader, Panel, StatusBadge, STATUS_LABELS, useConfirm, usePageTitle, useUnsavedGuard } from '@/admin/components/common';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Label } from '@/admin/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Skeleton } from '@/admin/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { Textarea } from '@/admin/components/ui/textarea';
import { useAuth } from '@/admin/lib/auth';
import { downloadCsv, pgrstExact, pgrstLike, toCsv, useList } from '@/admin/lib/data';
import { must, toAdminError } from '@/admin/lib/errors';
import { formatDateTime, formatMoney, timeAgo } from '@/admin/lib/format';
import { sb } from '@/admin/lib/supabase';
import { cn } from '@/admin/lib/utils';
import { RANGES, rangeBounds, type RangeKey } from './overview';

export type PledgeKind = 'vip' | 'donation';

export interface Pledge {
  id: string;
  reference: string;
  kind: PledgeKind;
  frequency: 'monthly' | 'once';
  amount_cents: number;
  cover_fees: boolean;
  total_cents: number;
  method: string;
  tier: string | null;
  full_name: string;
  email: string;
  status: 'pending_payment' | 'paid' | 'cancelled';
  notes: string;
  created_at: string;
  updated_at: string | null;
  paid_at: string | null;
}

export interface PledgeSummary {
  period: { pledges: number; pledged_cents: number; paid: number; paid_cents: number };
  status: { pending_payment: number; paid: number; cancelled: number };
  pending_cents: number;
  monthly_active: { count: number; people: number; cents: number };
  one_time_paid: { count: number; cents: number };
  by_method: Record<string, number>;
  by_tier: Record<string, number>;
}

const STATUSES = ['pending_payment', 'paid', 'cancelled'] as const;
const METHODS = ['Card', 'PayPal', 'Apple Pay', 'Google Pay', 'Cash App', 'Zelle'];
const PAGE_SIZE = 25;

const KINDS: Record<PledgeKind, { title: string; singular: string; path: string; icon: LucideIcon; description: string }> = {
  vip: {
    title: 'VIP Club',
    singular: 'VIP membership',
    path: '/admin/vip',
    icon: Crown,
    description: 'Members who signed up for the VIP Club ($45.99 a month). No payment is taken on the site: mark a membership “Paid” once the money has arrived.',
  },
  donation: {
    title: 'Donations',
    singular: 'Donation',
    path: '/admin/donations',
    icon: HandHeart,
    description: 'Gifts pledged on the Support page, one-time or monthly. No payment is taken on the site: mark a gift “Paid” once the money has arrived.',
  },
};

export const pledgeAmount = (p: Pick<Pledge, 'total_cents' | 'frequency'>) => `${formatMoney(p.total_cents)}${p.frequency === 'monthly' ? ' / month' : ''}`;
export const supporterName = (p: Pick<Pledge, 'full_name' | 'email'>) => p.full_name.trim() || p.email;

/** A ready-to-edit email to the supporter; it opens in the team member's own mail app. */
export function followUpMail(p: Pledge): string {
  const first = p.full_name.trim().split(/\s+/)[0] || 'there';
  const subject = p.kind === 'vip' ? `Your James Reports VIP Club membership (${p.reference})` : `Thank you for your gift to James Reports (${p.reference})`;
  const what = p.kind === 'vip' ? `joining the James Reports VIP Club (${pledgeAmount(p)})` : `your ${p.frequency === 'monthly' ? 'monthly ' : ''}gift of ${pledgeAmount(p)}`;
  const body = [
    `Hi ${first},`,
    '',
    `Thank you for ${what}. Your reference is ${p.reference}.`,
    p.status === 'pending_payment' ? `You chose to pay by ${p.method}. Here is how to complete your payment:\n\n[payment details]` : '',
    '',
    'James Reports',
  ]
    .filter((l, i, all) => !(l === '' && all[i - 1] === ''))
    .join('\n');
  return `mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function usePledgeSummary(kind: PledgeKind, from: Date, to: Date) {
  return useQuery({
    queryKey: ['pledge-summary', kind, from.toISOString(), to.toISOString()],
    queryFn: async () => must(await sb.rpc('admin_pledge_summary', { p_kind: kind, p_from: from.toISOString(), p_to: to.toISOString() })) as PledgeSummary,
  });
}

function Stat({ label, value, note, loading, tone }: Readonly<{ label: string; value: string; note?: ReactNode; loading: boolean; tone?: 'warning' | 'success' }>) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(11,31,92,0.04)]">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className={cn('mt-2 font-display text-[28px] leading-none tracking-tight tabular-nums', tone === 'warning' && 'text-warning', tone === 'success' && 'text-success')}>{value}</p>
      )}
      {note && !loading && <p className="mt-1.5 text-[12px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function Bars({ title, data, labels, empty }: Readonly<{ title: string; data: Record<string, number> | undefined; labels?: Record<string, string>; empty: string }>) {
  const entries = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <Panel title={title}>
      {!data ? (
        <LoadingBlock rows={3} />
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-2.5">
          {entries.map(([k, n]) => (
            <li key={k} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[13px]">
              <span className="truncate">{labels?.[k] ?? k}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="tabular-nums text-muted-foreground">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ================================================================== list

export function SupportersPage({ kind }: Readonly<{ kind: PledgeKind }>) {
  const meta = KINDS[kind];
  usePageTitle(meta.title);
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [exporting, setExporting] = useState(false);
  const range = (RANGES.some((r) => r.key === params.get('range')) ? params.get('range') : '30d') as RangeKey;
  const { from, to } = useMemo(() => rangeBounds(range), [range]);
  const rangeLabel = range === 'all' ? 'all time' : `the last ${RANGES.find((r) => r.key === range)!.label}`;
  const status = params.get('status') ?? 'all';
  const frequency = params.get('frequency') ?? 'all';
  const method = params.get('method') ?? 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const summary = usePledgeSummary(kind, from, to);
  const s = summary.data;

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v && v !== 'all') next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => (params.get('q') ?? '') !== search && setParam('q', search || null), 300);
    return () => clearTimeout(t);
    // Only the typed text should trigger this.
  }, [search]);

  const filters = { kind, status: status === 'all' ? undefined : status, frequency: frequency === 'all' ? undefined : frequency, method: method === 'all' ? undefined : method };
  const rows = useList<Pledge>({
    table: 'support_pledges',
    select: '*',
    page,
    pageSize: PAGE_SIZE,
    search: params.get('q') ?? '',
    searchColumns: ['email', 'full_name', 'reference'],
    filters,
    sort: { column: 'created_at', ascending: false },
  });

  if (!can('view')) return <Forbidden permission="view" />;

  const exportCsv = async () => {
    setExporting(true);
    try {
      let q = sb.from('support_pledges').select('*').order('created_at', { ascending: false }).limit(5000);
      for (const [k, v] of Object.entries(filters)) if (v) q = q.eq(k, v);
      const term = params.get('q')?.trim();
      if (term) q = q.or(['email', 'full_name', 'reference'].map((c) => `${c}.ilike.${pgrstLike(term)}`).join(','));
      const data = must(await q) as Pledge[];
      downloadCsv(
        `${kind === 'vip' ? 'vip-club' : 'donations'}-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(
          data.map((p) => ({ ...p, amount: (p.amount_cents / 100).toFixed(2), total: (p.total_cents / 100).toFixed(2) })),
          [
            { key: 'reference', label: 'Reference' }, { key: 'created_at', label: 'Received' }, { key: 'status', label: 'Status' }, { key: 'paid_at', label: 'Marked paid' },
            { key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'frequency', label: 'Frequency' }, { key: 'amount', label: 'Amount (USD)' },
            { key: 'cover_fees', label: 'Covers fees' }, { key: 'total', label: 'Total (USD)' }, { key: 'tier', label: 'Tier' }, { key: 'method', label: 'Method' }, { key: 'notes', label: 'Notes' },
          ],
        ),
      );
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
  const filtered = Boolean(params.get('q')) || status !== 'all' || frequency !== 'all' || method !== 'all';

  return (
    <Page width="wide">
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <>
            <Tabs value={range} onValueChange={(v) => setParam('range', v === '30d' ? null : v)}>
              <TabsList aria-label="Date range">
                {RANGES.map((r) => (
                  <TabsTrigger key={r.key} value={r.key} className="px-2.5 text-[12px]">
                    {r.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {can('export') && (
              <Button variant="outline" onClick={() => void exportCsv()} disabled={exporting || count === 0}>
                {exporting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />} Export CSV
              </Button>
            )}
          </>
        }
      />

      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : kind === 'vip' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Active members" value={String(s?.monthly_active.people ?? 0)} note={s ? `${formatMoney(s.monthly_active.cents)} a month in paid memberships` : undefined} loading={!s} tone="success" />
          <Stat label="Awaiting payment" value={String(s?.status.pending_payment ?? 0)} note={s ? `${formatMoney(s.pending_cents)} a month if all pay` : undefined} loading={!s} tone={s?.status.pending_payment ? 'warning' : undefined} />
          <Stat label="New sign-ups" value={String(s?.period.pledges ?? 0)} note={`in ${rangeLabel}`} loading={!s} />
          <Stat label="Marked paid" value={String(s?.period.paid ?? 0)} note={s ? `${formatMoney(s.period.paid_cents)} in ${rangeLabel}` : undefined} loading={!s} />
          <Stat label="Cancelled" value={String(s?.status.cancelled ?? 0)} note="all time" loading={!s} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Received" value={formatMoney(s?.period.paid_cents ?? 0)} note={s ? `${s.period.paid} gift${s.period.paid === 1 ? '' : 's'} marked paid in ${rangeLabel}` : undefined} loading={!s} tone="success" />
          <Stat label="Pledged" value={formatMoney(s?.period.pledged_cents ?? 0)} note={s ? `${s.period.pledges} pledge${s.period.pledges === 1 ? '' : 's'} in ${rangeLabel}` : undefined} loading={!s} />
          <Stat label="Awaiting payment" value={formatMoney(s?.pending_cents ?? 0)} note={s ? `${s.status.pending_payment} pledge${s.status.pending_payment === 1 ? '' : 's'}` : undefined} loading={!s} tone={s?.status.pending_payment ? 'warning' : undefined} />
          <Stat label="Monthly donors" value={String(s?.monthly_active.people ?? 0)} note={s ? `${formatMoney(s.monthly_active.cents)} a month` : undefined} loading={!s} />
          <Stat label="One-time gifts paid" value={String(s?.one_time_paid.count ?? 0)} note={s ? `${formatMoney(s.one_time_paid.cents)} all time` : undefined} loading={!s} />
        </div>
      )}
      <p className="mt-2 text-[12px] text-muted-foreground">Figures count pledges the team has marked as paid. No payment is processed on the website.</p>

      <div className={cn('mt-6 grid gap-6', kind === 'donation' && 'lg:grid-cols-2')}>
        <Bars title="Preferred payment methods" data={s?.by_method} empty="No pledges yet." />
        {kind === 'donation' && <Bars title="Monthly tiers" data={s?.by_tier} labels={{ none: 'One-time or no tier' }} empty="No pledges yet." />}
      </div>

      <div className="mb-4 mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={status} onValueChange={(v) => setParam('status', v)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="all">All</TabsTrigger>
            {STATUSES.map((st) => (
              <TabsTrigger key={st} value={st}>
                {STATUS_LABELS[st]}
                {s && st !== 'cancelled' ? <span className="ml-1 tabular-nums text-muted-foreground">{s.status[st]}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          {kind === 'donation' && (
            <Select value={frequency} onValueChange={(v) => setParam('frequency', v)}>
              <SelectTrigger className="w-[140px]" aria-label="Frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any frequency</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="once">One time</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={method} onValueChange={(v) => setParam('method', v)}>
            <SelectTrigger className="w-[150px]" aria-label="Payment method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any method</SelectItem>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or reference" aria-label={`Search ${meta.title}`} className="pl-8" />
          </div>
        </div>
      </div>

      {rows.isError ? (
        <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />
      ) : rows.isPending ? (
        <LoadingBlock rows={6} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={meta.icon}
          title={filtered ? 'Nothing matches' : kind === 'vip' ? 'No VIP sign-ups yet' : 'No donations yet'}
          description={filtered ? 'Try another search or filter.' : `New ${kind === 'vip' ? 'VIP Club sign-ups' : 'donation pledges'} appear here as soon as they’re sent from the website.`}
        />
      ) : (
        <div className={cn('overflow-hidden rounded-xl border bg-card', rows.isFetching && 'opacity-70')}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[34%]">{kind === 'vip' ? 'Member' : 'Donor'}</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden md:table-cell">{kind === 'vip' ? 'Method' : 'Tier · method'}</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="hidden w-[130px] sm:table-cell">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`${meta.path}/${p.id}`)}>
                  <TableCell className="max-w-0">
                    <Link to={`${meta.path}/${p.id}`} className="flex min-w-0 flex-col focus-visible:outline-none" onClick={(e) => e.stopPropagation()}>
                      <span className="truncate font-medium">{supporterName(p)}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {p.reference}
                        {p.full_name.trim() ? ` · ${p.email}` : ''}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{pledgeAmount(p)}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{kind === 'vip' ? p.method : [p.tier, p.method].filter(Boolean).join(' · ')}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="hidden text-[13px] text-muted-foreground sm:table-cell" title={formatDateTime(p.created_at)}>
                    {timeAgo(p.created_at)}
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
    </Page>
  );
}

// ================================================================ detail

interface AuditEntry {
  id: number;
  occurred_at: string;
  actor_email: string | null;
  action: string;
  changes: Record<string, [unknown, unknown]> | null;
}

/** /admin/pledges/:id → the VIP or Donations page the pledge belongs to (used by audit links). */
export function PledgeRedirect() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['pledge-kind', id], queryFn: async () => must(await sb.from('support_pledges').select('kind').eq('id', id).maybeSingle()) as { kind: PledgeKind } | null });
  if (q.isPending) return <LoadingBlock rows={3} className="p-8" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  return <Navigate to={q.data ? `${KINDS[q.data.kind].path}/${id}` : '/admin/donations'} replace />;
}

export function PledgePage({ kind }: Readonly<{ kind: PledgeKind }>) {
  const meta = KINDS[kind];
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [notes, setNotes] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const pledge = useQuery({
    queryKey: ['pledge', id],
    queryFn: async () => must(await sb.from('support_pledges').select('*').eq('id', id).maybeSingle()) as Pledge | null,
  });
  const p = pledge.data ?? null;
  usePageTitle(p ? `${p.reference} · ${supporterName(p)}` : meta.singular, true);

  const history = useQuery({
    queryKey: ['pledge-history', p?.email],
    enabled: Boolean(p),
    queryFn: async () =>
      must(await sb.from('support_pledges').select('id, reference, kind, frequency, total_cents, status, created_at').ilike('email', pgrstExact(p!.email)).order('created_at', { ascending: false }).limit(50)) as Array<
        Pick<Pledge, 'id' | 'reference' | 'kind' | 'frequency' | 'total_cents' | 'status' | 'created_at'>
      >,
  });
  const activity = useQuery({
    queryKey: ['pledge-activity', id],
    enabled: Boolean(p) && can('view_audit'),
    queryFn: async () => must(await sb.from('audit_log').select('id, occurred_at, actor_email, action, changes').eq('entity', 'support_pledges').eq('entity_id', id).order('occurred_at', { ascending: false }).limit(30)) as AuditEntry[],
  });

  const stamp = p ? `${p.id}:${p.updated_at}` : null;
  if (p && loadedFor !== stamp) {
    setLoadedFor(stamp);
    setNotes(p.notes ?? '');
  }
  const notesDirty = p !== null && notes !== (p.notes ?? '');
  useUnsavedGuard(notesDirty);

  if (pledge.isPending) return <Page width="wide"><LoadingBlock rows={8} /></Page>;
  if (pledge.isError) return <Page width="wide"><ErrorState error={pledge.error} onRetry={() => void pledge.refetch()} /></Page>;
  if (!p) {
    return (
      <Page width="narrow">
        <EmptyState icon={meta.icon} title="This pledge doesn’t exist" description="It may have been removed, or the link is wrong." action={<Button asChild variant="outline"><Link to={meta.path}>Back to {meta.title}</Link></Button>} />
      </Page>
    );
  }
  if (p.kind !== kind) return <Navigate to={`${KINDS[p.kind].path}/${p.id}`} replace />;

  const editable = can('manage_pledges');

  const update = async (patch: Partial<Pick<Pledge, 'status' | 'notes'>>, label: string, done: string) => {
    setBusy(label);
    try {
      let q = sb.from('support_pledges').update(patch).eq('id', p.id);
      q = p.updated_at ? q.eq('updated_at', p.updated_at) : q.is('updated_at', null);
      const res = must(await q.select('id'));
      if (!res?.length) throw toAdminError({ message: 'conflict' });
      await Promise.all(['pledge', 'pledge-history', 'pledge-activity', 'pledge-summary', 'list', 'dashboard'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.success(done);
    } catch (err) {
      const e = toAdminError(err);
      toast.error(e.kind === 'conflict' ? 'Someone else updated this pledge. The latest version has been loaded.' : e.message);
      if (e.kind === 'conflict') void pledge.refetch();
    } finally {
      setBusy(null);
    }
  };

  const markPaid = async () => {
    const ok = await confirm({
      title: `Mark ${p.reference} as paid?`,
      description: `Only do this once ${pledgeAmount(p)} has actually arrived${p.method ? ` (by ${p.method})` : ''}. It counts in the “paid” figures from now on.`,
      confirmLabel: 'Mark as paid',
    });
    if (ok) await update({ status: 'paid' }, 'paid', `${p.reference} marked as paid`);
  };
  const cancel = async () => {
    const ok = await confirm({
      title: `Cancel ${p.reference}?`,
      description: kind === 'vip' ? 'The membership leaves the active members. You can reopen it later.' : 'The pledge stops counting as pledged or paid. You can reopen it later.',
      confirmLabel: 'Cancel pledge',
      destructive: true,
    });
    if (ok) await update({ status: 'cancelled' }, 'cancelled', `${p.reference} cancelled`);
  };
  const reopen = async () => {
    const ok = await confirm({ title: `Reopen ${p.reference}?`, description: 'It goes back to “Awaiting payment”.', confirmLabel: 'Reopen' });
    if (ok) await update({ status: 'pending_payment' }, 'reopen', `${p.reference} reopened`);
  };

  const others = (history.data ?? []).filter((h) => h.id !== p.id);
  const paidTotal = (history.data ?? []).filter((h) => h.status === 'paid').reduce((sum, h) => sum + h.total_cents, 0);

  const facts: Array<[string, ReactNode]> = [
    ['Reference', <span key="r" className="font-mono">{p.reference}</span>],
    [kind === 'vip' ? 'Membership' : 'Gift', kind === 'vip' ? 'VIP Club · monthly' : p.frequency === 'monthly' ? `Monthly${p.tier ? ` · ${p.tier}` : ''}` : 'One time'],
    ['Amount', formatMoney(p.amount_cents)],
    ['Covers the 3% fee', p.cover_fees ? `Yes (+${formatMoney(p.total_cents - p.amount_cents)})` : 'No'],
    ['Total', <strong key="t">{pledgeAmount(p)}</strong>],
    ['Preferred method', p.method],
    ['Received', formatDateTime(p.created_at)],
    [kind === 'vip' ? 'Member since' : 'Marked paid', p.paid_at ? formatDateTime(p.paid_at) : '—'],
    ['Last updated', p.updated_at ? formatDateTime(p.updated_at) : '—'],
  ];

  return (
    <Page width="wide">
      <Link to={meta.path} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> {meta.title}
      </Link>
      <PageHeader
        title={supporterName(p)}
        description={kind === 'vip' ? 'VIP Club membership' : p.frequency === 'monthly' ? 'Monthly donation' : 'One-time donation'}
        meta={
          <>
            <StatusBadge status={p.status} />
            <span className="font-mono">{p.reference}</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
              onClick={() => void navigator.clipboard.writeText(p.reference).then(() => toast.success('Reference copied'), () => toast.error('Couldn’t copy'))}
            >
              <Copy className="size-3.5" aria-hidden="true" /> Copy
            </button>
          </>
        }
        actions={
          <Button variant="outline" asChild>
            <a href={followUpMail(p)}>
              <Mail aria-hidden="true" /> Email {p.full_name.trim().split(/\s+/)[0] || 'supporter'}
            </a>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <Panel title={kind === 'vip' ? 'Membership' : 'Pledge'}>
            <p className="font-display text-[34px] leading-none tracking-tight tabular-nums">{pledgeAmount(p)}</p>
            <dl className="mt-5 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-[170px_1fr]">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Team notes" description="Payment arrangements, follow-ups, anything the team should know. Only the team sees these.">
            <div className="grid gap-3">
              <Label htmlFor="pledge-notes" className="sr-only">
                Team notes
              </Label>
              <Textarea id="pledge-notes" rows={5} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!editable || busy !== null} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-muted-foreground">{notes.length}/4000</span>
                {editable && (
                  <Button size="sm" disabled={!notesDirty || busy !== null} onClick={() => void update({ notes }, 'notes', 'Notes saved')}>
                    {busy === 'notes' && <Loader2 className="animate-spin" aria-hidden="true" />} Save notes
                  </Button>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Activity">
            {!can('view_audit') ? (
              <p className="text-sm text-muted-foreground">Admins and owners can see who changed this pledge and when.</p>
            ) : activity.isPending ? (
              <LoadingBlock rows={2} />
            ) : activity.isError ? (
              <ErrorState error={activity.error} onRetry={() => void activity.refetch()} compact />
            ) : (
              <ol className="space-y-3 text-sm">
                {(activity.data ?? []).map((a) => {
                  const st = a.changes?.status;
                  return (
                    <li key={a.id} className="flex gap-3">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-info" aria-hidden="true" />
                      <span>
                        <span className="font-medium">{a.actor_email ?? 'Someone'}</span>{' '}
                        {st ? (
                          <>
                            changed the status from <strong>{STATUS_LABELS[String(st[0])] ?? String(st[0])}</strong> to <strong>{STATUS_LABELS[String(st[1])] ?? String(st[1])}</strong>
                          </>
                        ) : a.changes?.notes ? (
                          'updated the notes'
                        ) : (
                          'updated this pledge'
                        )}
                        <span className="block text-[12px] text-muted-foreground">{formatDateTime(a.occurred_at)}</span>
                      </span>
                    </li>
                  );
                })}
                <li className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
                  <span>
                    Pledge sent from the website{p.full_name.trim() ? ` by ${p.full_name.trim()}` : ''}
                    <span className="block text-[12px] text-muted-foreground">{formatDateTime(p.created_at)}</span>
                  </span>
                </li>
              </ol>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Status">
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={p.status} />
                <span className="text-[12px] text-muted-foreground">{p.paid_at ? `Paid ${timeAgo(p.paid_at)}` : `Received ${timeAgo(p.created_at)}`}</span>
              </div>
              {editable ? (
                <div className="grid gap-2">
                  {p.status === 'pending_payment' && (
                    <Button onClick={() => void markPaid()} disabled={busy !== null}>
                      {busy === 'paid' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} Mark as paid
                    </Button>
                  )}
                  {p.status !== 'cancelled' && (
                    <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => void cancel()} disabled={busy !== null}>
                      {busy === 'cancelled' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Ban aria-hidden="true" />} Cancel {kind === 'vip' ? 'membership' : 'pledge'}
                    </Button>
                  )}
                  {p.status !== 'pending_payment' && (
                    <Button variant="outline" onClick={() => void reopen()} disabled={busy !== null}>
                      {busy === 'reopen' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />} Reopen
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground">Only admins and owners can change a pledge’s status.</p>
              )}
              {p.status === 'pending_payment' && <p className="text-[12px] text-muted-foreground">Send payment instructions with “Email {p.full_name.trim().split(/\s+/)[0] || 'supporter'}”, then mark it paid when the money arrives.</p>}
            </div>
          </Panel>

          <Panel title="Supporter">
            <dl className="grid gap-2 text-[13px]">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{p.full_name.trim() || '—'}</dd>
              <dt className="mt-1 text-muted-foreground">Email</dt>
              <dd className="break-all">
                <a href={`mailto:${p.email}`} className="underline underline-offset-4">
                  {p.email}
                </a>
              </dd>
              <dt className="mt-1 text-muted-foreground">Paid with James Reports so far</dt>
              <dd className="tabular-nums">{history.isPending ? '…' : formatMoney(paidTotal)}</dd>
            </dl>
            <h3 className="mb-2 mt-5 text-[13px] font-semibold">Other pledges from this email</h3>
            {history.isPending ? (
              <LoadingBlock rows={2} />
            ) : others.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">None.</p>
            ) : (
              <ul className="grid gap-2 text-[13px]">
                {others.map((h) => (
                  <li key={h.id}>
                    <Link to={`${KINDS[h.kind as PledgeKind].path}/${h.id}`} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 hover:border-ring/50">
                      <span className="min-w-0">
                        <span className="block font-mono text-[12px]">{h.reference}</span>
                        <span className="text-muted-foreground">{pledgeAmount(h)}</span>
                      </span>
                      <StatusBadge status={h.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}
