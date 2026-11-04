/** A failed admin request, with a message written for the person using the admin. */
export class AdminError extends Error {
  readonly kind: 'conflict' | 'forbidden' | 'validation' | 'in_use' | 'not_found' | 'network' | 'auth' | 'server';
  readonly field?: string;
  constructor(kind: AdminError['kind'], message: string, field?: string) {
    super(message);
    this.name = 'AdminError';
    this.kind = kind;
    this.field = field;
  }
}

const FORBIDDEN: Record<string, string> = {
  publish: 'Only admins and owners can publish, unpublish or archive.',
  edit_published: 'This item is live. Save your changes as a draft; an admin publishes them.',
  manage_team: 'Only owners can change the team.',
  own_role: 'You can’t change or remove your own access. Ask another owner.',
  last_owner: 'The team needs at least one owner. Make someone else an owner first.',
};

/** Turns a Supabase / PostgREST / fetch error into an AdminError. */
export function toAdminError(err: unknown): AdminError {
  if (err instanceof AdminError) return err;
  const e = (err ?? {}) as { message?: string; code?: string; status?: number; name?: string; details?: string };
  const msg = e.message ?? '';
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(msg)) {
    return new AdminError('network', 'We couldn’t reach the server. Check your connection and try again.');
  }
  if (msg === 'conflict' || e.code === '40001') {
    return new AdminError('conflict', 'Someone else changed this since you opened it. Reload to see their version before saving again.');
  }
  const f = /^forbidden(?::([a-z_]+))?/.exec(msg);
  if (f) return new AdminError('forbidden', FORBIDDEN[f[1] ?? ''] ?? 'You don’t have permission to do that.');
  if (e.code === '42501' || /permission denied|row-level security/i.test(msg)) {
    return new AdminError('forbidden', 'You don’t have permission to do that.');
  }
  if (msg === 'already_member') return new AdminError('validation', 'This person is already on the team.');
  if (msg === 'rate_limited') return new AdminError('server', 'Too many emails were sent in a short time. Wait a few minutes and try again.');
  if (msg === 'invite_failed') return new AdminError('server', 'The invitation email couldn’t be sent. Check the email settings in Supabase (see the admin guide) and try again.');
  if (msg.startsWith('in_use') || e.code === '23503') {
    return new AdminError('in_use', 'This is still used elsewhere on the site. Replace or remove it there first.');
  }
  if (e.code === '23505') {
    return new AdminError('validation', 'That value is already used by another item. Choose a different one.');
  }
  if (e.code === '23514') {
    return new AdminError('validation', 'One of the values isn’t allowed. Check the highlighted fields and try again.');
  }
  const v = /^(invalid|required|too_long):([a-zA-Z_.]+)/.exec(msg);
  if (v) return new AdminError('validation', `Please check “${v[2].replace(/[._]/g, ' ')}”.`, v[2]);
  if (msg === 'not_found' || e.code === 'P0002' || e.code === 'PGRST116') {
    return new AdminError('not_found', 'This item no longer exists. It may have been deleted.');
  }
  if (e.status === 401 || /jwt|session/i.test(msg)) {
    return new AdminError('auth', 'Your session has ended. Sign in again to continue.');
  }
  return new AdminError('server', 'Something went wrong. Please try again.');
}

/** Unwraps a Supabase response, throwing an AdminError on failure. */
export function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw toAdminError(res.error);
  return res.data;
}
