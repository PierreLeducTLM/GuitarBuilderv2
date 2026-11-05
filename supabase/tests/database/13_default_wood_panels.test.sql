-- The shared reference panels and "Load Default Panels" (wood-panel-properties: Reference
-- Panel Set, Load Default Panels, Load Default Panels Feedback).
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;
create function tests.authenticate_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
create function tests.reference(p_name text) returns void
language sql as $$
  insert into public.default_wood_panels (name, sample_length_mm, sample_width_mm, sample_thickness_mm,
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

select has_table('public', 'default_wood_panels', 'reference panels have a table');
select ok((select relrowsecurity from pg_class where oid = 'public.default_wood_panels'::regclass), 'row-level security is on');

-- Only administrators change the reference set.
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select lives_ok($$ select tests.reference('Sitka reference') $$, 'an administrator adds a reference panel');
select lives_ok($$ select tests.reference('Cedar reference') $$, 'an administrator adds another');
select results_eq(
  $$ select round(target_thickness_mm::numeric, 2) from public.default_wood_panels where name = 'Sitka reference' $$,
  $$ values (2.77) $$,
  'reference panels carry the generated results'
);

select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select results_eq($$ select count(*)::integer from public.default_wood_panels $$, $$ values (2) $$, 'every user reads the reference set');
select throws_ok($$ select tests.reference('Mine') $$, '42501', null, 'a user cannot add a reference panel');
select results_eq(
  $$ with changed as (update public.default_wood_panels set sample_mass_g = 1 returning 1) select count(*)::integer from changed $$,
  $$ values (0) $$,
  'a user cannot change a reference panel'
);
select results_eq(
  $$ with removed as (delete from public.default_wood_panels returning 1) select count(*)::integer from removed $$,
  $$ values (0) $$,
  'a user cannot delete a reference panel'
);

-- Copying into an empty library.
select is(public.load_default_wood_panels(), 2, 'copying into an empty library returns the number copied');
select results_eq(
  $$ select name, owner_id::text from public.wood_panels order by name $$,
  $$ values ('Cedar reference', 'b0000000-0000-4000-8000-00000000000b'),
            ('Sitka reference', 'b0000000-0000-4000-8000-00000000000b') $$,
  'the copies are the user''s own panels with the reference names'
);
select is(public.load_default_wood_panels(), null, 'a library that is not empty gets no copy');
select results_eq($$ select count(*)::integer from public.wood_panels $$, $$ values (2) $$, 'no second copy is made');

-- Copies are independent of the reference set.
delete from public.wood_panels where name = 'Cedar reference';
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select results_eq($$ select count(*)::integer from public.default_wood_panels $$, $$ values (2) $$, 'deleting a copy keeps the reference panel');

-- An empty reference set.
delete from public.default_wood_panels;
select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
select is(public.load_default_wood_panels(), 0, 'an empty reference set copies nothing');

-- Function settings.
reset role;
select ok(
  (select not p.prosecdef and p.proconfig @> array['search_path=""']
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'load_default_wood_panels'),
  'the copy runs as the caller with an empty search path'
);
select ok(
  has_function_privilege('authenticated', 'public.load_default_wood_panels()', 'execute')
    and not has_function_privilege('anon', 'public.load_default_wood_panels()', 'execute'),
  'signed-in users can copy, anonymous visitors cannot'
);

select * from finish();
rollback;
