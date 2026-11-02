-- Who can create, read, change and delete builds (guitar-builds: Create Build
-- Submission, New Build Defaults, Build Ownership, Administrator Access to Builds,
-- Persisted Build Attributes; build-story-sharing: No Enumeration of Shared Builds).
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

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

-- Admin A (first account), users B and C.
delete from auth.users;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'admin@example.com');
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into auth.users (id, email) values ('c0000000-0000-4000-8000-00000000000c', 'c@example.com');

-- Creating builds.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ insert into public.builds (name, guitar_type, bobo_neck)
     values ('Test Guitar #1', 'steel_string', true) $$,
  'a user creates a build from its name, guitar type and BOBO choice'
);
select results_eq(
  $$ select owner_id::text, name, guitar_type, bobo_neck, share_enabled, sequence_state,
            created_at = updated_at
       from public.builds where name = 'Test Guitar #1' $$,
  $$ values ('b0000000-0000-4000-8000-00000000000b', 'Test Guitar #1', 'steel_string', true,
             false, '[]'::jsonb, true) $$,
  'the new build is owned by its creator, unshared, untouched and created = updated'
);
select lives_ok(
  $$ insert into public.builds (name, guitar_type, bobo_neck) values ('Test Guitar #1', 'classical', false) $$,
  'build names do not have to be unique'
);
select throws_ok(
  $$ insert into public.builds (name, guitar_type, bobo_neck) values ('   ', 'classical', true) $$,
  '23514', null,
  'a whitespace-only name is refused'
);
select throws_ok(
  $$ insert into public.builds (name, bobo_neck) values ('No type', true) $$,
  '42501', null,
  'a new build needs a guitar type'
);
select throws_ok(
  $$ insert into public.builds (name, guitar_type, bobo_neck) values ('Odd', 'electric', true) $$,
  '23514', null,
  'the guitar type is classical or steel-string'
);
select throws_ok(
  $$ insert into public.builds (owner_id, name, guitar_type, bobo_neck)
     values ('c0000000-0000-4000-8000-00000000000c', 'Planted', 'classical', true) $$,
  '42501', null,
  'a user cannot create a build owned by someone else'
);
select throws_ok(
  $$ insert into public.builds (name, guitar_type, bobo_neck, share_enabled)
     values ('Shared at birth', 'classical', true, true) $$,
  '42501', null,
  'a new build cannot be created shared'
);

-- Keep B's first build at hand, and give C a build too.
reset role;
create temporary table ids on commit drop as
  select id from public.builds where name = 'Test Guitar #1' and guitar_type = 'steel_string';
grant select on ids to authenticated, anon;
insert into public.builds (owner_id, name, guitar_type, bobo_neck, share_enabled, share_token)
values ('c0000000-0000-4000-8000-00000000000c', 'C shared build', 'classical', true, true,
        'dddddddd-0000-4000-8000-00000000000d');

-- Reading.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select results_eq(
  $$ select name from public.builds order by guitar_type $$,
  $$ values ('Test Guitar #1'), ('Test Guitar #1') $$,
  'a user sees only their own builds, not another user''s shared build'
);
select throws_ok(
  $$ select share_token from public.builds $$,
  '42501', null,
  'a user cannot read share tokens, even of their own builds'
);
select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
select is(
  (select count(*)::int from public.builds where id in (select id from ids)),
  0,
  'another user cannot read the build'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select id from public.builds $$,
  '42501', null,
  'anonymous visitors cannot read builds'
);
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select is(
  (select count(*)::int from public.builds),
  3,
  'an administrator can read every build'
);
select throws_ok(
  $$ select share_token from public.builds $$,
  '42501', null,
  'an administrator cannot read share tokens'
);

-- Changing: only the owner, and only the construction variant.
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
update public.builds set guitar_type = 'classical' where id in (select id from ids);
select is(
  (select guitar_type from public.builds where id in (select id from ids)),
  'steel_string',
  'an administrator cannot change another user''s build'
);
delete from public.builds where id in (select id from ids);
select is(
  (select count(*)::int from public.builds where id in (select id from ids)),
  1,
  'an administrator cannot delete another user''s build'
);
select throws_ok(
  $$ insert into public.builds (owner_id, name, guitar_type, bobo_neck)
     values ('b0000000-0000-4000-8000-00000000000b', 'Admin planted', 'classical', true) $$,
  '42501', null,
  'an administrator cannot create a build for another user'
);

select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
update public.builds set guitar_type = 'classical' where id in (select id from ids);
delete from public.builds where id in (select id from ids);
reset role;
select is(
  (select guitar_type from public.builds where id in (select id from ids)),
  'steel_string',
  'another user can neither change nor delete the build'
);

select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select throws_ok(
  $$ update public.builds set name = 'Renamed' where id in (select id from ids) $$,
  '42501', null,
  'the owner cannot rename a build directly'
);
select throws_ok(
  $$ update public.builds set sequence_state = '[{"key": "Neck", "completed": true}]' where id in (select id from ids) $$,
  '42501', null,
  'the owner cannot overwrite the step state directly'
);
select throws_ok(
  $$ update public.builds set share_enabled = true where id in (select id from ids) $$,
  '42501', null,
  'the owner cannot turn sharing on directly'
);
select throws_ok(
  $$ update public.builds set owner_id = 'c0000000-0000-4000-8000-00000000000c' where id in (select id from ids) $$,
  '42501', null,
  'the owner cannot give a build away'
);
select throws_ok(
  $$ update public.builds set guitar_type = null where id in (select id from ids) $$,
  '42501', null,
  'the owner cannot set the guitar type back to not set'
);

reset role;
update public.builds set updated_at = '2025-01-01T00:00:00Z' where id in (select id from ids);
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ update public.builds set guitar_type = 'classical', bobo_neck = false where id in (select id from ids) $$,
  'the owner changes the construction variant'
);
select results_eq(
  $$ select guitar_type, bobo_neck, updated_at > '2025-01-01T00:00:00Z'
       from public.builds where id in (select id from ids) $$,
  $$ values ('classical', false, true) $$,
  'the variant is changed and updated_at moved'
);

-- An imported build without a guitar type can be given one.
reset role;
update public.builds set guitar_type = null where id in (select id from ids);
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ update public.builds set guitar_type = 'steel_string' where id in (select id from ids) $$,
  'the owner chooses a guitar type for a build whose type is not set'
);

-- Deleting.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ delete from public.builds where id in (select id from ids) $$,
  'the owner deletes their build'
);
reset role;
select is(
  (select count(*)::int from public.builds where id in (select id from ids)),
  0,
  'the deleted build is gone'
);

-- Deleting an account deletes its builds.
delete from auth.users where id = 'c0000000-0000-4000-8000-00000000000c';
select is(
  (select count(*)::int from public.builds where owner_id = 'c0000000-0000-4000-8000-00000000000c'),
  0,
  'deleting a user deletes every build they own'
);
select is(
  (select count(*)::int from public.builds where share_token = 'dddddddd-0000-4000-8000-00000000000d'),
  0,
  'the share token of a deleted build no longer exists'
);
select is(
  (select count(*)::int from public.builds where owner_id = 'b0000000-0000-4000-8000-00000000000b'),
  1,
  'other users'' builds are kept'
);

-- Service role (server-side jobs such as the legacy import) can read builds.
select ok(has_table_privilege('service_role', 'public.builds', 'select'), 'the service role can read builds');

select * from finish();
rollback;
