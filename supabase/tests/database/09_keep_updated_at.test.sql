-- The legacy import keeps first-version update times (legacy-data-migration: Build
-- Migration, Wood Panel Recalculation): set_updated_at leaves updated_at alone only while
-- the session setting gb.keep_updated_at is 'on', which clients cannot set.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

create schema tests;
grant usage on schema tests to authenticated;
create function tests.authenticate_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
grant execute on all functions in schema tests to authenticated;

delete from auth.users;
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into public.builds (id, owner_id, name, guitar_type, bobo_neck, updated_at)
values ('e0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-00000000000b',
        'Build X', 'steel_string', true, '2025-01-01T00:00:00Z');
insert into public.wood_panels (id, owner_id, name, sample_length_mm, sample_width_mm,
  sample_thickness_mm, sample_mass_g, freq_longitudinal_hz, freq_cross_grain_hz,
  freq_diagonal_hz, plate_length_mm, plate_width_mm, stiffness_parameter, updated_at)
values ('f0000000-0000-4000-8000-00000000000f', 'b0000000-0000-4000-8000-00000000000b',
        'Panel', 602, 283, 3.8, 270, 140, 57, 90, 520, 200, 75, '2025-01-01T00:00:00Z');

-- Without the setting, an explicit write is replaced by the current time.
update public.builds set updated_at = '2024-06-01T00:00:00Z'
 where id = 'e0000000-0000-4000-8000-00000000000e';
select is(
  (select updated_at from public.builds where id = 'e0000000-0000-4000-8000-00000000000e'),
  now(),
  'without the setting, an update moves updated_at to now'
);

-- With the setting, an explicit write is kept, on builds and on wood panels.
set local gb.keep_updated_at = 'on';
update public.builds set updated_at = '2024-06-01T00:00:00Z'
 where id = 'e0000000-0000-4000-8000-00000000000e';
select is(
  (select updated_at from public.builds where id = 'e0000000-0000-4000-8000-00000000000e'),
  '2024-06-01T00:00:00Z'::timestamptz,
  'with gb.keep_updated_at on, a build keeps the written updated_at'
);
update public.wood_panels set updated_at = '2024-06-02T00:00:00Z', name = 'Panel A'
 where id = 'f0000000-0000-4000-8000-00000000000f';
select is(
  (select updated_at from public.wood_panels where id = 'f0000000-0000-4000-8000-00000000000f'),
  '2024-06-02T00:00:00Z'::timestamptz,
  'with gb.keep_updated_at on, a wood panel keeps the written updated_at'
);

-- Any other value, or no value, leaves the normal behavior.
set local gb.keep_updated_at = 'off';
update public.wood_panels set updated_at = '2024-06-03T00:00:00Z'
 where id = 'f0000000-0000-4000-8000-00000000000f';
select is(
  (select updated_at from public.wood_panels where id = 'f0000000-0000-4000-8000-00000000000f'),
  now(),
  'with the setting off, an update moves updated_at to now'
);

-- A client change through update_build_step still moves updated_at (the build still
-- holds the 2024-06-01 time kept above).
reset gb.keep_updated_at;
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'ThicknessBlank',
                                    '{"op": "set_completed", "completed": true}')$$,
  'the owner completes a step'
);
reset role;
select is(
  (select updated_at from public.builds where id = 'e0000000-0000-4000-8000-00000000000e'),
  now(),
  'a step change through update_build_step moves updated_at'
);

select * from finish();
rollback;
