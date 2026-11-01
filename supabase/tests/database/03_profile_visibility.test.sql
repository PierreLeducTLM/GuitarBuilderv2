-- Who can read which profiles (user-auth: Profile Visibility, Administrator
-- Cross-User Access; admin-console: Server-Side Administrator Check, List All Users
-- Operation).
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

-- Admin A (first account), users B and C, created on distinct days.
delete from auth.users;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'admin@example.com');
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into auth.users (id, email) values ('c0000000-0000-4000-8000-00000000000c', 'c@example.com');
update public.profiles set created_at = '2025-01-10' where id = 'a0000000-0000-4000-8000-00000000000a';
update public.profiles set created_at = '2025-02-01' where id = 'b0000000-0000-4000-8000-00000000000b';
update public.profiles set created_at = '2025-03-02' where id = 'c0000000-0000-4000-8000-00000000000c';

-- A regular user reads only their own profile.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select results_eq(
  $$ select id::text, email, role from public.profiles $$,
  $$ values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com', 'user') $$,
  'a regular user sees only their own profile'
);
select is_empty(
  $$ select 1 from public.profiles where id = 'a0000000-0000-4000-8000-00000000000a' $$,
  'a regular user cannot read another profile by id'
);
select is(public.is_admin(), false, 'is_admin() is false for a regular user');
select throws_ok(
  $$ select * from public.admin_list_users() $$,
  '42501',
  'Access denied. Admin privileges required.',
  'a regular user calling list-all-users directly is refused'
);

-- An administrator reads every profile, and the list operation returns them newest first.
reset role;
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.profiles), 3, 'an administrator reads every profile');
select is(public.is_admin(), true, 'is_admin() is true for an administrator');
select results_eq(
  $$ select email from public.admin_list_users() $$,
  $$ values ('c@example.com'::text), ('b@example.com'::text), ('admin@example.com'::text) $$,
  'list-all-users returns every profile, newest account first'
);
select results_eq(
  $$ select id::text, email, role, created_at, updated_at from public.admin_list_users()
     where id = 'b0000000-0000-4000-8000-00000000000b' $$,
  $$ select id::text, email, role, created_at, updated_at from public.profiles
     where id = 'b0000000-0000-4000-8000-00000000000b' $$,
  'list-all-users returns identifier, email, role, creation and last-updated times'
);

-- A signed-in request without a user id reads nothing.
reset role;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.profiles), 0, 'a token without a user id reads no profile');
select is(public.is_admin(), false, 'a token without a user id is not an administrator');

-- Anonymous visitors get nothing at all.
reset role;
select tests.authenticate_as_anon();
select throws_ok(
  $$ select * from public.profiles $$,
  '42501',
  null,
  'anonymous visitors cannot read profiles'
);
select throws_ok(
  $$ select public.is_admin() $$,
  '42501',
  null,
  'anonymous visitors cannot call is_admin'
);
select throws_ok(
  $$ select * from public.admin_list_users() $$,
  '42501',
  null,
  'anonymous visitors cannot call list-all-users'
);
select throws_ok(
  $$ select public.admin_set_role('b0000000-0000-4000-8000-00000000000b', 'admin') $$,
  '42501',
  null,
  'anonymous visitors cannot call the role-change operation'
);

-- The service role (server-side key) can read but not write.
reset role;
select set_config('role', 'service_role', true);
select is((select count(*)::int from public.profiles), 3, 'the service role reads every profile');
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = 'b0000000-0000-4000-8000-00000000000b' $$,
  '42501',
  null,
  'even the service role cannot change a role directly'
);
reset role;

select * from finish();
rollback;
