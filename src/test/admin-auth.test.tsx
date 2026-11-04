import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/admin/lib/auth';
import { sb } from '@/admin/lib/supabase';
import { ForgotPasswordPage, linkError, ResetPasswordPage, waitSeconds } from '@/admin/routes/auth';

vi.mock('@/admin/lib/auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/admin/lib/supabase', () => ({
  supabaseConfigured: true,
  sb: { auth: { resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), signInWithPassword: vi.fn() } },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const auth = (session: unknown) =>
  vi.mocked(useAuth).mockReturnValue({ status: session ? 'ready' : 'signed_out', session, member: null, error: null, can: () => false, signOut: vi.fn(), reload: vi.fn() } as never);

function renderAt(path: string, state?: unknown) {
  const router = createMemoryRouter(
    [
      { path: '/admin/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/admin/reset-password', element: <ResetPasswordPage /> },
      { path: '/admin', element: <p>Admin home</p> },
      { path: '/admin/login', element: <p>Sign-in page</p> },
    ],
    { initialEntries: [{ pathname: path, state }] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  vi.mocked(sb.auth.resetPasswordForEmail).mockReset().mockResolvedValue({ data: {}, error: null } as never);
  vi.mocked(sb.auth.updateUser).mockReset().mockResolvedValue({ data: {}, error: null } as never);
  vi.mocked(sb.auth.signOut).mockReset().mockResolvedValue({ error: null } as never);
  window.history.replaceState(null, '', '/');
  auth(null);
});

describe('link and limit helpers', () => {
  it('reads the reason a reset or invitation link failed', () => {
    expect(linkError({ hash: '', search: '' })).toBeNull();
    expect(linkError({ hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', search: '' })).toMatch(/expired or was already used/);
    expect(linkError({ hash: '', search: '?error=invalid_request&error_description=bad' })).toBe('This link isn’t valid.');
    expect(waitSeconds({ message: 'For security purposes, you can only request this after 42 seconds.' })).toBe(42);
    expect(waitSeconds({ message: 'nope' })).toBeNull();
  });
});

describe('forgot password', () => {
  it('validates, sends a link back to the reset page, and never says whether the account exists', async () => {
    const user = userEvent.setup();
    renderAt('/admin/forgot-password');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(sb.auth.resetPasswordForEmail).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: /Email/ }), 'marie@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(sb.auth.resetPasswordForEmail).toHaveBeenCalledWith('marie@example.com', { redirectTo: `${window.location.origin}/admin/reset-password` });
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('If marie@example.com belongs to a team member');
    expect(screen.getByRole('button', { name: /Send again in \d+ s/ })).toBeDisabled();
  });

  it('shows the same message when Supabase reports an unknown user', async () => {
    vi.mocked(sb.auth.resetPasswordForEmail).mockResolvedValue({ data: null, error: { message: 'User not found', status: 400 } } as never);
    const user = userEvent.setup();
    renderAt('/admin/forgot-password', { email: 'nobody@example.com' });
    expect(screen.getByRole('textbox', { name: /Email/ })).toHaveValue('nobody@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent('If nobody@example.com belongs to a team member');
  });

  it('reports the wait when links are requested too often', async () => {
    vi.mocked(sb.auth.resetPasswordForEmail).mockResolvedValue({ data: null, error: { message: 'For security purposes, you can only request this after 37 seconds.', status: 429 } } as never);
    const user = userEvent.setup();
    renderAt('/admin/forgot-password', { email: 'marie@example.com' });
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('wait 37 seconds');
    expect(screen.getByRole('button', { name: /Send reset link \(3\d s\)/ })).toBeDisabled();
  });
});

describe('reset password', () => {
  it('explains an expired link straight away and offers a new one', () => {
    window.history.replaceState(null, '', '/admin/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    auth({ user: { email: 'marie@example.com' } });
    renderAt('/admin/reset-password');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('expired or was already used');
    expect(within(alert).getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/admin/forgot-password');
    expect(screen.queryByLabelText(/New password/)).not.toBeInTheDocument();
  });

  it('checks the new password, saves it, and signs out other devices', async () => {
    auth({ user: { email: 'marie@example.com' } });
    const user = userEvent.setup();
    const router = renderAt('/admin/reset-password');
    expect(screen.getByText(/For marie@example.com/)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/New password/), 'short');
    await user.type(screen.getByLabelText(/Repeat the password/), 'short');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/New password/));
    await user.type(screen.getByLabelText(/New password/), 'correct horse battery');
    await user.clear(screen.getByLabelText(/Repeat the password/));
    await user.type(screen.getByLabelText(/Repeat the password/), 'correct horse batterz');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(screen.getByText('The passwords don’t match.')).toBeInTheDocument();
    expect(sb.auth.updateUser).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/Repeat the password/));
    await user.type(screen.getByLabelText(/Repeat the password/), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(sb.auth.updateUser).toHaveBeenCalledWith({ password: 'correct horse battery' });
    expect(sb.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(await screen.findByText('Admin home')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('shows Supabase’s refusal in plain words', async () => {
    vi.mocked(sb.auth.updateUser).mockResolvedValue({ data: null, error: { message: 'New password should be different from the old password.', status: 422 } } as never);
    auth({ user: { email: 'marie@example.com' } });
    const user = userEvent.setup();
    renderAt('/admin/reset-password');
    await user.type(screen.getByLabelText(/New password/), 'correct horse battery');
    await user.type(screen.getByLabelText(/Repeat the password/), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('Choose a password different from your current one.')).toHaveAttribute('role', 'alert');
    expect(sb.auth.signOut).not.toHaveBeenCalled();
  });
});
