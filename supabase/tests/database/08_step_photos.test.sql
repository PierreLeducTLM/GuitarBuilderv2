-- Step photo files in storage (build-sequence: Step Photo Upload, Step Photo Storage,
-- Step Photo Deletion, Step Data Access; guitar-builds: Delete Build Cascade;
-- build-story-sharing: No Enumeration of Shared Builds).
--
-- The Storage API writes storage.objects as the caller's role, so these statements
-- are what an upload, a list and a delete do. Deletes set storage.allow_delete_query
-- as the Storage API does.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

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

-- Admin A, owner B (build X), user C (build Y).
delete from auth.users;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'admin@example.com');
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into auth.users (id, email) values ('c0000000-0000-4000-8000-00000000000c', 'c@example.com');
insert into public.builds (id, owner_id, name, guitar_type, bobo_neck) values
  ('e0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-00000000000b', 'Build X', 'classical', true),
  ('f0000000-0000-4000-8000-00000000000f', 'c0000000-0000-4000-8000-00000000000c', 'Build Y', 'classical', true);
select set_config('storage.allow_delete_query', 'true', true);

-- Uploading.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values
       ('step-photos', 'e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000000_k3j9x2ab.jpg', 'b0000000-0000-4000-8000-00000000000b'),
       ('step-photos', 'e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000001_aaaa1111.jpg', 'b0000000-0000-4000-8000-00000000000b'),
       ('step-photos', 'e0000000-0000-4000-8000-00000000000e/JoinPanels/1733500000002_bbbb2222.png', 'b0000000-0000-4000-8000-00000000000b') $$,
  'the owner uploads photos into their build''s step folders'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values
       ('step-photos', 'f0000000-0000-4000-8000-00000000000f/TapTestPanels/1733500000003_cccc3333.jpg', 'b0000000-0000-4000-8000-00000000000b') $$,
  '42501', null,
  'a user cannot upload into another user''s build'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values
       ('step-photos', 'e0000000-0000-4000-8000-00000000000e/1733500000004_dddd4444.jpg', 'b0000000-0000-4000-8000-00000000000b') $$,
  '42501', null,
  'a photo must sit in a step folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values
       ('step-photos', 'e0000000-0000-4000-8000-00000000000e/Tap.Test/1733500000005_eeee5555.jpg', 'b0000000-0000-4000-8000-00000000000b') $$,
  '42501', null,
  'the step folder must be a step key'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values
       ('step-photos', 'not-a-build/TapTestPanels/1733500000006_ffff6666.jpg', 'b0000000-0000-4000-8000-00000000000b') $$,
  '42501', null,
  'the first folder must be a build the uploader owns'
);
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id) values
       ('step-photos', 'e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000007_gggg7777.jpg', 'a0000000-0000-4000-8000-00000000000a') $$,
  '42501', null,
  'an administrator cannot upload into another user''s build'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values
       ('step-photos', 'e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000008_hhhh8888.jpg') $$,
  '42501', null,
  'anonymous visitors cannot upload'
);

-- Listing.
select tests.authenticate_as_anon();
select is(
  (select count(*)::int from storage.objects where bucket_id = 'step-photos'),
  0,
  'anonymous visitors cannot list step photos'
);
select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'step-photos'),
  0,
  'another user cannot list the build''s photos'
);
select is(
  (select count(*)::int from public.build_photo_paths('e0000000-0000-4000-8000-00000000000e')),
  0,
  'another user gets no photo paths for the build'
);
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select is(
  (select count(*)::int from public.build_photo_paths('e0000000-0000-4000-8000-00000000000e')),
  0,
  'an administrator gets no photo paths for another user''s build'
);
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select results_eq(
  $$ select * from public.build_photo_paths('e0000000-0000-4000-8000-00000000000e') $$,
  $$ values ('e0000000-0000-4000-8000-00000000000e/JoinPanels/1733500000002_bbbb2222.png'),
            ('e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000000_k3j9x2ab.jpg'),
            ('e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000001_aaaa1111.jpg') $$,
  'the owner gets every photo path of the build'
);

-- Overwriting and deleting.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
update storage.objects set name = 'e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000000_replaced.jpg'
 where name = 'e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000000_k3j9x2ab.jpg';
reset role;
select is(
  (select count(*)::int from storage.objects
    where name = 'e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000000_k3j9x2ab.jpg'),
  1,
  'stored photos cannot be overwritten or renamed'
);

select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
delete from storage.objects where bucket_id = 'step-photos';
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
delete from storage.objects where bucket_id = 'step-photos';
select tests.authenticate_as_anon();
delete from storage.objects where bucket_id = 'step-photos';
reset role;
select is(
  (select count(*)::int from storage.objects where name like 'e0000000-0000-4000-8000-00000000000e/%'),
  3,
  'another user, an administrator and anonymous visitors cannot delete the photos'
);

select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ delete from storage.objects
      where name = 'e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000001_aaaa1111.jpg' $$,
  'the owner deletes a photo file'
);
reset role;
select is(
  (select count(*)::int from storage.objects where name like 'e0000000-0000-4000-8000-00000000000e/%'),
  2,
  'the deleted photo file is gone and the others remain'
);

-- Other buckets are not covered by these rules.
reset role;
insert into storage.buckets (id, name, public) values ('other-bucket', 'other-bucket', false);
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values
       ('other-bucket', 'e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000009_iiii9999.jpg') $$,
  '42501', null,
  'the step-photo rules do not open other buckets'
);

-- Deleting the build row does not leave its files reachable through the build:
-- the app removes them first (build_photo_paths), as the owner, before the row.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ delete from storage.objects
      where name in (select public.build_photo_paths('e0000000-0000-4000-8000-00000000000e')) $$,
  'the owner removes all of a build''s photo files before deleting it'
);

select * from finish();
rollback;
