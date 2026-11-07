-- Minimal stand-in for the parts of a Supabase database that the migrations and the
-- pgTAP tests rely on, for running `pnpm test:db` without Docker. CI runs the same
-- tests against the real Supabase image (`supabase test db`).
--
-- Reproduces: the API roles, the auth schema with a minimal auth.users and the
-- auth.uid()/auth.jwt()/auth.role() helpers that read request.jwt.claims, the
-- extensions schema, Supabase's default privileges on the public schema (every
-- API role gets every privilege on new tables and functions), so a migration that
-- forgets to revoke something fails here too, the storage tables that the
-- step-photo policies apply to (copied from the Supabase image's storage schema),
-- and the Realtime broadcast table with realtime.topic() and realtime.send().

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;

create schema extensions;
create schema auth;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- The columns of auth.users that the app or the tests touch.
create table auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

-- Storage: the bucket and object tables with row-level security and Supabase's
-- grants (every API role has full table privileges; policies decide). Direct deletes
-- are refused unless storage.allow_delete_query is 'true', which is how the Storage
-- API deletes objects, so tests must delete the same way.
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  owner_id text,
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text,
  user_metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on table storage.buckets, storage.objects to anon, authenticated, service_role;

create function storage.foldername(name text) returns text[]
language plpgsql immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end
$$;

create function storage.protect_delete() returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('storage.allow_delete_query', true), 'false') != 'true' then
    raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
      using errcode = '42501';
  end if;
  return null;
end;
$$;

create trigger protect_objects_delete
  before delete on storage.objects
  for each statement execute function storage.protect_delete();

grant execute on all functions in schema storage to anon, authenticated, service_role;

-- Realtime: the broadcast message table with row-level security and the image's grants
-- (the API roles read, insert and update; policies decide), realtime.topic(), which
-- reads the topic a client is joining, and realtime.send(), which inserts a broadcast
-- and, like the original, turns any failure into a warning. The image partitions
-- messages by day; one table is enough here.
create schema realtime;
grant usage on schema realtime to anon, authenticated, service_role;

create table realtime.messages (
  topic text not null,
  extension text not null,
  payload jsonb,
  event text,
  private boolean default false,
  updated_at timestamp not null default now(),
  inserted_at timestamp not null default now(),
  id uuid not null default gen_random_uuid(),
  primary key (id, inserted_at)
);

alter table realtime.messages enable row level security;
grant select, insert, update on table realtime.messages to anon, authenticated, service_role;

create function realtime.topic() returns text
language sql stable
as $$
  select nullif(current_setting('realtime.topic', true), '')::text;
$$;

create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void
language plpgsql
as $$
declare
  generated_id uuid;
  final_payload jsonb;
begin
  begin
    generated_id := gen_random_uuid();
    if payload ? 'id' then
      final_payload := payload;
    else
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    end if;
    execute format('SET LOCAL realtime.topic TO %L', topic);
    insert into realtime.messages (id, payload, event, topic, private, extension)
    values (generated_id, final_payload, event, topic, private, 'broadcast');
  exception
    when others then
      raise warning 'WarnSendingBroadcastMessage: %', sqlerrm;
  end;
end;
$$;

grant execute on all functions in schema realtime to anon, authenticated, service_role;
