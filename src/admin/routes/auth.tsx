import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
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
  if (/rate limit|too many/i.test(m) || err?.status === 429) return 'Too many attempts. Wait a minute and try again.';
  if (/failed to fetch|network/i.test(m)) return 'We couldn’t reach the server. Check your connection and try again.';
  if (/weak|password should/i.test(m)) return 'Choose a stronger password (at least 10 characters, mixing letters and numbers).';
  if (/same password|different from the old/i.test(m)) return 'Choose a password different from your current one.';
  return m || 'Something went wrong. Please try again.';
}

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
          <Link to="/admin/forgot-password" className="justify-self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
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
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    const { error: e } = await sb.auth.resetPasswordForEmail(v.email, { redirectTo: `${window.location.origin}/admin/reset-password` });
    // Don't reveal whether an account exists: only connection/limit problems are reported.
    if (e && (/rate|fetch|network/i.test(e.message) || e.status === 429)) {
      setError(authMessage(e));
      return;
    }
    setSent(true);
  });

  return (
    <FullScreenMessage>
      <Card title="Reset your password" description="We’ll email you a link to choose a new password.">
        {sent ? (
          <div role="status" className="flex gap-3 rounded-lg bg-success-soft p-4 text-sm text-success">
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>If that email belongs to a team member, a reset link is on its way. It expires after one hour.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <TextField control={form.control} name="email" label="Email" type="email" required inputMode="email" />
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting} className="h-10">
              {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              Send reset link
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
  const [waited, setWaited] = useState(false);
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } });

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    const { error: e } = await sb.auth.updateUser({ password: v.password });
    if (e) {
      setError(authMessage(e));
      return;
    }
    navigate('/admin', { replace: true });
  });

  if (!auth.session) {
    return (
      <FullScreenMessage>
        <Card title="Choose a password">
          {waited ? (
            <p className="text-sm text-muted-foreground">
              This link is invalid or has expired.{' '}
              <Link to="/admin/forgot-password" className="font-medium text-foreground underline underline-offset-4">
                Request a new one
              </Link>
              .
            </p>
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
