import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesDef, sponsorsDef } from '@/admin/collections/defs';
import { isHttps, parseClock, playlistId, slugify, toClock, youtubeId } from '@/admin/collections/helpers';
import { RequirePermission, RequireTeam } from '@/admin/components/shell';
import { useAuth } from '@/admin/lib/auth';
import { pgrstLike, toCsv } from '@/admin/lib/data';
import { AdminError, toAdminError } from '@/admin/lib/errors';
import { can, minimumRole, ROLES, type Permission, type Role } from '@/admin/lib/permissions';
import { flatNav, navFor } from '@/admin/nav';
import { showValue } from '@/admin/routes/audit';
import { rangeBounds } from '@/admin/routes/overview';

vi.mock('@/admin/lib/auth', () => ({ useAuth: vi.fn() }));

describe('roles and permissions', () => {
  const matrix: Array<[Permission, Role]> = [
    ['view', 'viewer'],
    ['edit_content', 'editor'],
    ['upload_media', 'editor'],
    ['triage', 'editor'],
    ['publish', 'admin'],
    ['delete', 'admin'],
    ['manage_settings', 'admin'],
    ['view_releases', 'admin'],
    ['export', 'admin'],
    ['view_audit', 'admin'],
    ['manage_team', 'owner'],
  ];

  it.each(matrix)('%s needs at least %s', (permission, role) => {
    expect(minimumRole(permission)).toBe(role);
    for (const r of ROLES) expect(can(r, permission)).toBe(ROLES.indexOf(r) >= ROLES.indexOf(role));
  });

  it('gives nothing to people who are not on the team', () => {
    for (const [p] of matrix) {
      expect(can(null, p)).toBe(false);
      expect(can(undefined, p)).toBe(false);
    }
  });

  it('only lists the pages a role can open', () => {
    const titles = (r: Role) => flatNav(r).map((n) => n.title);
    expect(titles('editor')).not.toContain('Audit log');
    expect(titles('editor')).not.toContain('Talent releases');
    expect(titles('admin')).toContain('Audit log');
    expect(titles('viewer')).toContain('Episodes');
    expect(navFor('viewer').every((g) => g.items.length > 0)).toBe(true);
  });
});

describe('admin errors', () => {
  it('turns database refusals into plain messages', () => {
    expect(toAdminError({ message: 'conflict', code: '40001' }).kind).toBe('conflict');
    expect(toAdminError({ message: 'forbidden:publish' }).message).toMatch(/Only admins and owners can publish/);
    expect(toAdminError({ message: 'forbidden:last_owner' }).message).toMatch(/at least one owner/);
    expect(toAdminError({ message: 'new row violates row-level security policy', code: '42501' }).kind).toBe('forbidden');
    expect(toAdminError({ message: 'in_use', code: '23503' }).kind).toBe('in_use');
    expect(toAdminError({ message: 'already_member' }).message).toBe('This person is already on the team.');
    expect(toAdminError({ message: 'invalid:website_url' })).toMatchObject({ kind: 'validation', field: 'website_url' });
    expect(toAdminError(new TypeError('Failed to fetch')).kind).toBe('network');
    expect(toAdminError({ message: 'JWT expired', status: 401 }).kind).toBe('auth');
    const e = new AdminError('validation', 'x');
    expect(toAdminError(e)).toBe(e);
  });
});

describe('content helpers', () => {
  it('parses durations, YouTube links, slugs and https links', () => {
    expect(parseClock('58:12')).toBe(3492);
    expect(parseClock('1:06:40')).toBe(4000);
    expect(toClock(3492)).toBe('58:12');
    expect(youtubeId('https://www.youtube.com/watch?v=Q_oljAV4Yfs&t=31')).toBe('Q_oljAV4Yfs');
    expect(youtubeId('https://youtu.be/Q_oljAV4Yfs')).toBe('Q_oljAV4Yfs');
    expect(youtubeId('Q_oljAV4Yfs')).toBe('Q_oljAV4Yfs');
    expect(youtubeId('not a video')).toBeNull();
    expect(playlistId('https://www.youtube.com/playlist?list=PLYsDWrWXrYqKp2pvk5Seg-r8A3Vic_XWo')).toBe('PLYsDWrWXrYqKp2pvk5Seg-r8A3Vic_XWo');
    expect(slugify('Konsèy pou nouvo imigran!')).toBe('konsey-pou-nouvo-imigran');
    expect(isHttps('https://example.com')).toBe(true);
    expect(isHttps('http://example.com')).toBe(false);
  });

  it('escapes search terms and neutralises spreadsheet formulas in exports', () => {
    expect(pgrstLike('50%_off, (now)')).toBe('%50\\%\\_off\\, \\(now\\)%');
    const csv = toCsv([{ name: '=HYPERLINK("x")', note: 'say "hi"' }], [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Note' }]);
    expect(csv).toBe('"Name","Note"\r\n"\'=HYPERLINK(""x"")","say ""hi"""');
  });

  it('validates episodes and sponsors before anything is sent', () => {
    const ep = episodesDef.schema.safeParse({ ...episodesDef.empty(), id: 'ep-49', number: 49, title: 'Next', duration: '45:00', youtube: 'nope' });
    expect(ep.success).toBe(false);
    const ok = episodesDef.schema.safeParse({ ...episodesDef.empty(), id: 'ep-49', number: 49, title: 'Next', duration: '45:00', youtube: 'https://youtu.be/Q_oljAV4Yfs' });
    expect(ok.success).toBe(true);
    const sponsor = sponsorsDef.schema.safeParse({ ...sponsorsDef.empty(), name: 'Acme', placements: ['home_feature'] });
    expect(sponsor.success).toBe(false);
  });

  it('shows audit values readably and keeps overview ranges day-aligned', () => {
    expect(showValue(null)).toBe('(empty)');
    expect(showValue(true)).toBe('Yes');
    expect(showValue(['a'])).toBe('["a"]');
    const { from, to } = rangeBounds('7d', new Date(2026, 10, 3, 15, 30));
    expect(to).toEqual(new Date(2026, 10, 4));
    expect(from).toEqual(new Date(2026, 9, 28));
    expect(rangeBounds('all').from.getTime()).toBe(0);
  });
});

describe('route guards', () => {
  const auth = (over: Partial<ReturnType<typeof useAuth>>) =>
    vi.mocked(useAuth).mockReturnValue({ status: 'ready', session: null, member: null, error: null, can: () => false, signOut: vi.fn(), reload: vi.fn(), ...over } as ReturnType<typeof useAuth>);

  const renderGuarded = () => {
    const router = createMemoryRouter(
      [
        { path: '/admin/login', element: <p>Sign-in page</p> },
        { path: '/admin/audit', element: <RequireTeam><RequirePermission permission="view_audit"><p>Audit content</p></RequirePermission></RequireTeam> },
      ],
      { initialEntries: ['/admin/audit'] },
    );
    render(<RouterProvider router={router} />);
    return router;
  };

  beforeEach(() => vi.mocked(useAuth).mockReset());

  it('sends signed-out visitors to the sign-in page', () => {
    auth({ status: 'signed_out' });
    const router = renderGuarded();
    expect(screen.getByText('Sign-in page')).toBeInTheDocument();
    expect(router.state.location.state).toEqual({ from: '/admin/audit' });
  });

  it('turns away signed-in accounts that are not on the team', () => {
    auth({ status: 'no_access', session: { user: { email: 'someone@example.com' } } as never });
    renderGuarded();
    expect(screen.getByRole('heading', { name: 'This account isn’t on the team' })).toBeInTheDocument();
    expect(screen.queryByText('Audit content')).not.toBeInTheDocument();
  });

  it('blocks a direct link to a page the role cannot open', () => {
    auth({ can: (p) => can('editor', p) });
    renderGuarded();
    expect(screen.getByRole('heading', { name: 'You don’t have access to this page' })).toBeInTheDocument();
    expect(screen.queryByText('Audit content')).not.toBeInTheDocument();
  });

  it('lets an admin through', () => {
    auth({ can: (p) => can('admin', p) });
    renderGuarded();
    expect(screen.getByText('Audit content')).toBeInTheDocument();
  });
});
