-- Who can see and change wood panels (wood-panel-properties: Panel Ownership and Access).
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;
create function tests.authenticate_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function tests.authenticate_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end;
$$;
create function tests.panel(p_name text) returns void
language sql as $$
  insert into public.wood_panels (name, sample_length_mm, sample_width_mm, sample_thickness_mm,
    sample_mass_g, freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz,
    plate_length_mm, plate_width_mm)
  values (p_name, 605, 238, 4, 228, 61.6, 105, 38.2, 500, 380);
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Admin A (first account), users B and C.
delete from auth.users;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'admin@example.com');
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into auth.users (id, email) values ('c0000000-0000-4000-8000-00000000000c', 'c@example.com');

-- The owner.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok($$ select tests.panel('Maple #1') $$, 'a user saves a panel');
select results_eq(
  $$ select owner_id::text from public.wood_panels where name = 'Maple #1' $$,
  $$ values ('b0000000-0000-4000-8000-00000000000b') $$,
  'the panel belongs to its creator'
);
select results_eq(
  $$ with changed as (update public.wood_panels set sample_mass_g = 230 where name = 'Maple #1' returning 1)
     select count(*)::integer from changed $$,
  $$ values (1) $$,
  'the owner updates the panel'
);

-- Another user.
select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
select is_empty($$ select 1 from public.wood_panels where name = 'Maple #1' $$, 'another user does not see the panel');
select results_eq(
  $$ with changed as (update public.wood_panels set sample_mass_g = 1 where name = 'Maple #1' returning 1)
     select count(*)::integer from changed $$,
  $$ values (0) $$,
  'another user cannot change the panel'
);
select results_eq(
  $$ with removed as (delete from public.wood_panels where name = 'Maple #1' returning 1)
     select count(*)::integer from removed $$,
  $$ values (0) $$,
  'another user cannot delete the panel'
);
select throws_ok(
  $$ insert into public.wood_panels (owner_id, name, sample_length_mm, sample_width_mm, sample_thickness_mm,
       sample_mass_g, freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz, plate_length_mm, plate_width_mm)
     values ('b0000000-0000-4000-8000-00000000000b', 'Forged', 605, 238, 4, 228, 61.6, 105, 38.2, 500, 380) $$,
  '42501', null, 'nobody saves a panel for someone else'
);

-- Anonymous visitors.
select tests.authenticate_as_anon();
select throws_ok($$ select 1 from public.wood_panels $$, '42501', null, 'anonymous visitors cannot read panels');

-- The administrator.
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select results_eq(
  $$ select count(*)::integer from public.wood_panels where name = 'Maple #1' $$,
  $$ values (1) $$,
  'an administrator reads another user''s panel'
);
select results_eq(
  $$ with changed as (update public.wood_panels set sample_mass_g = 1 where name = 'Maple #1' returning 1)
     select count(*)::integer from changed $$,
  $$ values (0) $$,
  'an administrator cannot change another user''s panel'
);
select results_eq(
  $$ with removed as (delete from public.wood_panels where name = 'Maple #1' returning 1)
     select count(*)::integer from removed $$,
  $$ values (0) $$,
  'an administrator cannot delete another user''s panel'
);
select lives_ok($$ select tests.panel('Admin own') $$, 'an administrator saves their own panel');

-- Deleting and cascading.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select results_eq(
  $$ with removed as (delete from public.wood_panels where name = 'Maple #1' returning 1)
     select count(*)::integer from removed $$,
  $$ values (1) $$,
  'the owner deletes the panel'
);
select lives_ok($$ select tests.panel('Spruce #2') $$, 'the owner saves another panel');
reset role;
delete from auth.users where id = 'b0000000-0000-4000-8000-00000000000b';
select is_empty(
  $$ select 1 from public.wood_panels where name = 'Spruce #2' $$,
  'deleting a user deletes their panels'
);

select * from finish();
rollback;
