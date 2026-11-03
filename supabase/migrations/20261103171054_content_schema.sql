-- Content shown on the public site: episodes, written reports, the interview
-- archive and a single settings row. Visitors (anon) can only read published
-- rows; the team edits them from the Supabase dashboard (service role).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.touch_updated_at() from public, anon, authenticated;

create table public.episodes (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 80),
  number integer not null unique check (number > 0),
  title text not null check (char_length(title) between 1 and 200),
  dek text not null default '' check (char_length(dek) <= 600),
  guest text not null default '' check (char_length(guest) <= 200),
  topic text not null check (topic in ('Haiti', 'Immigration', 'Politics', 'Community', 'Culture', 'Sports', 'Entertainment')),
  language text not null check (language in ('EN', 'FR', 'KR', 'ES')),
  duration_seconds integer not null check (duration_seconds > 0),
  published_on date not null,
  youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  audio_url text check (audio_url ~ '^https://'),
  chapters jsonb not null default '[]'::jsonb check (jsonb_typeof(chapters) = 'array'),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.episodes.youtube_id is '11-character YouTube video id. Enables the on-page video player.';
comment on column public.episodes.audio_url is 'HTTPS URL of the episode audio. Enables the site audio player.';
comment on column public.episodes.chapters is 'Array of {"at": seconds, "label": text}.';
create index episodes_published_idx on public.episodes (published_on desc, number desc) where is_published;

create table public.reports (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 120),
  topic text not null check (topic in ('Haiti', 'Immigration', 'Politics', 'Community', 'Culture', 'Sports', 'Entertainment')),
  title text not null check (char_length(title) between 1 and 200),
  dek text not null default '' check (char_length(dek) <= 600),
  read_minutes integer not null check (read_minutes between 1 and 120),
  published_on date not null,
  url text check (url ~ '^https://'),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.reports.url is 'Optional link to the full report. Without it the card is not a link.';
create index reports_published_idx on public.reports (published_on desc) where is_published;

create table public.archive_items (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 160),
  show text not null default '' check (char_length(show) <= 160),
  image_url text not null check (image_url ~ '^https://'),
  href text not null check (href ~ '^https://'),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index archive_items_order_idx on public.archive_items (sort_order) where is_published;

create table public.site_settings (
  id boolean primary key default true check (id),
  show_ticker boolean not null default true,
  ticker_text text not null default '' check (char_length(ticker_text) <= 200),
  ticker_link_url text not null default '' check (ticker_link_url = '' or ticker_link_url ~ '^https://'),
  monthly_goal_cents integer check (monthly_goal_cents > 0),
  raised_cents integer check (raised_cents >= 0),
  supporters_count integer check (supporters_count >= 0),
  updated_at timestamptz not null default now()
);
comment on table public.site_settings is 'Single row. Leave raised_cents / supporters_count null until real figures exist; the site then hides them.';

create trigger episodes_touch before update on public.episodes for each row execute function private.touch_updated_at();
create trigger reports_touch before update on public.reports for each row execute function private.touch_updated_at();
create trigger archive_items_touch before update on public.archive_items for each row execute function private.touch_updated_at();
create trigger site_settings_touch before update on public.site_settings for each row execute function private.touch_updated_at();

alter table public.episodes enable row level security;
alter table public.reports enable row level security;
alter table public.archive_items enable row level security;
alter table public.site_settings enable row level security;

create policy "Published episodes are public" on public.episodes for select to anon, authenticated using (is_published);
create policy "Published reports are public" on public.reports for select to anon, authenticated using (is_published);
create policy "Published archive items are public" on public.archive_items for select to anon, authenticated using (is_published);
create policy "Site settings are public" on public.site_settings for select to anon, authenticated using (true);

-- Read-only for site visitors, even if a write policy is ever added by mistake.
revoke insert, update, delete, truncate, references, trigger on public.episodes, public.reports, public.archive_items, public.site_settings from anon, authenticated;
grant select on public.episodes, public.reports, public.archive_items, public.site_settings to anon, authenticated;
