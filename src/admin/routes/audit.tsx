import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, History, Search } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState, ErrorState, LoadingBlock, Page, PageHeader, usePageTitle } from '@/admin/components/common';
import { Button } from '@/admin/components/ui/button';
import { Input } from '@/admin/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/components/ui/table';
import { pgrstLike } from '@/admin/lib/data';
import { toAdminError } from '@/admin/lib/errors';
import { formatDateTime } from '@/admin/lib/format';
import { sb } from '@/admin/lib/supabase';
import { cn } from '@/admin/lib/utils';

const PAGE_SIZE = 50;

export const AUDIT_ENTITIES: Record<string, { label: string; link?: (id: string) => string }> = {
  episodes: { label: 'Episode', link: (id) => `/admin/episodes/${id}` },
  reports: { label: 'Report', link: (id) => `/admin/reports/${id}` },
  archive_items: { label: 'Archive item', link: (id) => `/admin/archive/${id}` },
  sponsors: { label: 'Sponsor', link: (id) => `/admin/sponsors/${id}` },
  media_assets: { label: 'Media', link: () => '/admin/media' },
  site_config: { label: 'Site settings' },
  admin_members: { label: 'Team member', link: () => '/admin/team' },
  booking_requests: { label: 'Booking request', link: () => '/admin/inbox/bookings' },
  guest_requests: { label: 'Guest request', link: () => '/admin/inbox/guests' },
  support_pledges: { label: 'Pledge', link: (id) => `/admin/pledges/${id}` },
  talent_releases: { label: 'Talent release', link: () => '/admin/inbox/releases' },
  newsletter_subscribers: { label: 'Subscriber', link: () => '/admin/inbox/subscribers' },
};

const ACTIONS: Record<string, { label: string; dot: string }> = {
  insert: { label: 'Added', dot: 'bg-success' },
  update: { label: 'Changed', dot: 'bg-info' },
  delete: { label: 'Deleted', dot: 'bg-destructive' },
};

interface AuditRow {
  id: number;
  occurred_at: string;
  actor_email: string | null;
  action: 'insert' | 'update' | 'delete';
  entity: string;
  entity_id: string | null;
  summary: string;
  changes: Record<string, [unknown, unknown]> | null;
}

/** A compact, readable rendering of one stored value. */
export function showValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return String(v);
  const json = JSON.stringify(v);
  return json.length > 160 ? `${json.slice(0, 157)}…` : json;
}

export function AuditPage() {
  usePageTitle('Audit log');
  const [params, setParams] = useSearchParams();
  const [actor, setActor] = useState(params.get('actor') ?? '');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const entity = params.get('entity') ?? 'all';
  const action = params.get('action') ?? 'all';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        if (key !== 'page') p.delete('page');
        return p;
      },
      { replace: true },
    );

  useEffect(() => {
    const t = setTimeout(() => (params.get('actor') ?? '') !== actor && setParam('actor', actor.trim() || null), 300);
    return () => clearTimeout(t);
  }, [actor]);

  const log = useQuery({
    queryKey: ['audit', entity, action, params.get('actor') ?? '', from, to, page],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = sb.from('audit_log').select('id, occurred_at, actor_email, action, entity, entity_id, summary, changes', { count: 'exact' });
      if (entity !== 'all') q = q.eq('entity', entity);
      if (action !== 'all') q = q.eq('action', action);
      const who = params.get('actor')?.trim();
      if (who) q = q.ilike('actor_email', pgrstLike(who));
      if (from) q = q.gte('occurred_at', new Date(`${from}T00:00:00`).toISOString());
      if (to) q = q.lt('occurred_at', new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000).toISOString());
      const start = (page - 1) * PAGE_SIZE;
      const { data, error, count } = await q.order('occurred_at', { ascending: false }).range(start, start + PAGE_SIZE - 1);
      if (error) throw toAdminError(error);
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  const pages = Math.max(1, Math.ceil((log.data?.count ?? 0) / PAGE_SIZE));
  const filtered = entity !== 'all' || action !== 'all' || Boolean(params.get('actor') || from || to);
  const toggle = (id: number) => setOpen((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s).add(id)));

  return (
    <Page width="wide">
      <PageHeader
        title="Audit log"
        description="Every change made by a signed-in team member: content, media, settings, team and submission triage. Visitor submissions themselves aren’t logged, and personal details from forms are never copied here."
      />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Filter by person’s email" aria-label="Filter by person’s email" className="pl-8" />
        </div>
        <Select value={entity} onValueChange={(v) => setParam('entity', v === 'all' ? null : v)}>
          <SelectTrigger className="w-[170px]" aria-label="What changed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everything</SelectItem>
            {Object.entries(AUDIT_ENTITIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={(v) => setParam('action', v === 'all' ? null : v)}>
          <SelectTrigger className="w-[130px]" aria-label="Kind of change">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All changes</SelectItem>
            {Object.entries(ACTIONS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="grid gap-1 text-[12px] text-muted-foreground">
          From
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setParam('from', e.target.value || null)} className="w-[150px]" />
        </label>
        <label className="grid gap-1 text-[12px] text-muted-foreground">
          To
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setParam('to', e.target.value || null)} className="w-[150px]" />
        </label>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActor('');
              setParams({}, { replace: true });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {log.isPending ? (
        <LoadingBlock rows={8} />
      ) : log.isError ? (
        <ErrorState error={log.error} onRetry={() => void log.refetch()} />
      ) : log.data.rows.length === 0 ? (
        <EmptyState icon={History} title={filtered ? 'No changes match' : 'No changes recorded yet'} description={filtered ? 'Try a wider date range or other filters.' : 'Changes made in the admin appear here.'} />
      ) : (
        <div className={cn('rounded-xl border bg-card transition-opacity', log.isFetching && 'opacity-70')}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <span className="sr-only">Details</span>
                </TableHead>
                <TableHead className="w-[170px]">When</TableHead>
                <TableHead>Change</TableHead>
                <TableHead className="hidden lg:table-cell">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.data.rows.map((r) => {
                const meta = AUDIT_ENTITIES[r.entity];
                const changes = r.changes ? Object.entries(r.changes) : [];
                const expanded = open.has(r.id);
                const href = r.entity_id && r.action !== 'delete' ? meta?.link?.(r.entity_id) : undefined;
                return (
                  <Fragment key={r.id}>
                    <TableRow>
                      <TableCell className="align-top">
                        {changes.length > 0 && (
                          <Button variant="ghost" size="icon" className="size-7" aria-expanded={expanded} aria-label={expanded ? 'Hide details' : 'Show details'} onClick={() => toggle(r.id)}>
                            {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top text-[13px] text-muted-foreground">{formatDateTime(r.occurred_at)}</TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-start gap-2 text-sm">
                          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', ACTIONS[r.action]?.dot)} aria-hidden="true" />
                          <span className="min-w-0">
                            {ACTIONS[r.action]?.label ?? r.action} {meta?.label.toLowerCase() ?? r.entity}{' '}
                            {r.summary &&
                              (href ? (
                                <Link to={href} className="font-medium underline-offset-4 hover:underline">
                                  “{r.summary}”
                                </Link>
                              ) : (
                                <span className="font-medium">“{r.summary}”</span>
                              ))}
                            {changes.length > 0 && <span className="block text-[12px] text-muted-foreground">{changes.map(([k]) => k.replace(/_/g, ' ')).join(', ')}</span>}
                            <span className="block text-[12px] text-muted-foreground lg:hidden">{r.actor_email ?? 'Unknown'}</span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden align-top text-[13px] lg:table-cell">{r.actor_email ?? 'Unknown'}</TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell />
                        <TableCell colSpan={3} className="whitespace-normal">
                          <dl className="grid gap-2 py-1 text-[13px]">
                            {changes.map(([k, [before, after]]) => (
                              <div key={k} className="grid gap-1 sm:grid-cols-[140px_1fr]">
                                <dt className="font-medium">{k.replace(/_/g, ' ')}</dt>
                                <dd className="min-w-0 break-words">
                                  <span className="text-muted-foreground line-through decoration-muted-foreground/50">{showValue(before)}</span>
                                  <span className="mx-1.5 text-muted-foreground" aria-label="changed to">
                                    →
                                  </span>
                                  <span>{showValue(after)}</span>
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-[13px] text-muted-foreground">
            <span>
              {log.data.count} change{log.data.count === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>
                Previous
              </Button>
              <span>
                Page {page} of {pages}
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
