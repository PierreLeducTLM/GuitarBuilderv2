-- Role changes (user-auth: Role Changes Restricted, Administrator Cross-User Access;
-- admin-console: Change Role Operation, Server-Side Administrator Check).
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;
create function tests.authenticate_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Admin A (first account), users B and C.
delete from auth.users;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'admin@example.com');
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into auth.users (id, email) values ('c0000000-0000-4000-8000-00000000000c', 'c@example.com');

-- A regular user cannot promote themselves through any path.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = 'b0000000-0000-4000-8000-00000000000b' $$,
  '42501', null,
  'a user cannot update their own role'
);
select throws_ok(
  $$ update public.profiles set email = 'spoofed@example.com' where id = 'b0000000-0000-4000-8000-00000000000b' $$,
  '42501', null,
  'a user cannot change the email copy on their profile'
);
select throws_ok(
  $$ insert into public.profiles (id, email, role)
     values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com', 'admin')
     on conflict (id) do update set role = 'admin' $$,
  '42501', null,
  'a user cannot upsert their own profile as admin'
);
select throws_ok(
  $$ delete from public.profiles where id = 'b0000000-0000-4000-8000-00000000000b' $$,
  '42501', null,
  'a user cannot delete their profile'
);
select throws_ok(
  $$ select public.admin_set_role('b0000000-0000-4000-8000-00000000000b', 'admin') $$,
  '42501', 'Access denied. Admin privileges required.',
  'a user cannot promote themselves through the role-change operation'
);
select throws_ok(
  $$ select public.admin_set_role('c0000000-0000-4000-8000-00000000000c', 'admin') $$,
  '42501', 'Access denied. Admin privileges required.',
  'a user cannot change another user''s role'
);
select throws_ok(
  $$ select public.admin_set_role('b0000000-0000-4000-8000-00000000000b', 'superuser') $$,
  '42501', 'Access denied. Admin privileges required.',
  'a non-administrator is refused before the role value is checked'
);
reset role;
select is(
  (select role from public.profiles where id = 'b0000000-0000-4000-8000-00000000000b'),
  'user',
  'the user''s role is still user after every attempt'
);

-- An administrator reads but never writes profiles directly.
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = 'c0000000-0000-4000-8000-00000000000c' $$,
  '42501', null,
  'an administrator cannot update another profile directly'
);
select throws_ok(
  $$ delete from public.profiles where id = 'c0000000-0000-4000-8000-00000000000c' $$,
  '42501', null,
  'an administrator cannot delete a profile directly'
);
select throws_ok(
  $$ insert into public.profiles (id, email) values (gen_random_uuid(), 'ghost@example.com') $$,
  '42501', null,
  'an administrator cannot create a profile'
);

-- The role-change operation's own rules.
select throws_ok(
  $$ select public.admin_set_role('a0000000-0000-4000-8000-00000000000a', 'user') $$,
  '42501', 'Cannot change your own role.',
  'an administrator cannot change their own role'
);
select throws_ok(
  $$ select public.admin_set_role('b0000000-0000-4000-8000-00000000000b', 'superuser') $$,
  '22023', 'Invalid role. Must be "user" or "admin".',
  'a role other than user or admin is refused'
);
select throws_ok(
  $$ select public.admin_set_role('b0000000-0000-4000-8000-00000000000b', null) $$,
  '22023', 'Invalid role. Must be "user" or "admin".',
  'a missing role is refused'
);
select throws_ok(
  $$ select public.admin_set_role('d0000000-0000-4000-8000-00000000000d', 'admin') $$,
  'P0002', 'User not found.',
  'an unknown target is reported'
);

-- Promotion and demotion set the role and the last-updated time.
reset role;
update public.profiles set updated_at = '2000-01-01' where id = 'b0000000-0000-4000-8000-00000000000b';
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select is(
  (select role from public.admin_set_role('b0000000-0000-4000-8000-00000000000b', 'admin')),
  'admin',
  'an administrator promotes a user'
);
reset role;
select is(
  (select role from public.profiles where id = 'b0000000-0000-4000-8000-00000000000b'),
  'admin',
  'the promotion is stored'
);
select ok(
  (select updated_at > '2000-01-01' from public.profiles where id = 'b0000000-0000-4000-8000-00000000000b'),
  'the promotion updates the last-updated time'
);

-- The promoted user now has administrator access, and can demote another administrator.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select is(public.is_admin(), true, 'the promoted user is an administrator on their next request');
select is(
  (select role from public.admin_set_role('a0000000-0000-4000-8000-00000000000a', 'user')),
  'user',
  'an administrator demotes another administrator'
);
reset role;
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select is(public.is_admin(), false, 'the demoted administrator loses administrator access');
select throws_ok(
  $$ select public.admin_set_role('a0000000-0000-4000-8000-00000000000a', 'admin') $$,
  '42501', 'Access denied. Admin privileges required.',
  'the demoted administrator cannot promote themselves back'
);
reset role;

select * from finish();
rollback;
