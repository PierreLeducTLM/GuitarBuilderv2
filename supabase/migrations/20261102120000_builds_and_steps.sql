-- Guitar builds, their step state and the step-photo bucket.
--
-- Specs: guitar-builds (Persisted Build Attributes, New Build Defaults, Build
-- Ownership, Administrator Access to Builds, Delete Build Cascade), build-sequence
-- (Step State Persistence, Step Data Access, Step Photo Storage, Step Measurement
-- Record) and build-story-sharing (No Enumeration of Shared Builds).
--
-- Rules enforced here, all covered by supabase/tests/database:
-- * only the owner creates, changes or deletes a build; an administrator reads any
--   build and changes none; anonymous visitors read nothing;
-- * nobody reads a share token, and clients write only the name, guitar type and
--   BOBO choice (at creation) or the guitar type and BOBO choice (afterwards);
-- * the step state changes only through update_build_step(), one step at a time,
--   under a row lock, so concurrent edits of different steps never overwrite each
--   other;
-- * step photos are images stored under <build id>/<step key>/, written, read and
--   deleted only by the owner of that build, and never listable anonymously.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.builds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null
    constraint builds_name_not_blank check (name ~ '\S'),
  guitar_type text
    constraint builds_guitar_type_check check (guitar_type in ('classical', 'steel_string')),
  bobo_neck boolean not null,
  sequence_state jsonb not null default '[]'::jsonb
    constraint builds_sequence_state_is_array check (jsonb_typeof(sequence_state) = 'array'),
  share_token uuid
    constraint builds_share_token_key unique,
  share_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.builds is
  'One guitar under construction, owned by one user (guitar-builds).';
comment on column public.builds.guitar_type is
  'classical or steel_string; null ("not set") only for builds imported from the legacy app.';
comment on column public.builds.sequence_state is
  'Step state: a list of {key, completed, notes, photos, measurements} entries, one per '
  'step changed so far (build-sequence). Written only by update_build_step().';
comment on column public.builds.share_token is
  'Secret of the public story link. Readable by no client role (build-story-sharing).';

create index builds_owner_created_idx on public.builds (owner_id, created_at desc);

-- Every change moves updated_at (guitar-builds: Update timestamp moves on change).
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated, service_role;

create trigger builds_set_updated_at
  before update on public.builds
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

alter table public.builds enable row level security;

-- Column-level grants: share_token is readable by nobody, and sequence_state and the
-- share columns are writable by no client role.
revoke all on table public.builds from public, anon, authenticated, service_role;
grant select (id, owner_id, name, guitar_type, bobo_neck, sequence_state, share_enabled,
              created_at, updated_at)
  on table public.builds to authenticated;
grant insert (name, guitar_type, bobo_neck) on table public.builds to authenticated;
grant update (guitar_type, bobo_neck) on table public.builds to authenticated;
grant delete on table public.builds to authenticated;
grant select on table public.builds to service_role;

-- Owners read their builds; administrators read every build (read-only access).
-- The builds list filters on the owner itself, so administrators list only their own.
create policy "Owners and administrators read builds"
  on public.builds
  for select
  to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

-- New builds belong to their creator and have a guitar type ("not set" is only for
-- imported builds).
create policy "Users create their own builds"
  on public.builds
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()) and guitar_type is not null);

create policy "Owners change their builds"
  on public.builds
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and guitar_type is not null);

create policy "Owners delete their builds"
  on public.builds
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Step changes
-- ---------------------------------------------------------------------------

-- Applies one change to one step of one of the caller's builds and returns the
-- step's entry after the change. The row lock serializes concurrent calls, so two
-- devices editing different steps (or different fields) never lose each other's
-- changes. Operations (p_change ->> 'op'):
--   set_completed {completed}           set_notes {notes}
--   add_photos {photos: [{url, name}]}  remove_photo {name}
--   add_measurement {measurement}       set_measurement_description {id, description}
--   remove_measurement {id}
-- A missing build and another user's build raise the same error, so the function
-- reveals nothing about builds the caller does not own.
create function public.update_build_step(p_build_id uuid, p_step_key text, p_change jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state jsonb;
  v_entry jsonb;
  v_index integer;
  v_op text;
  v_list jsonb;
  v_item jsonb;
  v_text text;
  v_spectrum jsonb;
  v_length integer;
begin
  select b.sequence_state
    into v_state
    from public.builds b
   where b.id = p_build_id
     and b.owner_id = (select auth.uid())
     for update;
  if not found then
    raise exception 'Build not found' using errcode = 'P0002';
  end if;

  if p_step_key is null or p_step_key !~ '^[A-Za-z0-9]{1,64}$' then
    raise exception 'Invalid step key' using errcode = '22023';
  end if;
  if p_change is null or jsonb_typeof(p_change) <> 'object' then
    raise exception 'Invalid change' using errcode = '22023';
  end if;
  v_op := p_change ->> 'op';

  -- The step's current entry, normalized: missing or malformed fields read as empty
  -- (build-sequence: Step State Loading).
  select (t.ord - 1)::integer, t.elem
    into v_index, v_entry
    from jsonb_array_elements(v_state) with ordinality as t (elem, ord)
   where t.elem ->> 'key' = p_step_key
   limit 1;
  v_entry := jsonb_build_object(
    'key', p_step_key,
    'completed', coalesce(case when jsonb_typeof(v_entry -> 'completed') = 'boolean'
                               then (v_entry -> 'completed') end, 'false'::jsonb),
    'notes', coalesce(case when jsonb_typeof(v_entry -> 'notes') = 'string'
                           then (v_entry -> 'notes') end, '""'::jsonb),
    'photos', coalesce(case when jsonb_typeof(v_entry -> 'photos') = 'array'
                            then (v_entry -> 'photos') end, '[]'::jsonb),
    'measurements', coalesce(case when jsonb_typeof(v_entry -> 'measurements') = 'array'
                                  then (v_entry -> 'measurements') end, '[]'::jsonb)
  );

  case v_op
  when 'set_completed' then
    if jsonb_typeof(p_change -> 'completed') is distinct from 'boolean' then
      raise exception 'completed must be a boolean' using errcode = '22023';
    end if;
    v_entry := jsonb_set(v_entry, '{completed}', p_change -> 'completed');

  when 'set_notes' then
    if jsonb_typeof(p_change -> 'notes') is distinct from 'string' then
      raise exception 'notes must be text' using errcode = '22023';
    end if;
    v_entry := jsonb_set(v_entry, '{notes}', p_change -> 'notes');

  when 'add_photos' then
    v_list := p_change -> 'photos';
    if jsonb_typeof(v_list) is distinct from 'array' or jsonb_array_length(v_list) = 0 then
      raise exception 'photos must be a non-empty list' using errcode = '22023';
    end if;
    for v_item in select value from jsonb_array_elements(v_list) loop
      if jsonb_typeof(v_item -> 'name') is distinct from 'string'
         or jsonb_typeof(v_item -> 'url') is distinct from 'string'
         or (v_item ->> 'name') !~ '^[0-9]{1,16}_[A-Za-z0-9]{1,32}\.[A-Za-z0-9]{1,16}$'
         or right(v_item ->> 'url', length(p_build_id::text || '/' || p_step_key || '/' || (v_item ->> 'name')) + 1)
            <> '/' || p_build_id::text || '/' || p_step_key || '/' || (v_item ->> 'name') then
        raise exception 'Invalid photo' using errcode = '22023';
      end if;
      v_entry := jsonb_set(
        v_entry, '{photos}',
        (v_entry -> 'photos') || jsonb_build_array(
          jsonb_build_object('url', v_item -> 'url', 'name', v_item -> 'name')));
    end loop;

  when 'remove_photo' then
    if jsonb_typeof(p_change -> 'name') is distinct from 'string' then
      raise exception 'name must be text' using errcode = '22023';
    end if;
    v_entry := jsonb_set(v_entry, '{photos}', coalesce((
      select jsonb_agg(p.value order by p.ord)
        from jsonb_array_elements(v_entry -> 'photos') with ordinality as p (value, ord)
       where p.value ->> 'name' is distinct from p_change ->> 'name'
    ), '[]'::jsonb));

  when 'add_measurement' then
    v_item := p_change -> 'measurement';
    v_spectrum := v_item -> 'spectrum';
    v_text := btrim(v_item ->> 'description');
    if jsonb_typeof(v_item) is distinct from 'object'
       or jsonb_typeof(v_item -> 'id') is distinct from 'string'
       or (v_item ->> 'id') !~ '^[A-Za-z0-9-]{1,64}$'
       or jsonb_typeof(v_item -> 'timestamp') is distinct from 'number'
       or jsonb_typeof(v_item -> 'description') is distinct from 'string'
       or v_text = ''
       or jsonb_typeof(v_item -> 'frequency') is distinct from 'number'
       or (v_item ->> 'frequency')::numeric <= 0
       or jsonb_typeof(v_spectrum) is distinct from 'object'
       or jsonb_typeof(v_spectrum -> 'frequencies') is distinct from 'array'
       or jsonb_typeof(v_spectrum -> 'magnitudes') is distinct from 'array'
       or jsonb_typeof(v_spectrum -> 'magnitudesDb') is distinct from 'array'
       or jsonb_typeof(v_spectrum -> 'sampleRate') is distinct from 'number'
       or jsonb_typeof(v_spectrum -> 'fftSize') is distinct from 'number'
       or jsonb_typeof(v_spectrum -> 'binWidth') is distinct from 'number' then
      raise exception 'Invalid measurement' using errcode = '22023';
    end if;
    v_length := jsonb_array_length(v_spectrum -> 'frequencies');
    if v_length = 0
       or jsonb_array_length(v_spectrum -> 'magnitudes') <> v_length
       or jsonb_array_length(v_spectrum -> 'magnitudesDb') <> v_length
       or jsonb_path_exists(v_spectrum,
            '$.frequencies[*] ? (@.type() != "number" || @ > 2000)')
       or jsonb_path_exists(v_spectrum, '$.magnitudes[*] ? (@.type() != "number")')
       or jsonb_path_exists(v_spectrum, '$.magnitudesDb[*] ? (@.type() != "number")') then
      raise exception 'Invalid spectrum' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_entry -> 'measurements') m
       where m.value ->> 'id' = v_item ->> 'id'
    ) then
      raise exception 'Duplicate measurement' using errcode = '22023';
    end if;
    v_entry := jsonb_set(
      v_entry, '{measurements}',
      (v_entry -> 'measurements') || jsonb_build_array(jsonb_build_object(
        'id', v_item -> 'id',
        'timestamp', v_item -> 'timestamp',
        'description', to_jsonb(v_text),
        'frequency', v_item -> 'frequency',
        'spectrum', jsonb_build_object(
          'frequencies', v_spectrum -> 'frequencies',
          'magnitudes', v_spectrum -> 'magnitudes',
          'magnitudesDb', v_spectrum -> 'magnitudesDb',
          'sampleRate', v_spectrum -> 'sampleRate',
          'fftSize', v_spectrum -> 'fftSize',
          'binWidth', v_spectrum -> 'binWidth'))));

  when 'set_measurement_description' then
    v_text := btrim(p_change ->> 'description');
    if jsonb_typeof(p_change -> 'id') is distinct from 'string'
       or jsonb_typeof(p_change -> 'description') is distinct from 'string'
       or v_text = '' then
      raise exception 'Invalid description' using errcode = '22023';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(v_entry -> 'measurements') m
       where m.value ->> 'id' = p_change ->> 'id'
    ) then
      raise exception 'Measurement not found' using errcode = '22023';
    end if;
    v_entry := jsonb_set(v_entry, '{measurements}', (
      select jsonb_agg(
               case when m.value ->> 'id' = p_change ->> 'id'
                    then jsonb_set(m.value, '{description}', to_jsonb(v_text))
                    else m.value end
               order by m.ord)
        from jsonb_array_elements(v_entry -> 'measurements') with ordinality as m (value, ord)
    ));

  when 'remove_measurement' then
    if jsonb_typeof(p_change -> 'id') is distinct from 'string' then
      raise exception 'id must be text' using errcode = '22023';
    end if;
    v_entry := jsonb_set(v_entry, '{measurements}', coalesce((
      select jsonb_agg(m.value order by m.ord)
        from jsonb_array_elements(v_entry -> 'measurements') with ordinality as m (value, ord)
       where m.value ->> 'id' is distinct from p_change ->> 'id'
    ), '[]'::jsonb));

  else
    raise exception 'Unknown operation' using errcode = '22023';
  end case;

  if v_index is null then
    v_state := v_state || jsonb_build_array(v_entry);
  else
    v_state := jsonb_set(v_state, array[v_index::text], v_entry);
  end if;

  update public.builds
     set sequence_state = v_state
   where id = p_build_id;

  return v_entry;
end;
$$;

comment on function public.update_build_step(uuid, text, jsonb) is
  'Applies one change to one step of one of the caller''s builds (build-sequence).';

revoke execute on function public.update_build_step(uuid, text, jsonb) from public, anon;
grant execute on function public.update_build_step(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Step photos
-- ---------------------------------------------------------------------------

-- Public bucket: anyone with a photo's URL can read it (build-sequence: Step Photo
-- Storage), but there is no anonymous policy, so nobody can list the files. Only
-- images are accepted. No size limit of its own (the project-wide limit applies).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('step-photos', 'step-photos', true, null, array['image/*'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Whether a step-photo object path is <build id>/<step key>/<file> for a build the
-- caller owns. Runs with the caller's rights, so it sees only builds the caller can read.
create function public.is_own_step_photo_path(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(array_length(storage.foldername(p_name), 1), 0) = 2
     and (storage.foldername(p_name))[2] ~ '^[A-Za-z0-9]{1,64}$'
     and exists (
       select 1
         from public.builds b
        where b.id::text = (storage.foldername(p_name))[1]
          and b.owner_id = (select auth.uid())
     );
$$;

revoke execute on function public.is_own_step_photo_path(text) from public, anon;
grant execute on function public.is_own_step_photo_path(text) to authenticated;

create policy "Owners upload step photos"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'step-photos' and (select public.is_own_step_photo_path(name)));

create policy "Owners read their step photo objects"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'step-photos' and (select public.is_own_step_photo_path(name)));

create policy "Owners delete step photos"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'step-photos' and (select public.is_own_step_photo_path(name)));

-- The stored photo files of one of the caller's builds, so they can be removed before
-- the build is deleted (guitar-builds: Delete Build Cascade). Runs with the caller's
-- rights: the storage policies above return nothing for another user's build.
create function public.build_photo_paths(p_build_id uuid)
returns setof text
language sql
stable
set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'step-photos'
     and o.name like p_build_id::text || '/%'
   order by o.name;
$$;

comment on function public.build_photo_paths(uuid) is
  'Object names of the caller''s photo files for one build, for removal before deletion.';

revoke execute on function public.build_photo_paths(uuid) from public, anon;
grant execute on function public.build_photo_paths(uuid) to authenticated;
