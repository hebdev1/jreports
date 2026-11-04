import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, MoreHorizontal, UserMinus, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { EmptyState, ErrorState, LoadingBlock, Page, PageHeader, Panel, useConfirm, usePageTitle } from '@/admin/components/common';
import { SelectField, TextField } from '@/admin/components/form';
import { Avatar, AvatarFallback } from '@/admin/components/ui/avatar';
import { Badge } from '@/admin/components/ui/badge';
import { Button } from '@/admin/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/admin/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/admin/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/admin/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/admin/components/ui/table';
import { useAuth } from '@/admin/lib/auth';
import { must, toAdminError } from '@/admin/lib/errors';
import { formatDay, initials, todayIso } from '@/admin/lib/format';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from '@/admin/lib/permissions';
import { sb } from '@/admin/lib/supabase';

interface TeamMember {
  user_id: string;
  email: string;
  display_name: string;
  role: Role;
  created_at: string;
}

const ROLE_OPTIONS = [...ROLES].reverse().map((r) => ({ value: r, label: ROLE_LABELS[r] }));

function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: async () => must(await sb.from('admin_members').select('user_id, email, display_name, role, created_at').order('created_at')) as TeamMember[],
  });
}

/** Calls the admin-invite edge function and turns its error body into an AdminError. */
export async function inviteMember(v: { email: string; role: Role; display_name: string }): Promise<{ user_id: string; invited: boolean }> {
  const { data, error } = await sb.functions.invoke('admin-invite', { body: v });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let code = '';
    try {
      code = ((await ctx?.json()) as { error?: string } | undefined)?.error ?? '';
    } catch {
      /* not JSON */
    }
    throw toAdminError({ message: code || error.message, status: ctx?.status });
  }
  return data as { user_id: string; invited: boolean };
}

const inviteSchema = z.object({
  email: z.string().trim().min(1, 'Enter their email address.').email('Enter a valid email address.').max(254),
  display_name: z.string().trim().max(120),
  role: z.enum(ROLES),
});

function InviteDialog({ open, onOpenChange }: Readonly<{ open: boolean; onOpenChange: (o: boolean) => void }>) {
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof inviteSchema>>({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', display_name: '', role: 'editor' } });
  const role = useWatch({ control: form.control, name: 'role' });
  const invite = useMutation({
    mutationFn: inviteMember,
    onSuccess: async (res, v) => {
      await qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(res.invited ? `Invitation sent to ${v.email}.` : `${v.email} already had an account and was added to the team. They sign in with their existing password, or use “Forgot your password?”.`);
      form.reset();
      onOpenChange(false);
    },
    onError: (err) => {
      const e = toAdminError(err);
      if (e.field === 'email' || e.message.includes('already on the team')) form.setError('email', { message: e.message });
      else toast.error(e.message);
    },
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !invite.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>They get an email with a link to choose a password. Access starts as soon as they sign in.</DialogDescription>
        </DialogHeader>
        <form id="invite-form" className="grid gap-4" noValidate onSubmit={form.handleSubmit((v) => invite.mutate(v))}>
          <TextField control={form.control} name="email" label="Email" type="email" required disabled={invite.isPending} />
          <TextField control={form.control} name="display_name" label="Name" max={120} disabled={invite.isPending} />
          <SelectField control={form.control} name="role" label="Role" options={ROLE_OPTIONS} required disabled={invite.isPending} description={ROLE_DESCRIPTIONS[role]} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={invite.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" disabled={invite.isPending}>
            {invite.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />} Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeamPage() {
  usePageTitle('Team');
  const { member: me, can } = useAuth();
  const team = useTeam();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [inviting, setInviting] = useState(false);
  const owner = can('manage_team');

  const setRole = useMutation({
    mutationFn: async ({ m, role }: { m: TeamMember; role: Role }) => must(await sb.rpc('admin_set_member_role', { p_user: m.user_id, p_role: role })),
    onSuccess: (_, { m, role }) => {
      void qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(`${m.display_name || m.email} is now ${ROLE_LABELS[role] === 'Admin' ? 'an' : 'a'} ${ROLE_LABELS[role].toLowerCase()}.`);
    },
    onError: (err) => toast.error(toAdminError(err).message),
  });
  const remove = useMutation({
    mutationFn: async (m: TeamMember) => must(await sb.rpc('admin_remove_member', { p_user: m.user_id })),
    onSuccess: (_, m) => {
      void qc.invalidateQueries({ queryKey: ['team'] });
      toast.success(`${m.display_name || m.email} no longer has access to the admin.`);
    },
    onError: (err) => toast.error(toAdminError(err).message),
  });

  const changeRole = async (m: TeamMember, role: Role) => {
    if (role === m.role) return;
    if (role === 'owner') {
      const ok = await confirm({
        title: `Make ${m.display_name || m.email} an owner?`,
        description: 'Owners can invite people, change anyone’s role and remove team members, including you.',
        confirmLabel: 'Make owner',
      });
      if (!ok) return;
    }
    setRole.mutate({ m, role });
  };

  const removeMember = async (m: TeamMember) => {
    const ok = await confirm({
      title: `Remove ${m.display_name || m.email} from the team?`,
      description: 'They lose access to the admin immediately. Their content and activity history stay. You can invite them again later.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) remove.mutate(m);
  };

  const sendReset = async (m: TeamMember) => {
    const ok = await confirm({ title: `Email ${m.email} a link to set a password?`, description: 'Use this when someone can’t sign in or their invitation expired.', confirmLabel: 'Send link' });
    if (!ok) return;
    const { error } = await sb.auth.resetPasswordForEmail(m.email, { redirectTo: `${window.location.origin}/admin/reset-password` });
    if (error) toast.error(/rate limit/i.test(error.message) ? 'Too many emails were sent in a short time. Wait a few minutes and try again.' : 'The email couldn’t be sent. Try again.');
    else toast.success(`Link sent to ${m.email}.`);
  };

  return (
    <Page>
      <PageHeader
        title="Team"
        description="Who can sign in to the admin and what they can do."
        actions={
          owner && (
            <Button onClick={() => setInviting(true)}>
              <UserPlus aria-hidden="true" /> Invite someone
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 rounded-xl border bg-card">
          {team.isPending ? (
            <LoadingBlock rows={4} className="p-5" />
          ) : team.isError ? (
            <div className="p-5">
              <ErrorState error={team.error} onRetry={() => void team.refetch()} />
            </div>
          ) : team.data.length === 0 ? (
            <EmptyState icon={Users} title="No team members" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="w-[150px]">Role</TableHead>
                  <TableHead className="hidden w-[120px] md:table-cell">Added</TableHead>
                  {owner && <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.data.map((m) => {
                  const self = m.user_id === me?.user_id;
                  return (
                    <TableRow key={m.user_id}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">{initials(m.display_name || m.email)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate font-medium">
                              {m.display_name || m.email.split('@')[0]}
                              {self && <Badge variant="secondary" className="rounded-full px-1.5 py-0 text-[10px]">You</Badge>}
                            </p>
                            <p className="truncate text-[12px] text-muted-foreground">{m.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {owner && !self ? (
                          <Select value={m.role} onValueChange={(v) => void changeRole(m, v as Role)} disabled={setRole.isPending}>
                            <SelectTrigger size="sm" className="w-[130px]" aria-label={`Role for ${m.email}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">{ROLE_LABELS[m.role]}</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-[13px] text-muted-foreground md:table-cell">{formatDay(todayIso(new Date(m.created_at)))}</TableCell>
                      {owner && (
                        <TableCell>
                          {!self && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${m.email}`}>
                                  <MoreHorizontal aria-hidden="true" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => void sendReset(m)}>
                                  <KeyRound aria-hidden="true" /> Send password link
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => void removeMember(m)}>
                                  <UserMinus aria-hidden="true" /> Remove from team
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <Panel title="Roles" className="self-start">
          <dl className="space-y-4 text-sm">
            {[...ROLES].reverse().map((r) => (
              <div key={r}>
                <dt className="font-semibold">{ROLE_LABELS[r]}</dt>
                <dd className="mt-0.5 text-[13px] text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
              </div>
            ))}
          </dl>
          {!owner && <p className="mt-5 border-t pt-4 text-[13px] text-muted-foreground">Only owners can invite people or change roles.</p>}
        </Panel>
      </div>
      {owner && <InviteDialog open={inviting} onOpenChange={setInviting} />}
    </Page>
  );
}
