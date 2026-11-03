-- Visitor submissions: newsletter sign-ups, booking/ad requests, guest
-- pitches, signed talent releases and support pledges.
--
-- Visitors never touch these tables directly: RLS is on with no policies and
-- table privileges are revoked. Each form calls one SECURITY DEFINER function
-- that re-validates every field (mirroring src/lib/validation.ts), throttles
-- repeats per email, rejects bot submissions (honeypot) and returns a
-- server-generated reference. Errors are raised as `required:<field>`,
-- `invalid:<field>`, `too_long:<field>` or `rate_limited`, which the site
-- turns into readable messages.

-- ------------------------------------------------------------------ helpers

create or replace function private.clean(v text, field text, max_len integer, required boolean default false)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text := btrim(coalesce(v, ''));
begin
  if required and t = '' then
    raise exception 'required:%', field using errcode = '22023';
  end if;
  if char_length(t) > max_len then
    raise exception 'too_long:%', field using errcode = '22023';
  end if;
  return t;
end;
$$;

create or replace function private.clean_email(v text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text := btrim(coalesce(v, ''));
begin
  if t = '' then
    raise exception 'required:email' using errcode = '22023';
  end if;
  if char_length(t) > 254 or t !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'invalid:email' using errcode = '22023';
  end if;
  return t;
end;
$$;

create or replace function private.clean_phone(v text, required boolean default false)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text := btrim(coalesce(v, ''));
begin
  if t = '' then
    if required then
      raise exception 'required:phone' using errcode = '22023';
    end if;
    return '';
  end if;
  if t !~ '^[+()0-9 .-]{7,25}$' then
    raise exception 'invalid:phone' using errcode = '22023';
  end if;
  return t;
end;
$$;

create or replace function private.parse_date(v text, field text, required boolean default false)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if coalesce(btrim(v), '') = '' then
    if required then
      raise exception 'required:%', field using errcode = '22023';
    end if;
    return null;
  end if;
  if v !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'invalid:%', field using errcode = '22023';
  end if;
  return v::date;
exception
  when invalid_datetime_format or datetime_field_overflow then
    raise exception 'invalid:%', field using errcode = '22023';
end;
$$;

-- Array of allowed text values from a JSON array; at least one item.
create or replace function private.pick_many(v jsonb, field text, allowed text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  out text[];
begin
  if v is null or jsonb_typeof(v) <> 'array' then
    raise exception 'required:%', field using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x), '{}') into out from jsonb_array_elements_text(v) as x;
  if cardinality(out) = 0 then
    raise exception 'required:%', field using errcode = '22023';
  end if;
  if not (out <@ allowed) then
    raise exception 'invalid:%', field using errcode = '22023';
  end if;
  return out;
end;
$$;

create or replace function private.pick_one(v text, field text, allowed text[])
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if v is null or not (v = any (allowed)) then
    raise exception 'invalid:%', field using errcode = '22023';
  end if;
  return v;
end;
$$;

create or replace function private.flag(v jsonb, field text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if v is null or jsonb_typeof(v) <> 'boolean' then
    raise exception 'invalid:%', field using errcode = '22023';
  end if;
  return v::boolean;
end;
$$;

create or replace function private.reject_bots(payload jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid:payload' using errcode = '22023';
  end if;
  if coalesce(payload ->> 'website', '') <> '' then
    raise exception 'invalid:submission' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.normalize_name(v text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(normalize(coalesce(v, ''), nfc)), '\s+', ' ', 'g'));
$$;

revoke execute on all functions in schema private from public, anon, authenticated;

-- ------------------------------------------------------------------- tables

create sequence private.booking_ref_seq start 2601;
create sequence private.guest_ref_seq start 101;
create sequence private.release_ref_seq start 10001;
create sequence private.vip_ref_seq start 1001;
create sequence private.donation_ref_seq start 1001;

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) <= 254),
  language text not null check (language in ('English', 'Français', 'Kreyòl', 'Español')),
  alert_premiere boolean not null default true,
  alert_briefing boolean not null default true,
  alert_breaking boolean not null default false,
  source text not null check (source in ('subscribe_dialog', 'footer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index newsletter_subscribers_email_key on public.newsletter_subscribers (lower(email));

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  request_type text not null check (request_type in ('Event hosting', 'Keynote / appearance', 'Sponsored coverage', 'Advertising')),
  full_name text not null check (char_length(full_name) between 1 and 120),
  organization text not null default '' check (char_length(organization) <= 160),
  email text not null check (char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 25),
  event_date date,
  venue text not null default '' check (char_length(venue) <= 200),
  audience text check (audience in ('Under 100', '100–500', '500–2,000', '2,000+')),
  campaign_start date,
  product text not null default '' check (char_length(product) <= 200),
  languages text[] not null check (cardinality(languages) between 1 and 4 and languages <@ array['English', 'Français', 'Kreyòl', 'Español']),
  budget text not null check (budget in ('Under $2.5k', '$2.5k–$10k', '$10k–$25k', '$25k+')),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'in_review', 'closed')),
  created_at timestamptz not null default now()
);
create index booking_requests_created_idx on public.booking_requests (created_at desc);
create index booking_requests_email_idx on public.booking_requests (lower(email), created_at desc);

create table public.guest_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  full_name text not null check (char_length(full_name) between 1 and 120),
  title_org text not null default '' check (char_length(title_org) <= 160),
  email text not null check (char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 25),
  topic text not null check (topic in ('Haiti', 'Immigration', 'Politics', 'Community', 'Culture', 'Sports', 'Entertainment')),
  languages text[] not null check (cardinality(languages) between 1 and 4 and languages <@ array['English', 'Français', 'Kreyòl', 'Español']),
  format text not null check (format in ('One-on-one interview', 'Remote · video call')),
  links text not null default '' check (char_length(links) <= 500),
  pitch text not null check (char_length(pitch) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'in_review', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index guest_requests_created_idx on public.guest_requests (created_at desc);
create index guest_requests_email_idx on public.guest_requests (lower(email), created_at desc);

create table public.talent_releases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  legal_name text not null check (char_length(legal_name) between 1 and 120),
  screen_name text not null check (char_length(screen_name) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) between 7 and 25),
  mailing_address text not null check (char_length(mailing_address) between 1 and 300),
  date_of_birth date not null,
  episode text not null check (char_length(episode) between 1 and 200),
  recording_date date not null,
  is_minor boolean not null,
  guardian_name text not null default '' check (char_length(guardian_name) <= 120),
  guardian_relationship text not null default '' check (char_length(guardian_relationship) <= 200),
  consents boolean[] not null check (cardinality(consents) = 4 and true = all (consents)),
  signature text not null check (char_length(signature) between 1 and 120),
  terms_version text not null,
  signed_at timestamptz not null default now(),
  signer_ip inet,
  user_agent text not null default '' check (char_length(user_agent) <= 400),
  check (not is_minor or (guardian_name <> '' and guardian_relationship <> ''))
);
comment on table public.talent_releases is 'Signed guest releases. Contains personal data (date of birth, address): keep access to the team.';
create index talent_releases_signed_idx on public.talent_releases (signed_at desc);
create index talent_releases_email_idx on public.talent_releases (lower(email), signed_at desc);

create table public.support_pledges (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  kind text not null check (kind in ('donation', 'vip')),
  frequency text not null check (frequency in ('monthly', 'once')),
  amount_cents integer not null check (amount_cents between 100 and 10000000),
  cover_fees boolean not null default false,
  total_cents integer not null check (total_cents >= amount_cents),
  method text not null check (method in ('Card', 'PayPal', 'Apple Pay', 'Google Pay', 'Cash App', 'Zelle')),
  tier text check (tier in ('Supporter', 'Insider', 'Patron', 'VIP')),
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text not null check (char_length(email) <= 254),
  status text not null default 'pending_payment' check (status in ('pending_payment', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  check (kind <> 'vip' or (amount_cents = 4599 and frequency = 'monthly' and tier = 'VIP' and full_name <> ''))
);
comment on table public.support_pledges is 'Donation and VIP pledges. No payment is taken on the site; the team follows up with a payment link and updates status.';
create index support_pledges_created_idx on public.support_pledges (created_at desc);
create index support_pledges_email_idx on public.support_pledges (lower(email), created_at desc);

alter table public.newsletter_subscribers enable row level security;
alter table public.booking_requests enable row level security;
alter table public.guest_requests enable row level security;
alter table public.talent_releases enable row level security;
alter table public.support_pledges enable row level security;

revoke all on public.newsletter_subscribers, public.booking_requests, public.guest_requests, public.talent_releases, public.support_pledges from anon, authenticated;

-- ---------------------------------------------------------------- functions

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
        updated_at = now();
end;
$$;

create or replace function public.submit_booking_request(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_type text;
  v_is_ad boolean;
  v_event date;
  v_campaign date;
  v_ref text;
begin
  perform private.reject_bots(payload);
  v_email := private.clean_email(payload ->> 'email');
  if (select count(*) from public.booking_requests where lower(email) = lower(v_email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_type := private.pick_one(payload ->> 'request_type', 'request_type', array['Event hosting', 'Keynote / appearance', 'Sponsored coverage', 'Advertising']);
  v_is_ad := v_type = 'Advertising';
  v_event := case when v_is_ad then null else private.parse_date(payload ->> 'event_date', 'event_date') end;
  v_campaign := case when v_is_ad then private.parse_date(payload ->> 'campaign_start', 'campaign_start') else null end;
  -- one day of slack for visitors in time zones behind UTC
  if v_event < current_date - 1 then
    raise exception 'invalid:event_date' using errcode = '22023';
  end if;
  if v_campaign < current_date - 1 then
    raise exception 'invalid:campaign_start' using errcode = '22023';
  end if;

  v_ref := 'JR-' || nextval('private.booking_ref_seq');
  insert into public.booking_requests (
    reference, request_type, full_name, organization, email, phone, event_date, venue, audience,
    campaign_start, product, languages, budget, message
  ) values (
    v_ref,
    v_type,
    private.clean(payload ->> 'full_name', 'full_name', 120, true),
    private.clean(payload ->> 'organization', 'organization', 160),
    v_email,
    private.clean_phone(payload ->> 'phone'),
    v_event,
    case when v_is_ad then '' else private.clean(payload ->> 'venue', 'venue', 200) end,
    case when v_is_ad then null else private.pick_one(payload ->> 'audience', 'audience', array['Under 100', '100–500', '500–2,000', '2,000+']) end,
    v_campaign,
    case when v_is_ad then private.clean(payload ->> 'product', 'product', 200) else '' end,
    private.pick_many(payload -> 'languages', 'languages', array['English', 'Français', 'Kreyòl', 'Español']),
    private.pick_one(payload ->> 'budget', 'budget', array['Under $2.5k', '$2.5k–$10k', '$10k–$25k', '$25k+']),
    private.clean(payload ->> 'message', 'message', 4000, true)
  );
  return v_ref;
end;
$$;

create or replace function public.submit_guest_request(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_ref text;
begin
  perform private.reject_bots(payload);
  v_email := private.clean_email(payload ->> 'email');
  if (select count(*) from public.guest_requests where lower(email) = lower(v_email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_ref := 'JR-G-' || nextval('private.guest_ref_seq');
  insert into public.guest_requests (reference, full_name, title_org, email, phone, topic, languages, format, links, pitch)
  values (
    v_ref,
    private.clean(payload ->> 'full_name', 'full_name', 120, true),
    private.clean(payload ->> 'title_org', 'title_org', 160),
    v_email,
    private.clean_phone(payload ->> 'phone'),
    private.pick_one(payload ->> 'topic', 'topic', array['Haiti', 'Immigration', 'Politics', 'Community', 'Culture', 'Sports', 'Entertainment']),
    private.pick_many(payload -> 'languages', 'languages', array['English', 'Français', 'Kreyòl', 'Español']),
    private.pick_one(payload ->> 'format', 'format', array['One-on-one interview', 'Remote · video call']),
    private.clean(payload ->> 'links', 'links', 500),
    private.clean(payload ->> 'pitch', 'pitch', 4000, true)
  );
  return v_ref;
end;
$$;

create or replace function public.sign_talent_release(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_legal text;
  v_minor boolean;
  v_guardian text;
  v_relationship text;
  v_dob date;
  v_signature text;
  v_consents boolean[];
  v_headers jsonb;
  v_ip inet;
  v_ref text;
  v_signed timestamptz;
begin
  perform private.reject_bots(payload);
  v_email := private.clean_email(payload ->> 'email');
  if (select count(*) from public.talent_releases where lower(email) = lower(v_email) and signed_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_legal := private.clean(payload ->> 'legal_name', 'legal_name', 120, true);
  v_minor := private.flag(payload -> 'is_minor', 'is_minor');
  v_guardian := case when v_minor then private.clean(payload ->> 'guardian_name', 'guardian_name', 120, true) else '' end;
  v_relationship := case when v_minor then private.clean(payload ->> 'guardian_relationship', 'guardian_relationship', 200, true) else '' end;

  v_dob := private.parse_date(payload ->> 'date_of_birth', 'date_of_birth', true);
  if v_dob >= current_date or v_dob < date '1900-01-01' then
    raise exception 'invalid:date_of_birth' using errcode = '22023';
  end if;
  if not v_minor and v_dob > (current_date - interval '18 years')::date then
    raise exception 'invalid:date_of_birth' using errcode = '22023';
  end if;

  if jsonb_typeof(payload -> 'consents') is distinct from 'array' or jsonb_array_length(payload -> 'consents') <> 4 then
    raise exception 'required:consents' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(payload -> 'consents') as e where jsonb_typeof(e) <> 'boolean') then
    raise exception 'invalid:consents' using errcode = '22023';
  end if;
  select array_agg(x::boolean) into v_consents from jsonb_array_elements(payload -> 'consents') as x;
  if not (true = all (v_consents)) then
    raise exception 'required:consents' using errcode = '22023';
  end if;

  v_signature := private.clean(payload ->> 'signature', 'signature', 120, true);
  if private.normalize_name(v_signature) <> private.normalize_name(case when v_minor then v_guardian else v_legal end) then
    raise exception 'invalid:signature' using errcode = '22023';
  end if;

  -- Record where the signature came from, as the form tells the signer.
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_ip := nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1)), '')::inet;
  exception when others then
    v_ip := null;
  end;

  v_ref := 'JR-TR-' || nextval('private.release_ref_seq');
  insert into public.talent_releases (
    reference, legal_name, screen_name, email, phone, mailing_address, date_of_birth, episode, recording_date,
    is_minor, guardian_name, guardian_relationship, consents, signature, terms_version, signer_ip, user_agent
  ) values (
    v_ref,
    v_legal,
    private.clean(payload ->> 'screen_name', 'screen_name', 120, true),
    v_email,
    private.clean_phone(payload ->> 'phone', true),
    private.clean(payload ->> 'mailing_address', 'mailing_address', 300, true),
    v_dob,
    private.clean(payload ->> 'episode', 'episode', 200, true),
    private.parse_date(payload ->> 'recording_date', 'recording_date', true),
    v_minor,
    v_guardian,
    v_relationship,
    v_consents,
    v_signature,
    private.pick_one(payload ->> 'terms_version', 'terms_version', array['2026-09']),
    v_ip,
    left(coalesce(payload ->> 'user_agent', ''), 400)
  )
  returning signed_at into v_signed;

  return jsonb_build_object('reference', v_ref, 'signed_at', v_signed);
end;
$$;

create or replace function public.submit_support_pledge(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_kind text;
  v_frequency text;
  v_amount integer;
  v_cover boolean;
  v_tier text;
  v_name text;
  v_ref text;
begin
  perform private.reject_bots(payload);
  v_email := private.clean_email(payload ->> 'email');
  if (select count(*) from public.support_pledges where lower(email) = lower(v_email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_kind := private.pick_one(payload ->> 'kind', 'kind', array['donation', 'vip']);
  v_frequency := private.pick_one(payload ->> 'frequency', 'frequency', array['monthly', 'once']);
  if jsonb_typeof(payload -> 'amount_cents') is distinct from 'number' then
    raise exception 'invalid:amount_cents' using errcode = '22023';
  end if;
  if (payload ->> 'amount_cents')::numeric not between 100 and 10000000 or (payload ->> 'amount_cents')::numeric % 1 <> 0 then
    raise exception 'invalid:amount_cents' using errcode = '22023';
  end if;
  v_amount := (payload ->> 'amount_cents')::numeric::integer;
  v_cover := private.flag(payload -> 'cover_fees', 'cover_fees');
  v_name := private.clean(payload ->> 'full_name', 'full_name', 120, v_kind = 'vip');

  if v_kind = 'vip' then
    if v_amount <> 4599 or v_frequency <> 'monthly' then
      raise exception 'invalid:amount_cents' using errcode = '22023';
    end if;
    if not private.flag(payload -> 'agreed', 'agreed') then
      raise exception 'required:agreed' using errcode = '22023';
    end if;
    v_tier := 'VIP';
    v_cover := false;
    v_ref := 'JR-VIP-' || nextval('private.vip_ref_seq');
  else
    v_tier := case
      when v_frequency = 'monthly' and payload ->> 'tier' in ('Supporter', 'Insider', 'Patron') then payload ->> 'tier'
      else null
    end;
    v_ref := 'JR-D-' || nextval('private.donation_ref_seq');
  end if;

  insert into public.support_pledges (reference, kind, frequency, amount_cents, cover_fees, total_cents, method, tier, full_name, email)
  values (
    v_ref, v_kind, v_frequency, v_amount, v_cover,
    case when v_cover then round(v_amount * 1.03)::integer else v_amount end,
    private.pick_one(payload ->> 'method', 'method', array['Card', 'PayPal', 'Apple Pay', 'Google Pay', 'Cash App', 'Zelle']),
    v_tier, v_name, v_email
  );
  return v_ref;
end;
$$;

revoke execute on function public.subscribe_newsletter(jsonb), public.submit_booking_request(jsonb), public.submit_guest_request(jsonb),
  public.sign_talent_release(jsonb), public.submit_support_pledge(jsonb) from public;
grant execute on function public.subscribe_newsletter(jsonb), public.submit_booking_request(jsonb), public.submit_guest_request(jsonb),
  public.sign_talent_release(jsonb), public.submit_support_pledge(jsonb) to anon, authenticated;
