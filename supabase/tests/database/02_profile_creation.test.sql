-- Profile creation at sign-up (user-auth: Automatic Profile Creation, First Account
-- Becomes Administrator, User Profile Data, User Roles).
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

-- Helpers, rolled back with the test.
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;
create function tests.authenticate_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- A fresh installation: no accounts and no profiles.
delete from auth.users;
select is((select count(*)::int from public.profiles), 0, 'no profiles exist before the first sign-up');

-- First account becomes administrator; its email is copied.
insert into auth.users (id, email)
values ('a0000000-0000-4000-8000-000000000001', 'first@example.com');
select results_eq(
  $$ select email, role from public.profiles where id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('first@example.com'::text, 'admin'::text) $$,
  'the first account gets a profile with its email and the role admin'
);

-- Every later account is a regular user.
insert into auth.users (id, email)
values ('b0000000-0000-4000-8000-000000000002', 'second@example.com'),
       ('c0000000-0000-4000-8000-000000000003', 'third@example.com');
select results_eq(
  $$ select role from public.profiles
     where id in ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003') $$,
  $$ values ('user'::text), ('user'::text) $$,
  'later accounts get the role user'
);
select is(
  (select count(*)::int from public.profiles where role = 'admin'),
  1,
  'exactly one administrator exists'
);
select isnt(
  (select created_at from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'),
  null,
  'the profile records its creation time'
);
select isnt(
  (select updated_at from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'),
  null,
  'the profile records its last-updated time'
);

-- The rule is "no other profile exists at the moment it is created", not "first id".
insert into auth.users (id, email)
values ('d0000000-0000-4000-8000-000000000004', 'fourth@example.com');
select is(
  (select role from public.profiles where id = 'd0000000-0000-4000-8000-000000000004'),
  'user',
  'an account created while profiles exist is a user'
);

-- The email copy follows changes to the account email.
update public.profiles set updated_at = '2000-01-01' where id = 'b0000000-0000-4000-8000-000000000002';
update auth.users set email = 'renamed@example.com' where id = 'b0000000-0000-4000-8000-000000000002';
select is(
  (select email from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'),
  'renamed@example.com',
  'an email change is copied to the profile'
);
select ok(
  (select updated_at > '2000-01-01' from public.profiles where id = 'b0000000-0000-4000-8000-000000000002'),
  'an email change updates the profile''s last-updated time'
);

-- A profile is deleted together with its account.
delete from auth.users where id = 'c0000000-0000-4000-8000-000000000003';
select is(
  (select count(*)::int from public.profiles where id = 'c0000000-0000-4000-8000-000000000003'),
  0,
  'deleting the account deletes its profile'
);

-- A failure to create the profile does not prevent the account from being created.
alter table public.profiles add constraint test_reject_broken check (email <> 'broken@example.com');
set local client_min_messages = error;
select lives_ok(
  $$ insert into auth.users (id, email) values ('e0000000-0000-4000-8000-000000000005', 'broken@example.com') $$,
  'account creation succeeds when profile creation fails'
);
reset client_min_messages;
alter table public.profiles drop constraint test_reject_broken;
select is(
  (select count(*)::int from auth.users where id = 'e0000000-0000-4000-8000-000000000005'),
  1,
  'the account exists'
);
select is(
  (select count(*)::int from public.profiles where id = 'e0000000-0000-4000-8000-000000000005'),
  0,
  'the account has no profile'
);

-- Such an account is treated as a regular user and cannot create its own profile.
select tests.authenticate_as('e0000000-0000-4000-8000-000000000005');
select is(public.is_admin(), false, 'an account without a profile is not an administrator');
select is((select count(*)::int from public.profiles), 0, 'an account without a profile reads no profile');
select throws_ok(
  $$ insert into public.profiles (id, email, role)
     values ('e0000000-0000-4000-8000-000000000005', 'broken@example.com', 'admin') $$,
  '42501',
  null,
  'an account without a profile cannot create one (with any role)'
);
reset role;

-- With every account gone, the next sign-up becomes administrator again.
delete from auth.users;
insert into auth.users (id, email)
values ('f0000000-0000-4000-8000-000000000006', 'fresh@example.com');
select is(
  (select role from public.profiles where id = 'f0000000-0000-4000-8000-000000000006'),
  'admin',
  'the first account of an empty installation is administrator'
);

select * from finish();
rollback;
