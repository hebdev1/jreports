import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Page, PageHeader, Panel, useConfirm, usePageTitle, useUnsavedGuard } from '@/admin/components/common';
import { TextField } from '@/admin/components/form';
import { Button } from '@/admin/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/admin/components/ui/radio-group';
import { useAuth } from '@/admin/lib/auth';
import { must, toAdminError } from '@/admin/lib/errors';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/admin/lib/permissions';
import { sb } from '@/admin/lib/supabase';
import { useTheme, type Theme } from '@/admin/lib/theme';
import { cn } from '@/admin/lib/utils';

const profileSchema = z.object({ display_name: z.string().trim().max(120, 'Keep it under 120 characters.') });
const passwordSchema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters.').max(72, 'Use at most 72 characters.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The passwords don’t match.' });

const THEMES: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match device', icon: Monitor },
];

function passwordMessage(m: string): string {
  if (/weak|password should/i.test(m)) return 'Choose a stronger password (at least 10 characters, mixing letters and numbers).';
  if (/same password|different from the old/i.test(m)) return 'Choose a password different from your current one.';
  if (/reauthenticat|recent/i.test(m)) return 'For security, sign out and sign in again, then change your password.';
  return 'Your password couldn’t be changed. Try again.';
}

export function AccountPage() {
  usePageTitle('Account');
  const { member, session, reload, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const profile = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), values: { display_name: member?.display_name ?? '' } });
  const password = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { password: '', confirm: '' } });
  useUnsavedGuard(profile.formState.isDirty || password.formState.isDirty);

  const saveProfile = profile.handleSubmit(async (v) => {
    try {
      must(await sb.rpc('admin_update_profile', { p_display_name: v.display_name }));
      profile.reset(v);
      await qc.invalidateQueries({ queryKey: ['team'] });
      reload();
      toast.success('Your name was updated.');
    } catch (err) {
      toast.error(toAdminError(err).message);
    }
  });

  const savePassword = password.handleSubmit(async (v) => {
    const { error } = await sb.auth.updateUser({ password: v.password });
    if (error) {
      password.setError('password', { message: passwordMessage(error.message) });
      return;
    }
    password.reset();
    toast.success('Your password was changed.');
  });

  const signOutOthers = async () => {
    const ok = await confirm({ title: 'Sign out everywhere else?', description: 'Every other browser and device signed in to your account is signed out. This one stays signed in.', confirmLabel: 'Sign out others' });
    if (!ok) return;
    setSigningOut(true);
    const { error } = await sb.auth.signOut({ scope: 'others' });
    setSigningOut(false);
    if (error) toast.error('That didn’t work. Try again.');
    else toast.success('Signed out of all other devices.');
  };

  return (
    <Page width="narrow">
      <PageHeader title="Account" description="Your profile, password and how the admin looks on this device." />
      <div className="grid gap-6">
        <Panel title="Profile">
          <form onSubmit={saveProfile} noValidate className="grid gap-4">
            <TextField control={profile.control} name="display_name" label="Your name" max={120} description="Shown to the team and in the audit log." disabled={profile.formState.isSubmitting} />
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[13px] font-medium">Email</dt>
                <dd className="mt-1 text-muted-foreground">{session?.user.email ?? member?.email}</dd>
              </div>
              <div>
                <dt className="text-[13px] font-medium">Role</dt>
                <dd className="mt-1 text-muted-foreground">
                  {member ? ROLE_LABELS[member.role] : '—'}
                  {member && <span className="mt-0.5 block text-[12px]">{ROLE_DESCRIPTIONS[member.role]}</span>}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={!profile.formState.isDirty || profile.formState.isSubmitting}>
                {profile.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />} Save name
              </Button>
            </div>
          </form>
        </Panel>

        <Panel title="Password" description="At least 10 characters. You stay signed in on this device.">
          <form onSubmit={savePassword} noValidate className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={password.control} name="password" label="New password" type="password" required disabled={password.formState.isSubmitting} />
              <TextField control={password.control} name="confirm" label="Repeat the new password" type="password" required disabled={password.formState.isSubmitting} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={password.formState.isSubmitting}>
                {password.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />} Change password
              </Button>
            </div>
          </form>
        </Panel>

        <Panel title="Appearance" description="Saved in this browser only.">
          <RadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)} aria-label="Theme" className="grid gap-2 sm:grid-cols-3">
            {THEMES.map((t) => (
              <label
                key={t.value}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  theme === t.value ? 'border-ring bg-accent font-medium' : 'hover:bg-accent/60',
                )}
              >
                <RadioGroupItem value={t.value} />
                <t.icon className="size-4" aria-hidden="true" /> {t.label}
              </label>
            ))}
          </RadioGroup>
        </Panel>

        <Panel title="Sessions">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Signed in on a shared or lost device? Sign it out from here.</p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => void signOutOthers()} disabled={signingOut}>
                {signingOut && <Loader2 className="animate-spin" aria-hidden="true" />} Sign out other devices
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                <LogOut aria-hidden="true" /> Sign out
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </Page>
  );
}
