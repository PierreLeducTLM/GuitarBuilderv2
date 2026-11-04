-- Server checks of tap-tone spectrum records and body roles (tap-tone-capture:
-- Spectrum Record Validation; build-sequence: Step Measurement Record).
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;
create function tests.authenticate_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
-- A 48 kHz record of n points on the grid k * sampleRate / fftSize, starting at bin first.
create function tests.record(n integer, first integer default 21, fft integer default 32768) returns jsonb
language sql as $$
  select jsonb_build_object(
    'frequencies', (select jsonb_agg((first + i) * 48000.0 / fft order by i) from generate_series(0, n - 1) i),
    'magnitudes', (select jsonb_agg(0.001 order by i) from generate_series(0, n - 1) i),
    'magnitudesDb', (select jsonb_agg(-60 order by i) from generate_series(0, n - 1) i),
    'sampleRate', 48000, 'fftSize', fft, 'binWidth', 48000.0 / fft);
$$;
create function tests.role(frequency numeric default 196.94) returns jsonb
language sql as $$
  select jsonb_build_object('frequency', frequency, 'level', -21.3, 'spectralQ', 31.2,
                            'decayQ', null, 'origin', 'auto');
$$;
create function tests.measurement(id text, spectrum jsonb, roles jsonb default null) returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', id, 'timestamp', 1762257600000, 'description', 'Box closed', 'frequency', 196.94,
    'spectrum', spectrum)
    || case when roles is null then '{}'::jsonb else jsonb_build_object('roles', roles) end;
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Valid records.
select ok(public.spectrum_record_is_valid(tests.record(662)), 'a 662-point 48 kHz record is valid');
select ok(public.spectrum_record_is_valid(tests.record(331, 11, 16384)), 'an older 331-point 16384-point record is valid');
select ok(public.spectrum_record_is_valid(tests.record(1024, 1)), '1024 points are allowed');

-- Shape rules.
select ok(not public.spectrum_record_is_valid(tests.record(1025, 1)), '1025 points are refused');
select ok(not public.spectrum_record_is_valid(
  jsonb_set(tests.record(3), '{frequencies}', '[]') || '{"magnitudes": [], "magnitudesDb": []}'), 'an empty record is refused');
select ok(not public.spectrum_record_is_valid(jsonb_set(tests.record(3), '{magnitudes}', '[0.1, 0.2]')), 'lists of different lengths are refused');
select ok(not public.spectrum_record_is_valid(jsonb_set(tests.record(3), '{magnitudesDb}', '[-60, -60]')), 'a short dB list is refused');
select ok(not public.spectrum_record_is_valid(jsonb_set(tests.record(3), '{frequencies}', '[40, 30, 50]')), 'unsorted frequencies are refused');
select ok(not public.spectrum_record_is_valid(jsonb_set(tests.record(3), '{frequencies}', '[30, 30, 50]')), 'repeated frequencies are refused');
select ok(not public.spectrum_record_is_valid(jsonb_set(tests.record(3), '{frequencies}', '[0, 30, 50]')), 'a 0 Hz frequency is refused');
select ok(not public.spectrum_record_is_valid(jsonb_set(tests.record(3), '{frequencies}', '[30, 50, 2000.5]')), 'a frequency above 2000 Hz is refused');
select ok(public.spectrum_record_is_valid(jsonb_set(tests.record(3), '{frequencies}', '[30, 50, 2000]')), '2000 Hz itself is allowed');
select ok(not public.spectrum_record_is_valid(jsonb_set(tests.record(3), '{magnitudes}', '[0.1, -0.1, 0.1]')), 'a negative magnitude is refused');
select ok(not public.spectrum_record_is_valid(jsonb_set(tests.record(3), '{magnitudesDb}', '[-60, "loud", -60]')), 'a non-numeric entry is refused');
select ok(not public.spectrum_record_is_valid(jsonb_set(tests.record(3), '{frequencies}', '[30, "50", 60]')), 'a non-numeric frequency is refused');
select ok(not public.spectrum_record_is_valid(tests.record(3) || '{"fftSize": 3, "binWidth": 16000}'), 'fftSize 3 is refused');
select ok(not public.spectrum_record_is_valid(tests.record(3) || '{"fftSize": 65536, "binWidth": 0.732421875}'), 'fftSize 65536 is refused');
select ok(not public.spectrum_record_is_valid(tests.record(3) || '{"fftSize": "32768"}'), 'a text fftSize is refused');
select ok(not public.spectrum_record_is_valid(tests.record(3) || '{"binWidth": 1.465}'), 'a wrong bin width is refused');
select ok(not public.spectrum_record_is_valid(tests.record(3) || '{"sampleRate": 0, "binWidth": 0}'), 'a zero sample rate is refused');
select ok(not public.spectrum_record_is_valid(tests.record(3) - 'magnitudesDb'), 'a missing list is refused');
select ok(not public.spectrum_record_is_valid('[1, 2, 3]'), 'a non-object is refused');

-- Body roles.
select ok(public.measurement_roles_are_valid(null), 'no roles are valid');
select ok(public.measurement_roles_are_valid('{}'), 'empty roles are valid');
select ok(public.measurement_roles_are_valid(jsonb_build_object(
  'air', tests.role(98.41), 'top', tests.role(196.94) || '{"decayQ": 71.8, "origin": "user"}',
  'back', tests.role(247.5))), 'Air, Top and Back are valid');
select ok(public.measurement_roles_are_valid(jsonb_build_object('air', tests.role(30), 'back', tests.role(1000))), 'roles at exactly 30 and 1000 Hz are valid');
select ok(not public.measurement_roles_are_valid(jsonb_build_object('side', tests.role())), 'an unknown role is refused');
select ok(not public.measurement_roles_are_valid(jsonb_build_object('top', tests.role(1500))), 'a role above 1000 Hz is refused');
select ok(not public.measurement_roles_are_valid(jsonb_build_object('air', tests.role(29.9))), 'a role below 30 Hz is refused');
select ok(not public.measurement_roles_are_valid(jsonb_build_object('top', tests.role() || '{"spectralQ": 0}')), 'a zero spectral Q is refused');
select ok(not public.measurement_roles_are_valid(jsonb_build_object('top', tests.role() || '{"decayQ": -2}')), 'a negative decay Q is refused');
select ok(not public.measurement_roles_are_valid(jsonb_build_object('top', tests.role() || '{"origin": "guess"}')), 'an unknown origin is refused');
select ok(not public.measurement_roles_are_valid(jsonb_build_object('top', tests.role() || '{"note": "x"}')), 'an extra role field is refused');
select ok(not public.measurement_roles_are_valid(jsonb_build_object('top', tests.role() - 'level')), 'a role without a level is refused');
select ok(not public.measurement_roles_are_valid(jsonb_build_object('top', tests.role() || '{"level": "-20"}')), 'a text level is refused');
select ok(not public.measurement_roles_are_valid('[]'), 'roles must be an object');

-- Function settings and grants.
select ok(exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('spectrum_record_is_valid', 'measurement_roles_are_valid')
     and p.provolatile = 'i' and p.proconfig @> array['search_path=""']
  having count(*) = 2), 'both checks are immutable with an empty search path');
select function_privs_are('public', 'spectrum_record_is_valid', array['jsonb']::name[], 'anon', array[]::text[], 'anon cannot call the record check');
select function_privs_are('public', 'spectrum_record_is_valid', array['jsonb']::name[], 'authenticated', array['EXECUTE'], 'signed-in users can call the record check');

-- update_build_step uses both checks.
delete from auth.users;
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into public.builds (id, owner_id, name, guitar_type, bobo_neck)
values ('e0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-00000000000b',
        'Build X', 'steel_string', true);
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');

select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'BoxClosed',
    jsonb_build_object('op', 'add_measurement', 'measurement', tests.measurement('m1', tests.record(662),
      jsonb_build_object('air', tests.role(98.41), 'top', tests.role())))) #> '{measurements,0,roles}',
  jsonb_build_object('air', tests.role(98.41), 'top', tests.role()),
  'a measurement with roles is stored with them'
);
select ok(
  not ((public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'BoxOpen',
    jsonb_build_object('op', 'add_measurement', 'measurement', tests.measurement('m2', tests.record(331, 11, 16384))))
    #> '{measurements,0}') ? 'roles'),
  'a measurement without roles is stored without them'
);
select throws_ok(
  format('select public.update_build_step(%L, %L, %L)', 'e0000000-0000-4000-8000-00000000000e', 'BoxClosed',
    jsonb_build_object('op', 'add_measurement', 'measurement', tests.measurement('m3', tests.record(1025, 1)))),
  '22023', 'Invalid spectrum', 'an oversized record is refused'
);
select throws_ok(
  format('select public.update_build_step(%L, %L, %L)', 'e0000000-0000-4000-8000-00000000000e', 'BoxClosed',
    jsonb_build_object('op', 'add_measurement', 'measurement',
      tests.measurement('m4', tests.record(662), jsonb_build_object('side', tests.role())))),
  '22023', 'Invalid measurement', 'invalid roles are refused'
);
select is(
  (select jsonb_array_length(e -> 'measurements')
     from public.builds b, jsonb_array_elements(b.sequence_state) e
    where b.id = 'e0000000-0000-4000-8000-00000000000e' and e ->> 'key' = 'BoxClosed'),
  1,
  'refused changes leave the step with its earlier measurement'
);

select * from finish();
rollback;
