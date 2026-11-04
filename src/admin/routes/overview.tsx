import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarCheck,
  CircleAlert,
  Clapperboard,
  FileSignature,
  HandCoins,
  Images,
  Mail,
  Mic,
  Newspaper,
  PenLine,
  Plus,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorState, LoadingBlock, Page, PageHeader, Panel, StatusBadge, usePageTitle } from '@/admin/components/common';
import { Button } from '@/admin/components/ui/button';
import { Skeleton } from '@/admin/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/admin/components/ui/tabs';
import { useAuth } from '@/admin/lib/auth';
import { useDashboard, useSiteConfig, type ContentEntity } from '@/admin/lib/data';
import { must } from '@/admin/lib/errors';
import { formatMoney, timeAgo } from '@/admin/lib/format';
import { sb } from '@/admin/lib/supabase';
import { cn } from '@/admin/lib/utils';

const RANGES = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '365d', label: '12 months', days: 365 },
  { key: 'all', label: 'All time', days: null },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

/** Day-aligned bounds, so the query key stays stable while the page is open. */
export function rangeBounds(key: RangeKey, now = new Date()): { from: Date; to: Date } {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const days = RANGES.find((r) => r.key === key)?.days ?? null;
  const from = days === null ? new Date(0) : new Date(to.getFullYear(), to.getMonth(), to.getDate() - days);
  return { from, to };
}

const CONTENT: Array<{ entity: ContentEntity; label: string; to: string; icon: LucideIcon }> = [
  { entity: 'episodes', label: 'Episodes', to: '/admin/episodes', icon: Clapperboard },
  { entity: 'reports', label: 'Reports', to: '/admin/reports', icon: Newspaper },
  { entity: 'archive_items', label: 'Archive', to: '/admin/archive', icon: Images },
  { entity: 'sponsors', label: 'Sponsors', to: '/admin/sponsors', icon: HandCoins },
];

const ENTITY_LINKS: Record<string, { label: string; to: (id: string) => string }> = {
  episodes: { label: 'Episode', to: (id) => `/admin/episodes/${id}` },
  reports: { label: 'Report', to: (id) => `/admin/reports/${id}` },
  archive_items: { label: 'Archive item', to: (id) => `/admin/archive/${id}` },
  sponsors: { label: 'Sponsor', to: (id) => `/admin/sponsors/${id}` },
  media_assets: { label: 'Media', to: () => '/admin/media' },
  site_config: { label: 'Site settings', to: () => '/admin/site/home' },
  admin_members: { label: 'Team', to: () => '/admin/team' },
  booking_requests: { label: 'Booking request', to: () => '/admin/inbox/bookings' },
  guest_requests: { label: 'Guest request', to: () => '/admin/inbox/guests' },
  support_pledges: { label: 'Pledge', to: () => '/admin/inbox/pledges' },
  talent_releases: { label: 'Talent release', to: () => '/admin/inbox/releases' },
  newsletter_subscribers: { label: 'Subscriber', to: () => '/admin/inbox/subscribers' },
};

interface RecentRow {
  entity: ContentEntity;
  id: string;
  title: string;
  status: string;
  updated_at: string;
}

function useRecentlyEdited() {
  return useQuery({
    queryKey: ['recently-edited'],
    queryFn: async () => {
      const [episodes, reports, archive, sponsors] = await Promise.all([
        sb.from('episodes').select('id, title, status, updated_at').order('updated_at', { ascending: false }).limit(6),
        sb.from('reports').select('id, title, status, updated_at').order('updated_at', { ascending: false }).limit(6),
        sb.from('archive_items').select('id, title:name, status, updated_at').order('updated_at', { ascending: false }).limit(6),
        sb.from('sponsors').select('id, title:name, status, updated_at').order('updated_at', { ascending: false }).limit(6),
      ]);
      const tag = (entity: ContentEntity, rows: unknown) => (rows as Array<Omit<RecentRow, 'entity'>>).map((r) => ({ ...r, id: String(r.id), entity }));
      return [
        ...tag('episodes', must(episodes)),
        ...tag('reports', must(reports)),
        ...tag('archive_items', must(archive)),
        ...tag('sponsors', must(sponsors)),
      ]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 6);
    },
  });
}

interface AuditRow {
  id: number;
  occurred_at: string;
  actor_email: string | null;
  action: 'insert' | 'update' | 'delete';
  entity: string;
  entity_id: string | null;
  summary: string;
}

function useRecentActivity(enabled: boolean) {
  return useQuery({
    queryKey: ['recent-activity'],
    enabled,
    queryFn: async () => must(await sb.from('audit_log').select('id, occurred_at, actor_email, action, entity, entity_id, summary').order('occurred_at', { ascending: false }).limit(8)) as AuditRow[],
  });
}

/** Live items whose edits are waiting in a draft, per content type. */
function useDraftCounts() {
  return useQuery({
    queryKey: ['draft-counts'],
    queryFn: async () => {
      const rows = must(await sb.from('content_drafts').select('entity')) as Array<{ entity: ContentEntity }>;
      const out: Partial<Record<ContentEntity, number>> = {};
      for (const r of rows) out[r.entity] = (out[r.entity] ?? 0) + 1;
      return out;
    },
  });
}

function useMissingAlt() {
  return useQuery({
    queryKey: ['media-missing-alt'],
    queryFn: async () => {
      const { count, error } = await sb.from('media_assets').select('id', { count: 'exact', head: true }).eq('alt', '');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function Metric({ icon: Icon, label, value, note, to, loading }: Readonly<{ icon: LucideIcon; label: string; value: string; note?: string; to: string; loading: boolean }>) {
  return (
    <Link to={to} className="group rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(11,31,92,0.04)] transition-colors hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-center justify-between text-[13px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </span>
        <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-2 font-display text-[30px] leading-none tracking-tight tabular-nums">{value}</p>}
      {note && !loading && <p className="mt-1.5 text-[12px] text-muted-foreground">{note}</p>}
    </Link>
  );
}

export function OverviewPage() {
  usePageTitle('Overview');
  const { member, can } = useAuth();
  const [params, setParams] = useSearchParams();
  const range = (RANGES.some((r) => r.key === params.get('range')) ? params.get('range') : '30d') as RangeKey;
  const { from, to } = useMemo(() => rangeBounds(range), [range]);
  const dash = useDashboard(from, to);
  const recent = useRecentlyEdited();
  const activity = useRecentActivity(can('view_audit'));
  const config = useSiteConfig();
  const missingAlt = useMissingAlt();
  const drafts = useDraftCounts();
  const d = dash.data;
  const rangeLabel = range === 'all' ? 'all time' : `the last ${RANGES.find((r) => r.key === range)!.label}`;

  const attention = d
    ? [
        { n: d.pending.booking_new, label: 'new booking & ad requests', to: '/admin/inbox/bookings?status=new', icon: CalendarCheck },
        { n: d.pending.guest_new, label: 'new guest requests', to: '/admin/inbox/guests?status=new', icon: Mic },
        { n: d.pending.pledges_unpaid, label: 'pledges awaiting payment', to: '/admin/inbox/pledges?status=pending_payment', icon: HandCoins },
        ...CONTENT.map((c) => ({ n: drafts.data?.[c.entity] ?? 0, label: `live ${c.label.toLowerCase()} with unpublished changes`, to: c.to, icon: PenLine })),
      ].filter((x) => x.n > 0)
    : [];

  const fundraising = config.data?.config.fundraising;
  const checks = [
    fundraising && fundraising.goalCents === null && { text: 'The monthly fundraising goal isn’t set, so the progress bar is hidden.', to: '/admin/site/home', action: 'Set the goal' },
    d && d.episodes_without_media > 0 && { text: `${d.episodes_without_media} published episode${d.episodes_without_media === 1 ? ' has' : 's have'} no video or audio.`, to: '/admin/episodes?status=published', action: 'Review episodes' },
    (missingAlt.data ?? 0) > 0 && { text: `${missingAlt.data} image${missingAlt.data === 1 ? ' is' : 's are'} missing a description for screen readers.`, to: '/admin/media', action: 'Add descriptions' },
    { text: 'Payments aren’t connected: donations and VIP sign-ups are recorded as pledges and no money is collected online.', to: '/admin/inbox/pledges', action: 'View pledges' },
  ].filter(Boolean) as Array<{ text: string; to: string; action: string }>;

  return (
    <Page>
      <PageHeader
        title={`Welcome${member?.display_name ? `, ${member.display_name.split(' ')[0]}` : ''}`}
        description="What came in through the site, what needs a reply, and the state of the content."
        actions={
          <Tabs value={range} onValueChange={(v) => setParams((p) => (p.set('range', v), p), { replace: true })}>
            <TabsList aria-label="Date range">
              {RANGES.map((r) => (
                <TabsTrigger key={r.key} value={r.key} className="px-2.5 text-[12px]">
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {dash.isError ? (
        <ErrorState error={dash.error} onRetry={() => void dash.refetch()} />
      ) : (
        <>
          <h2 className="sr-only">Submissions in {rangeLabel}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Metric icon={CalendarCheck} label="Booking & ad requests" value={String(d?.period.booking ?? 0)} to="/admin/inbox/bookings" loading={!d} />
            <Metric icon={Mic} label="Guest requests" value={String(d?.period.guest ?? 0)} to="/admin/inbox/guests" loading={!d} />
            <Metric icon={HandCoins} label="Pledges" value={String(d?.period.pledges ?? 0)} note={d ? `${formatMoney(d.period.pledged_cents)} pledged (not collected)` : undefined} to="/admin/inbox/pledges" loading={!d} />
            <Metric icon={Mail} label="Newsletter sign-ups" value={String(d?.period.newsletter ?? 0)} note={d ? `${d.subscribers} subscribed in total` : undefined} to="/admin/inbox/subscribers" loading={!d} />
            {can('view_releases') && <Metric icon={FileSignature} label="Talent releases signed" value={String(d?.period.releases ?? 0)} to="/admin/inbox/releases" loading={!d} />}
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">Counts of form submissions received in {rangeLabel}. The site has no visitor analytics connected.</p>
        </>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Needs attention">
            {!d && !dash.isError ? (
              <LoadingBlock rows={2} />
            ) : attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting. New requests and pledges appear here.</p>
            ) : (
              <ul className="divide-y">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link to={a.to} className="flex items-center gap-3 rounded-md py-2.5 text-sm hover:text-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <a.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="flex-1">
                        <strong className="font-semibold tabular-nums">{a.n}</strong> {a.label}
                      </span>
                      <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recently edited" actions={can('edit_content') && <QuickCreate />}>
            {recent.isPending ? (
              <LoadingBlock rows={4} />
            ) : recent.isError ? (
              <ErrorState error={recent.error} onRetry={() => void recent.refetch()} compact />
            ) : recent.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No content yet.</p>
            ) : (
              <ul className="divide-y">
                {recent.data.map((r) => (
                  <li key={`${r.entity}:${r.id}`}>
                    <Link to={ENTITY_LINKS[r.entity].to(r.id)} className="flex items-center gap-3 py-2.5 text-sm hover:text-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.title || 'Untitled'}</span>
                        <span className="text-[12px] text-muted-foreground">
                          {ENTITY_LINKS[r.entity].label} · {timeAgo(r.updated_at)}
                        </span>
                      </span>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {can('view_audit') && (
            <Panel
              title="Recent activity"
              actions={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin/audit">
                    Audit log <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              }
            >
              {activity.isPending ? (
                <LoadingBlock rows={4} />
              ) : activity.isError ? (
                <ErrorState error={activity.error} onRetry={() => void activity.refetch()} compact />
              ) : activity.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
              ) : (
                <ol className="space-y-3">
                  {activity.data.map((a) => (
                    <li key={a.id} className="flex gap-3 text-sm">
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', a.action === 'delete' ? 'bg-destructive' : a.action === 'insert' ? 'bg-success' : 'bg-info')} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="font-medium">{a.actor_email ?? 'Someone'}</span> {a.action === 'insert' ? 'added' : a.action === 'delete' ? 'deleted' : 'changed'}{' '}
                        {ENTITY_LINKS[a.entity]?.label.toLowerCase() ?? a.entity} {a.summary && <span className="font-medium">“{a.summary}”</span>}
                        <span className="block text-[12px] text-muted-foreground">{timeAgo(a.occurred_at)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          )}
        </div>

        <div className="grid content-start gap-6">
          <Panel title="Content">
            {!d ? (
              <LoadingBlock rows={4} />
            ) : (
              <ul className="divide-y">
                {CONTENT.map((c) => {
                  const n = d.content[c.entity] ?? { published: 0, draft: 0, archived: 0 };
                  return (
                    <li key={c.entity}>
                      <Link to={c.to} className="flex items-center gap-3 py-2.5 text-sm hover:text-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <c.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                        <span className="flex-1 font-medium">{c.label}</span>
                        <span className="text-[12px] text-muted-foreground tabular-nums">
                          {n.published} live{n.draft ? ` · ${n.draft} draft` : ''}
                          {n.archived ? ` · ${n.archived} archived` : ''}
                        </span>
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link to="/admin/media" className="flex items-center gap-3 py-2.5 text-sm hover:text-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Images className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1 font-medium">Media library</span>
                    <span className="text-[12px] text-muted-foreground tabular-nums">{d.media} images</span>
                  </Link>
                </li>
              </ul>
            )}
          </Panel>

          <Panel title="Site checks">
            <ul className="space-y-3">
              {checks.map((c) => (
                <li key={c.text} className="flex gap-3 text-sm">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  <span>
                    {c.text}{' '}
                    <Link to={c.to} className="font-medium text-foreground underline underline-offset-4 hover:text-ring">
                      {c.action}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          {can('upload_media') && (
            <Panel title="Quick actions">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Button variant="outline" asChild className="justify-start">
                  <Link to="/admin/media">
                    <Upload aria-hidden="true" /> Upload images
                  </Link>
                </Button>
                {can('manage_settings') && (
                  <Button variant="outline" asChild className="justify-start">
                    <Link to="/admin/site/header">
                      <PenLine aria-hidden="true" /> Edit announcement bar
                    </Link>
                  </Button>
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </Page>
  );
}

function QuickCreate() {
  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/episodes/new">
          <Plus aria-hidden="true" /> Episode
        </Link>
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/reports/new">
          <Plus aria-hidden="true" /> Report
        </Link>
      </Button>
    </div>
  );
}
