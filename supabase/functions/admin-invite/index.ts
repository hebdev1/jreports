// Invites a new team member. Owners only.
//
// 1. Confirms the caller is signed in and is an owner (checked again by the
//    database in admin_add_member).
// 2. Sends the Supabase invitation email with the secret key, which stays in
//    this function's environment and never reaches the browser. If the person
//    already has an account, no email is sent.
// 3. Adds them to the team through admin_add_member using the caller's own
//    token, so the audit log records which owner added them.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const ROLES = ['owner', 'admin', 'editor', 'viewer'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORIGIN = /^(https:\/\/[a-z0-9.-]+(:\d+)?|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/i;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return reply(500, { error: 'not_configured' });

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return reply(401, { error: 'auth' });

  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: who, error: whoError } = await asCaller.auth.getUser(authorization.slice(7));
  if (whoError || !who.user) return reply(401, { error: 'auth' });

  const { data: me } = await asCaller.from('admin_members').select('role').eq('user_id', who.user.id).maybeSingle();
  if (me?.role !== 'owner') return reply(403, { error: 'forbidden:manage_team' });

  let body: { email?: unknown; role?: unknown; display_name?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'invalid:body' });
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = typeof body.role === 'string' ? body.role : '';
  const displayName = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 120) : '';
  if (!EMAIL.test(email) || email.length > 254) return reply(400, { error: 'invalid:email' });
  if (!ROLES.includes(role)) return reply(400, { error: 'invalid:role' });

  const { data: existing } = await asCaller.from('admin_members').select('user_id').eq('email', email).maybeSingle();
  if (existing) return reply(409, { error: 'already_member' });

  const origin = req.headers.get('Origin') ?? '';
  const redirectTo = ORIGIN.test(origin) ? `${origin}/admin/reset-password` : undefined;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let invited = true;
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: displayName } });
  if (inviteError) {
    const already = inviteError.code === 'email_exists' || /already (been )?registered/i.test(inviteError.message);
    if (!already) {
      const limited = inviteError.status === 429 || /rate limit/i.test(inviteError.message);
      return reply(limited ? 429 : 502, { error: limited ? 'rate_limited' : 'invite_failed' });
    }
    invited = false;
  }

  const { data: userId, error: addError } = await asCaller.rpc('admin_add_member', { p_email: email, p_role: role, p_display_name: displayName });
  if (addError) {
    const status = addError.code === '42501' ? 403 : addError.code === '23505' ? 409 : 400;
    return reply(status, { error: addError.message });
  }
  return reply(200, { user_id: userId, invited });
});
