-- Uploaded videos for episodes, and reports as full articles.
--
-- Videos live in the media library like images (media_assets.kind) and
-- their files in a separate public "videos" bucket with its own size and
-- type limits. Reports gain a rich-text body (TipTap/ProseMirror JSON),
-- a cover image, a byline and search fields. The public site renders the
-- body from a whitelist of node types, never as raw HTML.

-- ============================================================ media kinds

alter table public.media_assets
  add column kind text not null default 'image' check (kind in ('image', 'video')),
  add column duration_seconds integer check (duration_seconds >= 0);
alter table public.media_assets add constraint media_assets_kind_mime check (
  (kind = 'image' and (mime_type = '' or mime_type like 'image/%'))
  or (kind = 'video' and mime_type like 'video/%'));
grant select (kind, duration_seconds) on public.media_assets to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 5368709120, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Editors upload videos" on storage.objects for insert to authenticated with check (bucket_id = 'videos' and private.has_role('editor'));
create policy "Editors replace videos" on storage.objects for update to authenticated using (bucket_id = 'videos' and private.has_role('editor')) with check (bucket_id = 'videos' and private.has_role('editor'));
create policy "Admins remove videos" on storage.objects for delete to authenticated using (bucket_id = 'videos' and private.has_role('admin'));
create policy "Team lists videos" on storage.objects for select to authenticated using (bucket_id = 'videos' and private.has_role('viewer'));

-- ========================================================= episode video

alter table public.episodes add column video_id uuid references public.media_assets (id) on delete restrict;
grant select (video_id) on public.episodes to anon;

-- ======================================================== report articles

alter table public.reports
  add column body jsonb check (body is null or (jsonb_typeof(body) = 'object' and body ->> 'type' = 'doc' and octet_length(body::text) <= 1000000)),
  add column image_id uuid references public.media_assets (id) on delete restrict,
  add column author text not null default '' check (char_length(author) <= 120),
  add column seo_title text not null default '' check (char_length(seo_title) <= 70),
  add column seo_description text not null default '' check (char_length(seo_description) <= 200);
comment on column public.reports.body is 'Article text as TipTap/ProseMirror JSON. The site renders known node types only.';
grant select (body, image_id, author, seo_title, seo_description) on public.reports to anon;

-- An image field must point at an image, a video field at a video.
create or replace function private.check_media_kinds()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new jsonb := to_jsonb(new);
  v_col text;
  v_kind text;
begin
  foreach v_col in array array['image_id', 'thanks_image_id', 'video_id'] loop
    continue when not v_new ? v_col or v_new ->> v_col is null;
    select m.kind into v_kind from public.media_assets m where m.id = (v_new ->> v_col)::uuid;
    if v_kind is distinct from (case when v_col = 'video_id' then 'video' else 'image' end) then
      raise exception 'invalid:%', v_col using errcode = '22023';
    end if;
  end loop;
  return new;
end;
$$;
grant execute on function private.check_media_kinds() to authenticated;
create trigger episodes_media_kinds before insert or update on public.episodes for each row execute function private.check_media_kinds();
create trigger reports_media_kinds before insert or update on public.reports for each row execute function private.check_media_kinds();
create trigger sponsors_media_kinds before insert or update on public.sponsors for each row execute function private.check_media_kinds();

-- Fields that drafts may change and admin_publish applies.
create or replace function private.editable_columns(p_entity text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_entity
    when 'episodes' then array['number', 'title', 'dek', 'guest', 'topic', 'language', 'duration_seconds', 'published_on', 'youtube_id', 'audio_url', 'video_id', 'chapters', 'image_id', 'seo_title', 'seo_description']
    when 'reports' then array['topic', 'title', 'dek', 'read_minutes', 'published_on', 'url', 'body', 'image_id', 'author', 'seo_title', 'seo_description']
    when 'archive_items' then array['name', 'show', 'image_url', 'href', 'sort_order']
    when 'sponsors' then array['name', 'name_accent', 'tagline', 'website_url', 'phone', 'image_id', 'thanks_text', 'thanks_image_id', 'placements', 'sort_order']
  end
$$;

create or replace function public.admin_media_usage(p_id uuid)
returns table (entity text, entity_id text, label text, field text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_url text;
begin
  if not private.has_role('viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select m.url into v_url from public.media_assets m where m.id = p_id;
  return query
    select 'episodes'::text, e.id::text, e.title, 'Episode image'::text from public.episodes e where e.image_id = p_id
    union all
    select 'episodes', e.id::text, e.title, 'Episode video' from public.episodes e where e.video_id = p_id
    union all
    select 'reports', r.id::text, r.title, 'Report cover image' from public.reports r where r.image_id = p_id
    union all
    select 'reports', r.id::text, r.title, 'Image in the article' from public.reports r where v_url is not null and strpos(r.body::text, v_url) > 0
    union all
    select 'sponsors', s.id::text, s.name, 'Sponsor card image' from public.sponsors s where s.image_id = p_id
    union all
    select 'sponsors', s.id::text, s.name, 'Thank-you image' from public.sponsors s where s.thanks_image_id = p_id
    union all
    select 'site_config', 'images', k, 'Page image' from public.site_config c, jsonb_each_text(c.value) as j(k, v)
      where c.key = 'images' and j.v = p_id::text;
end;
$$;

-- An image used inside an article can't be deleted either.
create or replace function private.media_in_use()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.site_config c where c.key = 'images' and strpos(c.value::text, old.id::text) > 0)
    or exists (select 1 from public.reports r where strpos(r.body::text, old.url) > 0)
    or exists (select 1 from public.content_drafts d where strpos(d.data::text, old.url) > 0 or strpos(d.data::text, old.id::text) > 0) then
    raise exception 'in_use:media' using errcode = '23503';
  end if;
  return old;
end;
$$;

-- "Published episodes with nothing to play" now also counts uploaded videos.
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
