-- Separate admin tabs for VIP Club members and donations.
--
-- paid_at records when the team marked a pledge as paid (there is no
-- payment processor: "paid" is the team's confirmation). The summary
-- function returns the figures each tab shows; every number comes from
-- support_pledges rows, nothing is estimated.

alter table public.support_pledges add column paid_at timestamptz;
create index support_pledges_kind_status_idx on public.support_pledges (kind, status, created_at desc);

create or replace function private.stamp_paid_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    new.paid_at := now();
  elsif new.status <> 'paid' then
    new.paid_at := null;
  end if;
  return new;
end;
$$;
grant execute on function private.stamp_paid_at() to authenticated;
create trigger support_pledges_paid_at before update on public.support_pledges for each row execute function private.stamp_paid_at();

-- Figures for the VIP Club and Donations tabs. p_from/p_to bound the
-- "in this period" figures; the rest describe the current state.
create or replace function public.admin_pledge_summary(p_kind text, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_role('viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_kind not in ('donation', 'vip') then
    raise exception 'invalid:kind' using errcode = '22023';
  end if;
  return (
    with p as (select * from public.support_pledges where kind = p_kind)
    select jsonb_build_object(
      'period', jsonb_build_object(
        'pledges', (select count(*) from p where created_at >= p_from and created_at < p_to),
        'pledged_cents', (select coalesce(sum(total_cents), 0) from p where created_at >= p_from and created_at < p_to and status <> 'cancelled'),
        'paid', (select count(*) from p where paid_at >= p_from and paid_at < p_to),
        'paid_cents', (select coalesce(sum(total_cents), 0) from p where paid_at >= p_from and paid_at < p_to)
      ),
      'status', jsonb_build_object(
        'pending_payment', (select count(*) from p where status = 'pending_payment'),
        'paid', (select count(*) from p where status = 'paid'),
        'cancelled', (select count(*) from p where status = 'cancelled')
      ),
      'pending_cents', (select coalesce(sum(total_cents), 0) from p where status = 'pending_payment'),
      'monthly_active', jsonb_build_object(
        'count', (select count(*) from p where status = 'paid' and frequency = 'monthly'),
        'people', (select count(distinct lower(email)) from p where status = 'paid' and frequency = 'monthly'),
        'cents', (select coalesce(sum(total_cents), 0) from p where status = 'paid' and frequency = 'monthly')
      ),
      'one_time_paid', jsonb_build_object(
        'count', (select count(*) from p where status = 'paid' and frequency = 'once'),
        'cents', (select coalesce(sum(total_cents), 0) from p where status = 'paid' and frequency = 'once')
      ),
      'by_method', coalesce((select jsonb_object_agg(method, n) from (select method, count(*) as n from p where status <> 'cancelled' group by method) m), '{}'::jsonb),
      'by_tier', coalesce((select jsonb_object_agg(coalesce(tier, 'none'), n) from (select tier, count(*) as n from p where status <> 'cancelled' group by tier) t), '{}'::jsonb)
    )
  );
end;
$$;
revoke execute on function public.admin_pledge_summary(text, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_pledge_summary(text, timestamptz, timestamptz) to authenticated;

-- Pending counts per kind for the sidebar badges.
create or replace function public.admin_dashboard(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_admin boolean := private.has_role('admin');
begin
  if not private.has_role('viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'period', jsonb_build_object(
      'booking', (select count(*) from public.booking_requests where created_at >= p_from and created_at < p_to),
      'guest', (select count(*) from public.guest_requests where created_at >= p_from and created_at < p_to),
      'pledges', (select count(*) from public.support_pledges where created_at >= p_from and created_at < p_to),
      'pledged_cents', (select coalesce(sum(total_cents), 0) from public.support_pledges where created_at >= p_from and created_at < p_to and status <> 'cancelled'),
      'newsletter', (select count(*) from public.newsletter_subscribers where created_at >= p_from and created_at < p_to),
      'releases', case when v_admin then (select count(*) from public.talent_releases where signed_at >= p_from and signed_at < p_to) end
    ),
    'pending', jsonb_build_object(
      'booking_new', (select count(*) from public.booking_requests where status = 'new'),
      'guest_new', (select count(*) from public.guest_requests where status = 'new'),
      'pledges_unpaid', (select count(*) from public.support_pledges where status = 'pending_payment'),
      'vip_unpaid', (select count(*) from public.support_pledges where status = 'pending_payment' and kind = 'vip'),
      'donations_unpaid', (select count(*) from public.support_pledges where status = 'pending_payment' and kind = 'donation'),
      'drafts_pending', (select count(*) from public.content_drafts)
    ),
    'content', (
      select jsonb_object_agg(entity, counts) from (
        select 'episodes' as entity, jsonb_build_object('published', count(*) filter (where status = 'published'), 'draft', count(*) filter (where status = 'draft'), 'archived', count(*) filter (where status = 'archived')) as counts from public.episodes
        union all
        select 'reports', jsonb_build_object('published', count(*) filter (where status = 'published'), 'draft', count(*) filter (where status = 'draft'), 'archived', count(*) filter (where status = 'archived')) from public.reports
        union all
        select 'archive_items', jsonb_build_object('published', count(*) filter (where status = 'published'), 'draft', count(*) filter (where status = 'draft'), 'archived', count(*) filter (where status = 'archived')) from public.archive_items
        union all
        select 'sponsors', jsonb_build_object('published', count(*) filter (where status = 'published'), 'draft', count(*) filter (where status = 'draft'), 'archived', count(*) filter (where status = 'archived')) from public.sponsors
      ) x
    ),
    'subscribers', (select count(*) from public.newsletter_subscribers where status = 'subscribed'),
    'episodes_without_media', (select count(*) from public.episodes where status = 'published' and youtube_id is null and audio_url is null and video_id is null),
    'media', (select count(*) from public.media_assets)
  );
end;
$$;
