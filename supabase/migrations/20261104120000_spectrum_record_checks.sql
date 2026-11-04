-- Server checks for tap-tone spectrum records and body roles (tap-tone-capture:
-- Spectrum Record Validation; build-sequence: Step Measurement Record). Every table
-- that stores a record calls spectrum_record_is_valid, so the rules live in one place.

-- A Tap-Tone Spectrum Record: three numeric lists of 1 to 1024 equal-length entries,
-- strictly ascending frequencies in (0, 2000] Hz, non-negative magnitudes, a positive
-- sample rate, a power-of-two FFT size up to 32768 and binWidth = sampleRate / fftSize.
create function public.spectrum_record_is_valid(p_record jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_length integer;
  v_sample_rate numeric;
  v_fft_size numeric;
  v_bin_width numeric;
begin
  if jsonb_typeof(p_record) is distinct from 'object'
     or jsonb_typeof(p_record -> 'frequencies') is distinct from 'array'
     or jsonb_typeof(p_record -> 'magnitudes') is distinct from 'array'
     or jsonb_typeof(p_record -> 'magnitudesDb') is distinct from 'array'
     or jsonb_typeof(p_record -> 'sampleRate') is distinct from 'number'
     or jsonb_typeof(p_record -> 'fftSize') is distinct from 'number'
     or jsonb_typeof(p_record -> 'binWidth') is distinct from 'number' then
    return false;
  end if;
  v_length := jsonb_array_length(p_record -> 'frequencies');
  if v_length < 1 or v_length > 1024
     or jsonb_array_length(p_record -> 'magnitudes') <> v_length
     or jsonb_array_length(p_record -> 'magnitudesDb') <> v_length
     or jsonb_path_exists(p_record, '$.frequencies[*] ? (@.type() != "number")')
     or jsonb_path_exists(p_record, '$.magnitudes[*] ? (@.type() != "number")')
     or jsonb_path_exists(p_record, '$.magnitudesDb[*] ? (@.type() != "number")') then
    return false;
  end if;
  if jsonb_path_exists(p_record, '$.frequencies[*] ? (@ <= 0 || @ > 2000)')
     or jsonb_path_exists(p_record, '$.magnitudes[*] ? (@ < 0)')
     or exists (
       select 1
         from jsonb_array_elements(p_record -> 'frequencies') with ordinality as f (value, ord)
         join jsonb_array_elements(p_record -> 'frequencies') with ordinality as g (value, ord)
           on g.ord = f.ord + 1
        where (g.value)::numeric <= (f.value)::numeric) then
    return false;
  end if;
  v_sample_rate := (p_record ->> 'sampleRate')::numeric;
  v_fft_size := (p_record ->> 'fftSize')::numeric;
  v_bin_width := (p_record ->> 'binWidth')::numeric;
  return v_sample_rate > 0
     and v_fft_size in (select 2 ^ e from generate_series(0, 15) as e)
     and abs(v_bin_width - v_sample_rate / v_fft_size) <= 1e-9 * v_bin_width;
end;
$$;

comment on function public.spectrum_record_is_valid(jsonb) is
  'True when the value is a well-formed Tap-Tone Spectrum Record (tap-tone-capture).';

-- Optional body roles of a step measurement: null, or an object whose keys are among
-- air, top and back, each {frequency 30..1000 Hz, level, spectralQ and decayQ (null
-- or > 0), origin auto | user} with no other field.
create function public.measurement_roles_are_valid(p_roles jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_roles is null or (
    jsonb_typeof(p_roles) = 'object'
    and not exists (
      select 1
        from jsonb_each(p_roles) as r (key, value)
       where r.key not in ('air', 'top', 'back')
          or jsonb_typeof(r.value) is distinct from 'object'
          or (select array_agg(k order by k) from jsonb_object_keys(r.value) as k)
             is distinct from array['decayQ', 'frequency', 'level', 'origin', 'spectralQ']
          or jsonb_typeof(r.value -> 'frequency') is distinct from 'number'
          or jsonb_typeof(r.value -> 'level') is distinct from 'number'
          or jsonb_typeof(r.value -> 'spectralQ') not in ('number', 'null')
          or jsonb_typeof(r.value -> 'decayQ') not in ('number', 'null')
          or (r.value ->> 'origin') is distinct from 'auto' and (r.value ->> 'origin') is distinct from 'user'
          or jsonb_path_exists(r.value, '$ ? (@.frequency < 30 || @.frequency > 1000 || @.spectralQ <= 0 || @.decayQ <= 0)')
    )
  );
$$;

comment on function public.measurement_roles_are_valid(jsonb) is
  'True when the value is absent or well-formed body roles of a step measurement (build-sequence).';

revoke execute on function public.spectrum_record_is_valid(jsonb) from public, anon;
revoke execute on function public.measurement_roles_are_valid(jsonb) from public, anon;
grant execute on function public.spectrum_record_is_valid(jsonb) to authenticated, service_role;
grant execute on function public.measurement_roles_are_valid(jsonb) to authenticated, service_role;

-- update_build_step: add_measurement now uses both checks and keeps the roles,
-- copied field by field so that no unchecked key is stored. Same signature and grants.
create or replace function public.update_build_step(p_build_id uuid, p_step_key text, p_change jsonb)
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
       or not public.measurement_roles_are_valid(v_item -> 'roles') then
      raise exception 'Invalid measurement' using errcode = '22023';
    end if;
    if not public.spectrum_record_is_valid(v_spectrum) then
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
          'binWidth', v_spectrum -> 'binWidth'))
        || case when jsonb_typeof(v_item -> 'roles') = 'object' then jsonb_build_object('roles', (
             select coalesce(jsonb_object_agg(r.key, jsonb_build_object(
                      'frequency', r.value -> 'frequency',
                      'level', r.value -> 'level',
                      'spectralQ', r.value -> 'spectralQ',
                      'decayQ', r.value -> 'decayQ',
                      'origin', r.value -> 'origin')), '{}'::jsonb)
               from jsonb_each(v_item -> 'roles') r))
           else '{}'::jsonb end));

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
