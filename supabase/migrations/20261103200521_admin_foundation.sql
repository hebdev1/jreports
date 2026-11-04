-- Admin foundation: team roles, publication workflow (status + version +
-- private drafts), revisions, audit log, media library, sponsors, managed
-- site configuration and team access to visitor submissions.
--
-- Roles (low → high): viewer < editor < admin < owner.
--   viewer  read everything in the admin (except signed talent releases)
--   editor  create/edit drafts, upload media, triage submissions
--   admin   publish/unpublish/archive/delete, site settings, releases, exports
--   owner   manage the team
-- Every rule below is enforced in the database (RLS, triggers, functions);
-- the admin UI only mirrors it.

alter default privileges in schema private revoke execute on functions from public;

-- ===================================================================== team

create table public.admin_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (char_length(email) <= 254),
  display_name text not null default '' check (char_length(display_name) <= 120),
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index admin_members_email_idx on public.admin_members (lower(email));
alter table public.admin_members enable row level security;

create or replace function private.role_rank(r text)
returns integer language sql immutable set search_path = '' as $$
  select case r when 'owner' then 4 when 'admin' then 3 when 'editor' then 2 when 'viewer' then 1 else 0 end
$$;

create or replace function private.admin_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.admin_members where user_id = auth.uid()
$$;

create or replace function private.has_role(min_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.role_rank(private.admin_role()), 0) >= private.role_rank(min_role) and private.role_rank(min_role) > 0
$$;

create or replace function private.actor_email()
returns text language sql stable security definer set search_path = '' as $$
  select email from public.admin_members where user_id = auth.uid()
$$;

grant usage on schema private to authenticated;
grant execute on function private.role_rank(text), private.admin_role(), private.has_role(text), private.actor_email() to authenticated;

create policy "Team members see the team" on public.admin_members for select to authenticated using (private.has_role('viewer'));
revoke all on public.admin_members from anon;
grant select on public.admin_members to authenticated;

-- ============================================================ media library

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('storage', 'bundled')),
  path text not null unique check (char_length(path) between 1 and 300),
  url text not null check (url ~ '^(https://|/assets/)'),
  file_name text not null default '' check (char_length(file_name) <= 200),
  alt text not null default '' check (char_length(alt) <= 300),
  mime_type text not null default '' check (char_length(mime_type) <= 100),
  size_bytes integer check (size_bytes >= 0),
  width integer check (width > 0),
  height integer check (height > 0),
  version integer not null default 1,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.media_assets is 'Images used by the site. source=bundled points at files shipped in public/assets; source=storage at the public "media" bucket.';
create index media_assets_created_idx on public.media_assets (created_at desc);
alter table public.media_assets enable row level security;
create policy "Media is public" on public.media_assets for select to anon, authenticated using (true);
create policy "Editors add media" on public.media_assets for insert to authenticated with check (private.has_role('editor'));
create policy "Editors edit media" on public.media_assets for update to authenticated using (private.has_role('editor')) with check (private.has_role('editor'));
create policy "Admins delete media" on public.media_assets for delete to authenticated using (private.has_role('admin'));
revoke all on public.media_assets from anon, authenticated;
grant select (id, source, path, url, alt, width, height, mime_type) on public.media_assets to anon;
grant select, insert, update, delete on public.media_assets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Editors upload to media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and private.has_role('editor'));
create policy "Editors replace media files" on storage.objects for update to authenticated using (bucket_id = 'media' and private.has_role('editor')) with check (bucket_id = 'media' and private.has_role('editor'));
create policy "Admins remove media files" on storage.objects for delete to authenticated using (bucket_id = 'media' and private.has_role('admin'));
create policy "Team lists media files" on storage.objects for select to authenticated using (bucket_id = 'media' and private.has_role('viewer'));

-- ========================================================= content: status

alter table public.episodes
  add column status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  add column version integer not null default 1,
  add column published_at timestamptz,
  add column image_id uuid references public.media_assets (id) on delete restrict,
  add column seo_title text not null default '' check (char_length(seo_title) <= 70),
  add column seo_description text not null default '' check (char_length(seo_description) <= 200),
  add column created_by uuid,
  add column updated_by uuid;
update public.episodes set status = case when is_published then 'published' else 'draft' end, published_at = case when is_published then created_at end;
drop policy "Published episodes are public" on public.episodes;
drop index public.episodes_published_idx;
alter table public.episodes drop column is_published;
create index episodes_status_idx on public.episodes (status, published_on desc, number desc);

alter table public.reports
  add column status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  add column version integer not null default 1,
  add column published_at timestamptz,
  add column created_by uuid,
  add column updated_by uuid;
update public.reports set status = case when is_published then 'published' else 'draft' end, published_at = case when is_published then created_at end;
drop policy "Published reports are public" on public.reports;
drop index public.reports_published_idx;
alter table public.reports drop column is_published;
create index reports_status_idx on public.reports (status, published_on desc);

alter table public.archive_items
  add column status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  add column version integer not null default 1,
  add column published_at timestamptz,
  add column created_by uuid,
  add column updated_by uuid;
update public.archive_items set status = case when is_published then 'published' else 'draft' end, published_at = case when is_published then created_at end;
drop policy "Published archive items are public" on public.archive_items;
drop index public.archive_items_order_idx;
alter table public.archive_items drop column is_published;
create index archive_items_status_idx on public.archive_items (status, sort_order);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  name_accent text not null default '' check (char_length(name_accent) <= 60),
  tagline text not null default '' check (char_length(tagline) <= 200),
  website_url text check (website_url ~ '^https://'),
  phone text not null default '' check (char_length(phone) <= 40),
  image_id uuid references public.media_assets (id) on delete restrict,
  thanks_text text not null default '' check (char_length(thanks_text) <= 400),
  thanks_image_id uuid references public.media_assets (id) on delete restrict,
  placements text[] not null default '{}' check (placements <@ array['home_feature', 'home_thanks']),
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version integer not null default 1,
  published_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.sponsors.name_accent is 'Trailing part of the name shown in the accent colour (e.g. "Nurses" in FowenNurses).';
comment on column public.sponsors.placements is 'home_feature = the full-width sponsor card; home_thanks = the "Our sponsors" thank-you block.';
create index sponsors_status_idx on public.sponsors (status, sort_order);
alter table public.sponsors enable row level security;

drop trigger episodes_touch on public.episodes;
drop trigger reports_touch on public.reports;
drop trigger archive_items_touch on public.archive_items;

-- Status changes and edits to live content need publish rights; versions bump on every write.
create or replace function private.content_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_admin boolean;
begin
  if auth.uid() is null then
    if tg_op = 'UPDATE' then
      new.version := old.version + 1;
      new.updated_at := now();
    end if;
    if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
    return new;
  end if;
  v_admin := private.has_role('admin');
  if tg_op = 'INSERT' then
    if new.status <> 'draft' and not v_admin then
      raise exception 'forbidden:publish' using errcode = '42501';
    end if;
    new.version := 1;
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    if new.status = 'published' then new.published_at := now(); end if;
    return new;
  end if;
  if new.status is distinct from old.status and not v_admin then
    raise exception 'forbidden:publish' using errcode = '42501';
  end if;
  if old.status = 'published' and not v_admin then
    raise exception 'forbidden:edit_published' using errcode = '42501';
  end if;
  if new.status = 'published' and old.status <> 'published' then
    new.published_at := coalesce(old.published_at, now());
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  new.updated_by := auth.uid();
  new.created_by := old.created_by;
  return new;
end;
$$;
grant execute on function private.content_guard() to authenticated;

create trigger episodes_guard before insert or update on public.episodes for each row execute function private.content_guard();
create trigger reports_guard before insert or update on public.reports for each row execute function private.content_guard();
create trigger archive_items_guard before insert or update on public.archive_items for each row execute function private.content_guard();
create trigger sponsors_guard before insert or update on public.sponsors for each row execute function private.content_guard();

create or replace function private.media_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    new.version := 1;
  else
    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;
grant execute on function private.media_touch() to authenticated;
create trigger media_assets_touch before insert or update on public.media_assets for each row execute function private.media_touch();

-- Read access: visitors see published rows only, the team sees everything.
do $$
declare
  t text;
begin
  foreach t in array array['episodes', 'reports', 'archive_items', 'sponsors'] loop
    execute format('create policy "Visitors read published %1$s" on public.%1$I for select to anon using (status = ''published'')', t);
    execute format('create policy "Team reads all %1$s" on public.%1$I for select to authenticated using (status = ''published'' or private.has_role(''viewer''))', t);
    execute format('create policy "Editors create %1$s" on public.%1$I for insert to authenticated with check (private.has_role(''editor''))', t);
    execute format('create policy "Editors update %1$s" on public.%1$I for update to authenticated using (private.has_role(''editor'')) with check (private.has_role(''editor''))', t);
    execute format('create policy "Admins delete unpublished %1$s" on public.%1$I for delete to authenticated using (private.has_role(''admin'') and status <> ''published'')', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Visitors only see the public columns.
grant select (id, number, title, dek, guest, topic, language, duration_seconds, published_on, youtube_id, audio_url, chapters, image_id, seo_title, seo_description, status, updated_at) on public.episodes to anon;
grant select (id, topic, title, dek, read_minutes, published_on, url, status, updated_at) on public.reports to anon;
grant select (id, name, show, image_url, href, sort_order, status) on public.archive_items to anon;
grant select (id, name, name_accent, tagline, website_url, phone, image_id, thanks_text, thanks_image_id, placements, sort_order, status) on public.sponsors to anon;

-- ================================================================== drafts

create table public.content_drafts (
  entity text not null check (entity in ('episodes', 'reports', 'archive_items', 'sponsors')),
  entity_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  base_version integer not null,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (entity, entity_id)
);
comment on table public.content_drafts is 'Unpublished edits to live (published) items. Applied by admin_publish(); never visible to visitors.';
alter table public.content_drafts enable row level security;
create policy "Team reads drafts" on public.content_drafts for select to authenticated using (private.has_role('viewer'));
create policy "Editors write drafts" on public.content_drafts for insert to authenticated with check (private.has_role('editor'));
create policy "Editors update drafts" on public.content_drafts for update to authenticated using (private.has_role('editor')) with check (private.has_role('editor'));
create policy "Editors discard drafts" on public.content_drafts for delete to authenticated using (private.has_role('editor'));
revoke all on public.content_drafts from anon;
grant select, insert, update, delete on public.content_drafts to authenticated;

create or replace function private.draft_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
grant execute on function private.draft_touch() to authenticated;
create trigger content_drafts_touch before insert or update on public.content_drafts for each row execute function private.draft_touch();

-- =============================================================== revisions

create table public.content_revisions (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id text not null,
  version integer,
  action text not null check (action in ('created', 'updated', 'published', 'unpublished', 'archived', 'draft_saved')),
  snapshot jsonb not null,
  actor uuid,
  actor_email text,
  created_at timestamptz not null default now()
);
create index content_revisions_entity_idx on public.content_revisions (entity, entity_id, id desc);
alter table public.content_revisions enable row level security;
create policy "Team reads revisions" on public.content_revisions for select to authenticated using (private.has_role('viewer'));
revoke all on public.content_revisions from anon, authenticated;
grant select on public.content_revisions to authenticated;

create or replace function private.record_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_action text;
  v_snapshot jsonb;
begin
  if tg_table_name = 'content_drafts' then
    insert into public.content_revisions (entity, entity_id, version, action, snapshot, actor, actor_email)
    values (new.entity, new.entity_id, new.base_version, 'draft_saved', new.data, auth.uid(), private.actor_email());
    return null;
  end if;
  v_snapshot := to_jsonb(new) - array['created_by', 'updated_by'];
  if tg_op = 'INSERT' then
    v_action := 'created';
  elsif new.status is distinct from old.status then
    v_action := case new.status when 'published' then 'published' when 'archived' then 'archived' else 'unpublished' end;
  else
    v_action := 'updated';
  end if;
  insert into public.content_revisions (entity, entity_id, version, action, snapshot, actor, actor_email)
  values (tg_table_name, new.id::text, new.version, v_action, v_snapshot, auth.uid(), private.actor_email());
  return null;
end;
$$;
create trigger episodes_revision after insert or update on public.episodes for each row execute function private.record_revision();
create trigger reports_revision after insert or update on public.reports for each row execute function private.record_revision();
create trigger archive_items_revision after insert or update on public.archive_items for each row execute function private.record_revision();
create trigger sponsors_revision after insert or update on public.sponsors for each row execute function private.record_revision();
create trigger content_drafts_revision after insert or update on public.content_drafts for each row execute function private.record_revision();

create or replace function private.drop_drafts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.content_drafts where entity = tg_table_name and entity_id = old.id::text;
  return null;
end;
$$;
create trigger episodes_drop_drafts after delete on public.episodes for each row execute function private.drop_drafts();
create trigger reports_drop_drafts after delete on public.reports for each row execute function private.drop_drafts();
create trigger archive_items_drop_drafts after delete on public.archive_items for each row execute function private.drop_drafts();
create trigger sponsors_drop_drafts after delete on public.sponsors for each row execute function private.drop_drafts();

-- =============================================================== audit log

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor uuid,
  actor_email text,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity text not null,
  entity_id text,
  summary text not null default '',
  changes jsonb
);
create index audit_log_occurred_idx on public.audit_log (occurred_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id, occurred_at desc);
alter table public.audit_log enable row level security;
create policy "Admins read the audit log" on public.audit_log for select to authenticated using (private.has_role('admin'));
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- Records who changed what. Only changes made by signed-in team members are
-- recorded (visitor form submissions live in their own tables). Personal
-- data from talent releases is never copied into the log.
create or replace function private.audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb := '{}';
  v_key text;
  v_skip text[] := array['version', 'updated_at', 'updated_by', 'created_at', 'created_by'];
  v_private boolean := tg_table_name in ('talent_releases', 'newsletter_subscribers', 'booking_requests', 'guest_requests', 'support_pledges');
begin
  if auth.uid() is null then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      continue when v_key = any (v_skip);
      continue when v_private and v_key not in ('status', 'notes');
      if v_new -> v_key is distinct from v_old -> v_key then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_array(
          case when length((v_old -> v_key)::text) > 300 then to_jsonb('(long value)'::text) else v_old -> v_key end,
          case when length((v_new -> v_key)::text) > 300 then to_jsonb('(long value)'::text) else v_new -> v_key end));
      end if;
    end loop;
    if v_changes = '{}' then
      return null;
    end if;
  end if;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, summary, changes)
  values (
    auth.uid(),
    private.actor_email(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'user_id', v_row ->> 'entity_id'),
    left(coalesce(v_row ->> 'title', v_row ->> 'name', v_row ->> 'reference', v_row ->> 'file_name', v_row ->> 'key', v_row ->> 'email', ''), 200),
    case when tg_op = 'UPDATE' then v_changes end
  );
  return null;
end;
$$;

-- ======================================================= site configuration

create table public.site_config (
  key text primary key check (key in ('brand', 'seo', 'contact', 'social', 'navigation', 'footer', 'ticker', 'fundraising', 'home', 'credits', 'about', 'watch', 'podcast', 'images')),
  value jsonb not null check (jsonb_typeof(value) = 'object'),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.site_config is 'Site-wide settings, one JSON document per group. Saving a group applies it to the public site immediately.';
alter table public.site_config enable row level security;
create policy "Site configuration is public" on public.site_config for select to anon, authenticated using (true);
create policy "Admins change site configuration" on public.site_config for update to authenticated using (private.has_role('admin')) with check (private.has_role('admin'));
revoke all on public.site_config from anon, authenticated;
grant select (key, value, updated_at) on public.site_config to anon;
grant select, update on public.site_config to authenticated;

create or replace function private.cfg_text(v jsonb, path text, max_len integer, required boolean default false)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if v is null or jsonb_typeof(v) = 'null' then
    if required then raise exception 'invalid:%', path using errcode = '22023'; end if;
    return;
  end if;
  if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > max_len or (required and btrim(v #>> '{}') = '') then
    raise exception 'invalid:%', path using errcode = '22023';
  end if;
end;
$$;

create or replace function private.cfg_url(v jsonb, path text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if v is null or jsonb_typeof(v) = 'null' or v #>> '{}' = '' then return; end if;
  if jsonb_typeof(v) <> 'string' or v #>> '{}' !~ '^https://[^\s]+$' or char_length(v #>> '{}') > 500 then
    raise exception 'invalid:%', path using errcode = '22023';
  end if;
end;
$$;

create or replace function private.cfg_list(v jsonb, path text, max_items integer)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if v is null or jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > max_items then
    raise exception 'invalid:%', path using errcode = '22023';
  end if;
end;
$$;

create or replace function private.validate_config()
returns trigger language plpgsql set search_path = '' as $$
declare
  v jsonb := new.value;
  e jsonb;
  k text;
  v_keys text[];
begin
  case new.key
  when 'brand' then
    perform private.cfg_text(v -> 'siteName', 'brand.siteName', 60, true);
    perform private.cfg_text(v -> 'tagline', 'brand.tagline', 60);
    perform private.cfg_text(v -> 'description', 'brand.description', 200);
  when 'seo' then
    perform private.cfg_text(v -> 'defaultTitle', 'seo.defaultTitle', 70, true);
    perform private.cfg_text(v -> 'defaultDescription', 'seo.defaultDescription', 200, true);
  when 'contact' then
    foreach k in array array['bookingEmail', 'adsEmail'] loop
      if coalesce(v ->> k, '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
        raise exception 'invalid:contact.%', k using errcode = '22023';
      end if;
    end loop;
  when 'social' then
    foreach k in array array['youtube', 'facebook', 'x', 'vimeo'] loop
      perform private.cfg_url(v -> k, 'social.' || k);
    end loop;
  when 'navigation' then
    perform private.cfg_list(v -> 'header', 'navigation.header', 12);
    for e in select * from jsonb_array_elements(v -> 'header') loop
      perform private.cfg_text(e -> 'label', 'navigation.label', 40, true);
      if coalesce(e ->> 'href', '') !~ '^(/[A-Za-z0-9/_?=&#-]*|https://[^\s]+)$' then
        raise exception 'invalid:navigation.href' using errcode = '22023';
      end if;
      if jsonb_typeof(e -> 'visible') is distinct from 'boolean' then
        raise exception 'invalid:navigation.visible' using errcode = '22023';
      end if;
    end loop;
  when 'footer' then
    perform private.cfg_text(v -> 'languages', 'footer.languages', 120);
    perform private.cfg_url(v -> 'privacyUrl', 'footer.privacyUrl');
    perform private.cfg_url(v -> 'termsUrl', 'footer.termsUrl');
  when 'ticker' then
    if jsonb_typeof(v -> 'enabled') is distinct from 'boolean' then
      raise exception 'invalid:ticker.enabled' using errcode = '22023';
    end if;
    perform private.cfg_text(v -> 'label', 'ticker.label', 30);
    perform private.cfg_text(v -> 'text', 'ticker.text', 200, (v ->> 'enabled')::boolean);
    perform private.cfg_text(v -> 'linkLabel', 'ticker.linkLabel', 40);
    perform private.cfg_url(v -> 'linkUrl', 'ticker.linkUrl');
  when 'fundraising' then
    foreach k in array array['goalCents', 'raisedCents', 'supportersCount'] loop
      if not (v -> k is null or jsonb_typeof(v -> k) = 'null'
        or (jsonb_typeof(v -> k) = 'number' and (v ->> k)::numeric >= 0 and (v ->> k)::numeric % 1 = 0 and (v ->> k)::numeric <= 1000000000)) then
        raise exception 'invalid:fundraising.%', k using errcode = '22023';
      end if;
    end loop;
  when 'home' then
    perform private.cfg_list(v -> 'sections', 'home.sections', 12);
    v_keys := array(select x ->> 'key' from jsonb_array_elements(v -> 'sections') x);
    if not (v_keys <@ array['hero', 'appearances', 'story', 'recent', 'youtube', 'reports', 'fundraising', 'archive', 'sponsor_feature', 'sponsor_thanks'])
      or cardinality(v_keys) <> (select count(distinct x) from unnest(v_keys) x) then
      raise exception 'invalid:home.sections' using errcode = '22023';
    end if;
    perform private.cfg_list(v -> 'highlights', 'home.highlights', 6);
    for e in select * from jsonb_array_elements(v -> 'highlights') loop
      perform private.cfg_text(e -> 'value', 'home.highlights.value', 12, true);
      perform private.cfg_text(e -> 'label', 'home.highlights.label', 60, true);
    end loop;
    if coalesce(v #>> '{story,youtubeId}', '') !~ '^[A-Za-z0-9_-]{11}$' then
      raise exception 'invalid:home.story.youtubeId' using errcode = '22023';
    end if;
    perform private.cfg_text(v #> '{story,title}', 'home.story.title', 120, true);
    perform private.cfg_text(v #> '{story,body}', 'home.story.body', 400);
    perform private.cfg_text(v -> 'timelineIntro', 'home.timelineIntro', 200);
    perform private.cfg_list(v -> 'timeline', 'home.timeline', 12);
    for e in select * from jsonb_array_elements(v -> 'timeline') loop
      perform private.cfg_text(e -> 'year', 'home.timeline.year', 8, true);
      perform private.cfg_text(e -> 'text', 'home.timeline.text', 200, true);
    end loop;
  when 'credits' then
    foreach k in array array['appearances', 'clients'] loop
      perform private.cfg_list(v -> k, 'credits.' || k, 20);
      for e in select * from jsonb_array_elements(v -> k) loop
        perform private.cfg_text(e, 'credits.' || k, 40, true);
      end loop;
    end loop;
  when 'about' then
    perform private.cfg_text(v -> 'intro', 'about.intro', 600, true);
    perform private.cfg_list(v -> 'paragraphs', 'about.paragraphs', 6);
    for e in select * from jsonb_array_elements(v -> 'paragraphs') loop
      perform private.cfg_text(e, 'about.paragraphs', 1200, true);
    end loop;
    perform private.cfg_list(v -> 'facts', 'about.facts', 6);
    for e in select * from jsonb_array_elements(v -> 'facts') loop
      perform private.cfg_text(e -> 'label', 'about.facts.label', 40, true);
      perform private.cfg_text(e -> 'value', 'about.facts.value', 120, true);
    end loop;
  when 'watch' then
    perform private.cfg_list(v -> 'channels', 'watch.channels', 8);
    if jsonb_array_length(v -> 'channels') = 0 then
      raise exception 'invalid:watch.channels' using errcode = '22023';
    end if;
    for e in select * from jsonb_array_elements(v -> 'channels') loop
      perform private.cfg_text(e -> 'name', 'watch.channels.name', 40, true);
      perform private.cfg_text(e -> 'description', 'watch.channels.description', 80);
      if not (coalesce(e ->> 'playlistId', '') ~ '^[A-Za-z0-9_-]{10,64}$' or coalesce(e ->> 'videoId', '') ~ '^[A-Za-z0-9_-]{11}$') then
        raise exception 'invalid:watch.channels.source' using errcode = '22023';
      end if;
    end loop;
    perform private.cfg_list(v -> 'headlines', 'watch.headlines', 10);
    for e in select * from jsonb_array_elements(v -> 'headlines') loop
      perform private.cfg_text(e, 'watch.headlines', 120, true);
    end loop;
    perform private.cfg_text(v -> 'premiereTitle', 'watch.premiereTitle', 60);
    perform private.cfg_text(v -> 'premiereSubtitle', 'watch.premiereSubtitle', 80);
  when 'podcast' then
    if coalesce(v ->> 'uploadsPlaylistId', '') !~ '^[A-Za-z0-9_-]{10,64}$' then
      raise exception 'invalid:podcast.uploadsPlaylistId' using errcode = '22023';
    end if;
    perform private.cfg_list(v -> 'playlists', 'podcast.playlists', 6);
    for e in select * from jsonb_array_elements(v -> 'playlists') loop
      perform private.cfg_text(e -> 'label', 'podcast.playlists.label', 40, true);
      if coalesce(e ->> 'id', '') !~ '^[A-Za-z0-9_-]{10,64}$' then
        raise exception 'invalid:podcast.playlists.id' using errcode = '22023';
      end if;
    end loop;
  when 'images' then
    for k in select jsonb_object_keys(v) loop
      if k not in ('homeHero', 'aboutPortrait', 'guestPhoto', 'bookingHero', 'vipHero', 'episodeDefault') then
        raise exception 'invalid:images.%', k using errcode = '22023';
      end if;
      if jsonb_typeof(v -> k) <> 'null' and not exists (select 1 from public.media_assets m where m.id::text = v ->> k) then
        raise exception 'invalid:images.%', k using errcode = '22023';
      end if;
    end loop;
  else
    null;
  end case;
  if tg_op = 'UPDATE' then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
grant execute on function private.validate_config(), private.cfg_text(jsonb, text, integer, boolean), private.cfg_url(jsonb, text), private.cfg_list(jsonb, text, integer) to authenticated;
create trigger site_config_validate before insert or update on public.site_config for each row execute function private.validate_config();

-- A media file can't be deleted while a setting still points at it.
create or replace function private.media_in_use()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.site_config c where c.key = 'images' and c.value::text like '%' || old.id::text || '%') then
    raise exception 'in_use:media' using errcode = '23503';
  end if;
  return old;
end;
$$;
create trigger media_assets_in_use before delete on public.media_assets for each row execute function private.media_in_use();

-- ======================================================= visitor submissions

alter table public.booking_requests add column notes text not null default '' check (char_length(notes) <= 4000), add column updated_at timestamptz;
alter table public.guest_requests add column notes text not null default '' check (char_length(notes) <= 4000), add column updated_at timestamptz;
alter table public.support_pledges add column notes text not null default '' check (char_length(notes) <= 4000), add column updated_at timestamptz;
alter table public.talent_releases
  add column status text not null default 'valid' check (status in ('valid', 'void')),
  add column notes text not null default '' check (char_length(notes) <= 4000),
  add column updated_at timestamptz;
alter table public.newsletter_subscribers add column status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed'));

create or replace function private.stamp_updated()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
grant execute on function private.stamp_updated() to authenticated;
create trigger booking_requests_stamp before update on public.booking_requests for each row execute function private.stamp_updated();
create trigger guest_requests_stamp before update on public.guest_requests for each row execute function private.stamp_updated();
create trigger support_pledges_stamp before update on public.support_pledges for each row execute function private.stamp_updated();
create trigger talent_releases_stamp before update on public.talent_releases for each row execute function private.stamp_updated();
create trigger newsletter_subscribers_stamp before update on public.newsletter_subscribers for each row execute function private.stamp_updated();

create policy "Team reads booking requests" on public.booking_requests for select to authenticated using (private.has_role('viewer'));
create policy "Editors triage booking requests" on public.booking_requests for update to authenticated using (private.has_role('editor')) with check (private.has_role('editor'));
create policy "Admins delete booking requests" on public.booking_requests for delete to authenticated using (private.has_role('admin'));
create policy "Team reads guest requests" on public.guest_requests for select to authenticated using (private.has_role('viewer'));
create policy "Editors triage guest requests" on public.guest_requests for update to authenticated using (private.has_role('editor')) with check (private.has_role('editor'));
create policy "Admins delete guest requests" on public.guest_requests for delete to authenticated using (private.has_role('admin'));
create policy "Team reads pledges" on public.support_pledges for select to authenticated using (private.has_role('viewer'));
create policy "Admins update pledges" on public.support_pledges for update to authenticated using (private.has_role('admin')) with check (private.has_role('admin'));
create policy "Admins read releases" on public.talent_releases for select to authenticated using (private.has_role('admin'));
create policy "Admins update releases" on public.talent_releases for update to authenticated using (private.has_role('admin')) with check (private.has_role('admin'));
create policy "Team reads subscribers" on public.newsletter_subscribers for select to authenticated using (private.has_role('viewer'));
create policy "Editors update subscribers" on public.newsletter_subscribers for update to authenticated using (private.has_role('editor')) with check (private.has_role('editor'));
create policy "Admins delete subscribers" on public.newsletter_subscribers for delete to authenticated using (private.has_role('admin'));

grant select on public.booking_requests, public.guest_requests, public.support_pledges, public.talent_releases, public.newsletter_subscribers to authenticated;
grant update (status, notes) on public.booking_requests, public.guest_requests, public.support_pledges, public.talent_releases to authenticated;
grant update (status) on public.newsletter_subscribers to authenticated;
grant delete on public.booking_requests, public.guest_requests, public.newsletter_subscribers to authenticated;

-- Re-subscribing turns a subscriber back on.
create or replace function public.subscribe_newsletter(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_premiere boolean;
  v_briefing boolean;
  v_breaking boolean;
begin
  perform private.reject_bots(payload);
  v_email := private.clean_email(payload ->> 'email');
  v_premiere := private.flag(payload -> 'alert_premiere', 'alerts');
  v_briefing := private.flag(payload -> 'alert_briefing', 'alerts');
  v_breaking := private.flag(payload -> 'alert_breaking', 'alerts');
  if not (v_premiere or v_briefing or v_breaking) then
    raise exception 'required:alerts' using errcode = '22023';
  end if;

  insert into public.newsletter_subscribers (email, language, alert_premiere, alert_briefing, alert_breaking, source)
  values (
    v_email,
    private.pick_one(payload ->> 'language', 'language', array['English', 'Français', 'Kreyòl', 'Español']),
    v_premiere, v_briefing, v_breaking,
    private.pick_one(payload ->> 'source', 'source', array['subscribe_dialog', 'footer'])
  )
  on conflict ((lower(email))) do update
    set language = excluded.language,
        alert_premiere = excluded.alert_premiere,
        alert_briefing = excluded.alert_briefing,
        alert_breaking = excluded.alert_breaking,
        status = 'subscribed',
        updated_at = now();
end;
$$;

-- =========================================================== audit triggers

do $$
declare
  t text;
begin
  foreach t in array array['episodes', 'reports', 'archive_items', 'sponsors', 'media_assets', 'site_config', 'admin_members',
    'booking_requests', 'guest_requests', 'support_pledges', 'talent_releases', 'newsletter_subscribers'] loop
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$I for each row execute function private.audit()', t);
  end loop;
end;
$$;

-- ============================================================ admin RPCs

create or replace function private.editable_columns(p_entity text)
returns text[] language sql immutable set search_path = '' as $$
  select case p_entity
    when 'episodes' then array['number', 'title', 'dek', 'guest', 'topic', 'language', 'duration_seconds', 'published_on', 'youtube_id', 'audio_url', 'chapters', 'image_id', 'seo_title', 'seo_description']
    when 'reports' then array['topic', 'title', 'dek', 'read_minutes', 'published_on', 'url']
    when 'archive_items' then array['name', 'show', 'image_url', 'href', 'sort_order']
    when 'sponsors' then array['name', 'name_accent', 'tagline', 'website_url', 'phone', 'image_id', 'thanks_text', 'thanks_image_id', 'placements', 'sort_order']
  end
$$;

-- Publish an item: applies its pending draft (if any) and makes it public.
-- Fails with "conflict" when someone else changed the item first.
create or replace function public.admin_publish(p_entity text, p_id text, p_expected_version integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_cols text[] := private.editable_columns(p_entity);
  v_draft public.content_drafts;
  v_row jsonb;
  v_version integer;
  v_set text;
begin
  if v_cols is null then
    raise exception 'invalid:entity' using errcode = '22023';
  end if;
  if not private.has_role('admin') then
    raise exception 'forbidden:publish' using errcode = '42501';
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id::text = $1', p_entity) into v_row using p_id;
  if v_row is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (v_row ->> 'version')::integer <> p_expected_version then
    raise exception 'conflict' using errcode = '40001';
  end if;
  select * into v_draft from public.content_drafts d where d.entity = p_entity and d.entity_id = p_id;
  if v_draft.entity is not null and v_draft.base_version <> p_expected_version then
    raise exception 'conflict' using errcode = '40001';
  end if;
  v_set := (select string_agg(format('%I = r.%I', c, c), ', ') from unnest(v_cols) c);
  execute format(
    'update public.%I t set %s, status = ''published'' from jsonb_populate_record(null::public.%I, $1) r where t.id::text = $2 and t.version = $3 returning t.version',
    p_entity, v_set, p_entity)
  into v_version
  using v_row || coalesce(v_draft.data, '{}'::jsonb), p_id, p_expected_version;
  if v_version is null then
    raise exception 'conflict' using errcode = '40001';
  end if;
  delete from public.content_drafts d where d.entity = p_entity and d.entity_id = p_id;
  return v_version;
end;
$$;

create or replace function public.admin_set_member_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_current text;
begin
  if not private.has_role('owner') then
    raise exception 'forbidden:manage_team' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'editor', 'viewer') then
    raise exception 'invalid:role' using errcode = '22023';
  end if;
  if p_user = auth.uid() then
    raise exception 'forbidden:own_role' using errcode = '42501';
  end if;
  select role into v_current from public.admin_members where user_id = p_user;
  if v_current is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_current = 'owner' and p_role <> 'owner' and (select count(*) from public.admin_members where role = 'owner') <= 1 then
    raise exception 'forbidden:last_owner' using errcode = '42501';
  end if;
  update public.admin_members set role = p_role, updated_at = now() where user_id = p_user;
end;
$$;

create or replace function public.admin_remove_member(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('owner') then
    raise exception 'forbidden:manage_team' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'forbidden:own_role' using errcode = '42501';
  end if;
  if (select role from public.admin_members where user_id = p_user) = 'owner'
    and (select count(*) from public.admin_members where role = 'owner') <= 1 then
    raise exception 'forbidden:last_owner' using errcode = '42501';
  end if;
  delete from public.admin_members where user_id = p_user;
end;
$$;

create or replace function public.admin_update_profile(p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.admin_members
  set display_name = private.clean(p_display_name, 'display_name', 120), updated_at = now()
  where user_id = auth.uid();
end;
$$;

create or replace function public.admin_media_usage(p_id uuid)
returns table (entity text, entity_id text, label text, field text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_role('viewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select 'episodes'::text, e.id::text, e.title, 'Episode image'::text from public.episodes e where e.image_id = p_id
    union all
    select 'sponsors', s.id::text, s.name, 'Sponsor card image' from public.sponsors s where s.image_id = p_id
    union all
    select 'sponsors', s.id::text, s.name, 'Thank-you image' from public.sponsors s where s.thanks_image_id = p_id
    union all
    select 'site_config', 'images', k, 'Page image' from public.site_config c, jsonb_each_text(c.value) as j(k, v)
      where c.key = 'images' and j.v = p_id::text;
end;
$$;

-- Counts for the admin overview. p_from/p_to bound the "new in period" figures.
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
    'episodes_without_media', (select count(*) from public.episodes where status = 'published' and youtube_id is null and audio_url is null),
    'media', (select count(*) from public.media_assets)
  );
end;
$$;

-- First owner: run once from the SQL editor after creating the user in
-- Authentication → Users. Not callable through the API.
create or replace function private.grant_owner(p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No auth user with email %. Create it in Authentication → Users first.', p_email;
  end if;
  insert into public.admin_members (user_id, email, role) values (v_user, lower(btrim(p_email)), 'owner')
  on conflict (user_id) do update set role = 'owner', updated_at = now();
end;
$$;
revoke execute on function private.grant_owner(text) from authenticated;

revoke execute on function public.admin_publish(text, text, integer), public.admin_set_member_role(uuid, text), public.admin_remove_member(uuid),
  public.admin_update_profile(text), public.admin_media_usage(uuid), public.admin_dashboard(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_publish(text, text, integer), public.admin_set_member_role(uuid, text), public.admin_remove_member(uuid),
  public.admin_update_profile(text), public.admin_media_usage(uuid), public.admin_dashboard(timestamptz, timestamptz) to authenticated;
