import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { FullScreenMessage } from '@/admin/components/shell';
import { ErrorState, usePageTitle } from '@/admin/components/common';
import { TextField } from '@/admin/components/form';
import { Button } from '@/admin/components/ui/button';
import { useAuth } from '@/admin/lib/auth';
import { sb, supabaseConfigured } from '@/admin/lib/supabase';

function authMessage(err: { message?: string; status?: number; code?: string } | null): string {
  const m = err?.message ?? '';
  if (/invalid login credentials/i.test(m)) return 'The email or password is incorrect.';
  if (/email not confirmed/i.test(m)) return 'This email hasn’t been confirmed yet. Use the link in your invitation email first.';
  const wait = waitSeconds(err);
  if (wait) return `For security, wait ${wait} seconds before trying again.`;
  if (err?.code === 'over_email_send_rate_limit' || /email rate limit/i.test(m)) return 'Too many emails were sent in a short time. Wait a few minutes and try again.';
  if (/rate limit|too many/i.test(m) || err?.status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (/failed to fetch|network/i.test(m)) return 'We couldn’t reach the server. Check your connection and try again.';
  // "New password should be different…" also contains "password should", so test it first.
  if (err?.code === 'same_password' || /same password|different from the old/i.test(m)) return 'Choose a password different from your current one.';
  if (err?.code === 'weak_password' || /weak|password should/i.test(m)) return 'Choose a stronger password (at least 10 characters, mixing letters and numbers).';
  return m || 'Something went wrong. Please try again.';
}

/** "…you can only request this after 42 seconds." → 42 (Supabase's per-address cooldown). */
export function waitSeconds(err: { message?: string } | null): number | null {
  const m = /after (\d+) seconds?/i.exec(err?.message ?? '');
  return m ? Number(m[1]) : null;
}

/**
 * An emailed link that failed comes back with the reason in the URL
 * (`#error_code=otp_expired…`, or `?error=…` for code links).
 */
export function linkError(loc: { hash: string; search: string }): string | null {
  const hash = new URLSearchParams(loc.hash.replace(/^#/, ''));
  const query = new URLSearchParams(loc.search);
  const get = (k: string) => hash.get(k) ?? query.get(k);
  if (!get('error') && !get('error_code') && !get('error_description')) return null;
  if (get('error_code') === 'otp_expired' || /expired/i.test(get('error_description') ?? '')) {
    return 'This link has expired or was already used. Links work once and expire after one hour.';
  }
  return 'This link isn’t valid.';
}

const RESEND_SECONDS = 60;

function Card({ title, description, children }: Readonly<{ title: string; description?: string; children: React.ReactNode }>) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-[0_8px_24px_rgba(11,31,92,0.06)] sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export function LoginPage() {
  usePageTitle('Sign in');
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const typedEmail = useWatch({ control: form.control, name: 'email' });
  const from = (location.state as { from?: string } | null)?.from ?? '/admin';
  const expired = new URLSearchParams(location.search).get('expired') === '1';

  if (auth.status === 'ready') return <Navigate to={from} replace />;

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    const { error: e } = await sb.auth.signInWithPassword({ email: v.email, password: v.password });
    if (e) {
      setError(authMessage(e));
      form.setFocus('password');
      return;
    }
    navigate(from, { replace: true });
  });

  return (
    <FullScreenMessage>
      <Card title="Sign in" description="James Reports admin. Use the email your invitation was sent to.">
        {!supabaseConfigured && <ErrorState error={new Error('The admin isn’t connected to Supabase. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')} compact />}
        {expired && !error && <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">Your session ended. Sign in again to continue.</p>}
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <TextField control={form.control} name="email" label="Email" type="email" required inputMode="email" />
          <TextField control={form.control} name="password" label="Password" type="password" required />
          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting} className="mt-1 h-10">
            {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <Link to="/admin/forgot-password" state={{ email: typedEmail.trim() }} className="justify-self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Forgot your password?
          </Link>
        </form>
      </Card>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <a href="/" className="underline-offset-4 hover:underline">
          ← Back to the website
        </a>
      </p>
    </FullScreenMessage>
  );
}

const forgotSchema = z.object({ email: z.string().trim().min(1, 'Enter your email address.').email('Enter a valid email address.') });

export function ForgotPasswordPage() {
  usePageTitle('Reset your password');
  const location = useLocation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefill = (location.state as { email?: string } | null)?.email ?? '';
  const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: prefill } });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (email: string) => {
    setError(null);
    setSending(true);
    const { error: e } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/reset-password` });
    setSending(false);
    if (e) {
      const wait = waitSeconds(e);
      // Never say whether an account exists: only typos, limits and connection problems are reported.
      if (e.code === 'email_address_invalid') {
        form.setError('email', { message: 'Check the email address.' });
        return;
      }
      if (wait || e.status === 429 || /rate|fetch|network/i.test(e.message)) {
        setError(authMessage(e));
        if (wait) setCooldown(wait);
        return;
      }
    }
    setSentTo(email);
    setCooldown(RESEND_SECONDS);
  };

  const onSubmit = form.handleSubmit((v) => send(v.email));

  return (
    <FullScreenMessage>
      <Card title="Reset your password" description="We’ll email you a link to choose a new password.">
        {sentTo ? (
          <div className="grid gap-4">
            <div role="status" className="flex gap-3 rounded-lg bg-success-soft p-4 text-sm text-success">
              <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                If <strong className="font-semibold">{sentTo}</strong> belongs to a team member, a reset link is on its way. It works once and expires after one hour. Check your spam folder if it doesn’t arrive.
              </p>
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={cooldown > 0 || sending} onClick={() => void send(sentTo)}>
                {sending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {cooldown > 0 ? `Send again in ${cooldown} s` : 'Send again'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  // Supabase's wait applies per address, so another address can be tried now.
                  setSentTo(null);
                  setError(null);
                  setCooldown(0);
                }}
              >
                Use a different email
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <TextField control={form.control} name="email" label="Email" type="email" required inputMode="email" />
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={sending || cooldown > 0} className="h-10">
              {sending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {cooldown > 0 ? `Send reset link (${cooldown} s)` : 'Send reset link'}
            </Button>
          </form>
        )}
        <Link to="/admin/login" className="mt-5 block text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Back to sign in
        </Link>
      </Card>
    </FullScreenMessage>
  );
}

const resetSchema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters.').max(72, 'Use at most 72 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The passwords don’t match.' });

/** Choose a new password after a reset link, or a first password after an invitation. */
export function ResetPasswordPage() {
  usePageTitle('Choose a password');
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Read the link's own error before anything rewrites the address bar.
  const [badLink] = useState(() => linkError(window.location));
  const [waited, setWaited] = useState(false);
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } });

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    const { error: e } = await sb.auth.updateUser({ password: v.password });
    if (e) {
      setError(authMessage(e));
      return;
    }
    // A reset may follow a lost or shared device: end every other session.
    await sb.auth.signOut({ scope: 'others' });
    toast.success('Your new password is saved. Any other devices were signed out.');
    navigate('/admin', { replace: true });
  });

  // A failed link wins even if an older session is still open in this browser.
  if (badLink || !auth.session) {
    return (
      <FullScreenMessage>
        <Card title="Choose a password">
          {badLink || waited ? (
            <div role="alert" className="grid gap-4 text-sm text-muted-foreground">
              <p>{badLink ?? 'This link is invalid or has expired.'}</p>
              <Button asChild>
                <Link to="/admin/forgot-password">Request a new link</Link>
              </Button>
              <Link to="/admin/login" className="text-center underline-offset-4 hover:text-foreground hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking your link…
            </p>
          )}
        </Card>
      </FullScreenMessage>
    );
  }

  return (
    <FullScreenMessage>
      <Card title="Choose a password" description={`For ${auth.session.user.email}. You’ll use it to sign in to the admin.`}>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <TextField control={form.control} name="password" label="New password" type="password" required description="At least 10 characters." />
          <TextField control={form.control} name="confirm" label="Repeat the password" type="password" required />
          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={form.formState.isSubmitting} className="h-10">
            {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save password
          </Button>
        </form>
      </Card>
    </FullScreenMessage>
  );
}
