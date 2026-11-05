-- The wood panel table: columns, value checks, the generated results snapshot, spectra,
-- timestamps and function settings (wood-panel-properties: Wood Panel Data, Stored Results
-- Snapshot, Tap-Tone Spectrum Storage and the formula requirements).
begin;
create extension if not exists pgtap with schema extensions;

select plan(27);

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;
create function tests.authenticate_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
-- A 662-point tap-tone record (tap-tone-capture: Tap-Tone Spectrum Record).
create function tests.record() returns jsonb
language sql as $$
  select jsonb_build_object(
    'frequencies', (select jsonb_agg((21 + i) * 48000.0 / 32768 order by i) from generate_series(0, 661) i),
    'magnitudes', (select jsonb_agg(0.001 order by i) from generate_series(0, 661) i),
    'magnitudesDb', (select jsonb_agg(-60 order by i) from generate_series(0, 661) i),
    'sampleRate', 48000, 'fftSize', 32768, 'binWidth', 48000.0 / 32768);
$$;
-- Inserts a panel from the ten inputs, as the signed-in user.
create function tests.panel(
  p_name text, l double precision, w double precision, h double precision, m double precision,
  fl double precision, fc double precision, fd double precision,
  a double precision default 500, b double precision default 380, f double precision default 75,
  p_spectra jsonb default '{}'
) returns uuid
language sql as $$
  insert into public.wood_panels (name, sample_length_mm, sample_width_mm, sample_thickness_mm,
    sample_mass_g, freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
    plate_length_mm, plate_width_mm, stiffness_parameter, spectra)
  values (p_name, l, w, h, m, fl, fc, fd, a, b, f, p_spectra)
  returning id;
$$;
grant execute on all functions in schema tests to anon, authenticated;

delete from auth.users;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'admin@example.com');
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');

-- Columns.
select has_table('public', 'wood_panels', 'wood panels have a table');
select col_type_is('public', 'wood_panels', 'sample_length_mm', 'double precision', 'inputs are double precision');
select col_default_is('public', 'wood_panels', 'stiffness_parameter', '75', 'the stiffness parameter defaults to 75');
select col_type_is('public', 'wood_panels', 'spectra', 'jsonb', 'spectra are jsonb');
select has_index('public', 'wood_panels', 'wood_panels_owner_created_idx', 'the library is served by an index');
select has_trigger('public', 'wood_panels', 'wood_panels_set_updated_at', 'updates move updated_at');

-- Generated results: the reference spruce panel and two dataset plates.
select tests.panel('Spruce', 605, 238, 4.0, 228, 61.6, 105.0, 38.2);
select results_eq(
  $$ select round(e_long_gpa::numeric, 2), round(e_cross_gpa::numeric, 2), round(g_lc_gpa::numeric, 2),
            round(target_thickness_mm::numeric, 2), round(estimated_mass_g::numeric, 1)
       from public.wood_panels where name = 'Spruce' $$,
  $$ values (11.84, 0.82, 0.91, 2.77, 157.5) $$,
  'the reference spruce panel gives 11.84, 0.82 and 0.91 GPa, 2.77 mm and 157.5 g'
);
select tests.panel('Engelmann 3', 553, 216, 3.85, 169, 67.8, 93.5, 49.6);
select results_eq(
  $$ select round(e_long_gpa::numeric, 2), round(e_cross_gpa::numeric, 2), round(g_lc_gpa::numeric, 2)
       from public.wood_panels where name = 'Engelmann 3' $$,
  $$ values (10.03, 0.44, 1.06) $$,
  'dataset top plate 3 matches its measured constants'
);
select tests.panel('Rosewood 1', 568, 218, 3.9, 398, 48.5, 129.0, 40.7);
select results_eq(
  $$ select round(e_long_gpa::numeric, 2), round(e_cross_gpa::numeric, 2), round(g_lc_gpa::numeric, 2)
       from public.wood_panels where name = 'Rosewood 1' $$,
  $$ values (12.49, 1.92, 1.67) $$,
  'dataset back plate 1 matches its measured constants'
);
select results_eq(
  $$ select round(estimated_mass_g::numeric, 1) from public.wood_panels
      where name = 'Spruce' $$,
  $$ values (157.5) $$,
  'the estimated mass is generated'
);

-- Value checks.
select throws_ok($$ select tests.panel('   ', 605, 238, 4, 228, 61.6, 105, 38.2) $$, '23514', null, 'a blank name is refused');
select throws_ok($$ select tests.panel('Zero', 0, 238, 4, 228, 61.6, 105, 38.2) $$, '23514', null, 'a zero input is refused');
select throws_ok($$ select tests.panel('Negative', 605, 238, 4, -1, 61.6, 105, 38.2) $$, '23514', null, 'a negative input is refused');
select throws_ok($$ select tests.panel('NaN', 605, 238, 4, 228, 'NaN', 105, 38.2) $$, '23514', null, 'NaN is refused');
select throws_ok($$ select tests.panel('Infinity', 605, 238, 4, 228, 61.6, 'Infinity', 38.2) $$, '23514', null, 'infinity is refused');
select throws_ok($$ select tests.panel('Stiffness', 605, 238, 4, 228, 61.6, 105, 38.2, 500, 380, 0) $$, '23514', null, 'a zero stiffness parameter is refused');

-- Spectra.
select lives_ok(
  $$ select tests.panel('With spectra', 605, 238, 4, 228, 61.6, 105, 38.2, 500, 380, 75,
       jsonb_build_object('longitudinal', tests.record(), 'diagonal', tests.record())) $$,
  'spectra keyed by frequency field are accepted'
);
select throws_ok(
  $$ select tests.panel('Bad key', 605, 238, 4, 228, 61.6, 105, 38.2, 500, 380, 75,
       jsonb_build_object('freqLongitudinal', tests.record())) $$,
  '23514', null, 'a spectrum under another key is refused'
);
select throws_ok(
  $$ select tests.panel('Bad record', 605, 238, 4, 228, 61.6, 105, 38.2, 500, 380, 75,
       jsonb_build_object('crossGrain', tests.record() - 'binWidth')) $$,
  '23514', null, 'a malformed spectrum record is refused'
);
select throws_ok(
  $$ select tests.panel('Array', 605, 238, 4, 228, 61.6, 105, 38.2, 500, 380, 75, '[]') $$,
  '23514', null, 'spectra must be an object'
);

-- Timestamps and protected columns.
reset role;
update public.wood_panels set created_at = '2025-01-01T00:00:00Z', updated_at = '2025-01-01T00:00:00Z'
 where name = 'Spruce';
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
update public.wood_panels set sample_mass_g = 230 where name = 'Spruce';
select results_eq(
  $$ select updated_at > '2025-01-01T00:00:00Z', created_at = '2025-01-01T00:00:00Z'
       from public.wood_panels where name = 'Spruce' $$,
  $$ values (true, true) $$,
  'an update moves updated_at and keeps created_at'
);
select throws_ok(
  $$ update public.wood_panels set e_long_gpa = 1 where name = 'Spruce' $$,
  '428C9', null, 'the results snapshot cannot be written'
);
select throws_ok(
  $$ update public.wood_panels set owner_id = 'a0000000-0000-4000-8000-00000000000a' where name = 'Spruce' $$,
  '42501', null, 'the owner cannot be changed'
);
select throws_ok(
  $$ update public.wood_panels set created_at = now() where name = 'Spruce' $$,
  '42501', null, 'the timestamps cannot be written'
);

-- Function settings.
reset role;
select ok(
  (select bool_and(p.provolatile = 'i' and p.proconfig @> array['search_path=""'])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('wood_density_kg_m3', 'wood_e_long_gpa', 'wood_e_cross_gpa', 'wood_g_lc_gpa',
                        'wood_target_thickness_mm', 'wood_estimated_mass_g', 'wood_panel_spectra_is_valid')),
  'the formula and spectra functions are immutable with an empty search path'
);
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('wood_density_kg_m3', 'wood_e_long_gpa', 'wood_e_cross_gpa', 'wood_g_lc_gpa',
                        'wood_target_thickness_mm', 'wood_estimated_mass_g', 'wood_panel_spectra_is_valid')),
  7,
  'all seven functions exist'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.wood_panels'::regclass),
  'row-level security is on'
);

select * from finish();
rollback;
