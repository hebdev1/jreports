import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from '@/admin/components/common';
import { useAuth } from '@/admin/lib/auth';
import { can, type Permission, type Role } from '@/admin/lib/permissions';
import { sb } from '@/admin/lib/supabase';
import { flatNav } from '@/admin/nav';
import { followUpMail, PledgePage, pledgeAmount, SupportersPage, type Pledge, type PledgeSummary } from '@/admin/routes/supporters';

vi.mock('@/admin/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// A tiny stand-in for the Supabase query builder: every call chains, and
// awaiting it resolves to what the test set for that table.
const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
let tables: Record<string, () => { data: unknown; error: null; count?: number }> = {};
vi.mock('@/admin/lib/supabase', () => {
  const builder = (table: string) => {
    let single = false;
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'ilike', 'or', 'order', 'range', 'limit', 'is', 'in', 'update']) {
      b[m] = (...args: unknown[]) => {
        calls.push({ table, method: m, args });
        return b;
      };
    }
    b.maybeSingle = () => {
      single = true;
      return b;
    };
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const r = tables[table]?.() ?? { data: [], error: null, count: 0 };
      const data = single && Array.isArray(r.data) ? (r.data[0] ?? null) : r.data;
      return Promise.resolve({ ...r, data }).then(res, rej);
    };
    return b;
  };
  return { sb: { from: (t: string) => builder(t), rpc: vi.fn() }, supabaseConfigured: true, SUPABASE_URL: 'https://x.supabase.co', AUTH_STORAGE_KEY: 'jr-admin-auth' };
});

const VIP: Pledge = {
  id: 'p1', reference: 'JR-VIP-1001', kind: 'vip', frequency: 'monthly', amount_cents: 4599, cover_fees: false, total_cents: 4599, method: 'Zelle', tier: 'VIP',
  full_name: 'Marie Joseph', email: 'marie@example.com', status: 'pending_payment', notes: '', created_at: '2026-11-04T12:00:00Z', updated_at: null, paid_at: null,
};
const SUMMARY: PledgeSummary = {
  period: { pledges: 3, pledged_cents: 13797, paid: 1, paid_cents: 4599 },
  status: { pending_payment: 2, paid: 1, cancelled: 0 },
  pending_cents: 9198,
  monthly_active: { count: 1, people: 1, cents: 4599 },
  one_time_paid: { count: 0, cents: 0 },
  by_method: { Zelle: 2, PayPal: 1 },
  by_tier: { VIP: 3 },
};

function asRole(role: Role) {
  vi.mocked(useAuth).mockReturnValue({ status: 'ready', session: null, member: null, error: null, can: (p: Permission) => can(role, p), signOut: vi.fn(), reload: vi.fn() } as never);
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: <ConfirmProvider><RouteOutlet /></ConfirmProvider>,
        children: [
          { path: '/admin/vip', element: <SupportersPage kind="vip" /> },
          { path: '/admin/vip/:id', element: <PledgePage kind="vip" /> },
          { path: '/admin/donations/:id', element: <PledgePage kind="donation" /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

function RouteOutlet() {
  return <Outlet />;
}

beforeEach(() => {
  calls.length = 0;
  tables = {
    support_pledges: () => ({ data: [VIP], error: null, count: 1 }),
    audit_log: () => ({ data: [], error: null }),
  };
  vi.mocked(sb.rpc).mockReset().mockResolvedValue({ data: SUMMARY, error: null } as never);
  asRole('admin');
});

describe('supporter helpers', () => {
  it('formats amounts and prepares a follow-up email', () => {
    expect(pledgeAmount(VIP)).toBe('$45.99 / month');
    expect(pledgeAmount({ total_cents: 2575, frequency: 'once' })).toBe('$25.75');
    const mail = decodeURIComponent(followUpMail(VIP));
    expect(mail).toMatch(/^mailto:marie@example\.com\?subject=Your James Reports VIP Club membership \(JR-VIP-1001\)/);
    expect(mail).toContain('Hi Marie,');
    expect(mail).toContain('You chose to pay by Zelle');
    expect(decodeURIComponent(followUpMail({ ...VIP, status: 'paid' }))).not.toContain('payment details');
  });

  it('shows both tabs in the sidebar for every team role', () => {
    for (const role of ['viewer', 'editor', 'admin', 'owner'] as const) {
      const titles = flatNav(role).map((n) => n.title);
      expect(titles).toContain('VIP Club');
      expect(titles).toContain('Donations');
      expect(titles).not.toContain('Pledges');
    }
  });
});

describe('VIP Club tab', () => {
  it('shows the summary from the database and the members list', async () => {
    renderAt('/admin/vip');
    expect(await screen.findByText('Active members')).toBeInTheDocument();
    expect(sb.rpc).toHaveBeenCalledWith('admin_pledge_summary', expect.objectContaining({ p_kind: 'vip' }));
    expect(await screen.findByText('$45.99 a month in paid memberships')).toBeInTheDocument();
    expect(screen.getByText('$91.98 a month if all pay')).toBeInTheDocument();
    const row = await screen.findByRole('link', { name: /Marie Joseph/ });
    expect(row).toHaveAttribute('href', '/admin/vip/p1');
    expect(calls).toContainEqual({ table: 'support_pledges', method: 'eq', args: ['kind', 'vip'] });
  });
});

describe('pledge detail page', () => {
  it('shows the pledge and lets an admin mark it paid after confirming', async () => {
    const user = userEvent.setup();
    renderAt('/admin/vip/p1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Marie Joseph' })).toBeInTheDocument();
    expect(screen.getAllByText('JR-VIP-1001').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Email Marie/ }).getAttribute('href')).toMatch(/^mailto:marie@example\.com/);
    await user.click(screen.getByRole('button', { name: 'Mark as paid' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Only do this once $45.99 / month has actually arrived');
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }));
    await waitFor(() => expect(calls).toContainEqual({ table: 'support_pledges', method: 'update', args: [{ status: 'paid' }] }));
    expect(calls).toContainEqual({ table: 'support_pledges', method: 'is', args: ['updated_at', null] });
  });

  it('is read-only for viewers', async () => {
    asRole('viewer');
    renderAt('/admin/vip/p1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Marie Joseph' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as paid' })).not.toBeInTheDocument();
    expect(screen.getByText('Only admins and owners can change a pledge’s status.')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('sends a donation opened under the VIP address to the right tab', async () => {
    tables.support_pledges = () => ({ data: [{ ...VIP, kind: 'donation', reference: 'JR-D-1001', tier: null }], error: null });
    const router = renderAt('/admin/vip/p1');
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/donations/p1'));
  });
});
