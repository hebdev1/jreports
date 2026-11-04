-- Adds an existing auth user to the team. Called by the admin-invite edge
-- function with the inviting owner's own token, so the audit trigger records
-- who added whom; owners may also call it directly for someone who already
-- has an account.
create or replace function public.admin_add_member(p_email text, p_role text, p_display_name text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
begin
  if not private.has_role('owner') then
    raise exception 'forbidden:manage_team' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'editor', 'viewer') then
    raise exception 'invalid:role' using errcode = '22023';
  end if;
  select id into v_user from auth.users where lower(email) = v_email;
  if v_user is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.admin_members where user_id = v_user) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  insert into public.admin_members (user_id, email, display_name, role, invited_by)
  values (v_user, v_email, private.clean(p_display_name, 'display_name', 120), p_role, auth.uid());
  return v_user;
end;
$$;

revoke execute on function public.admin_add_member(text, text, text) from public, anon;
grant execute on function public.admin_add_member(text, text, text) to authenticated;
