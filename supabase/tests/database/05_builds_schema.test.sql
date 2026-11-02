-- Schema, privileges and function settings of builds and step photos (guitar-builds:
-- Persisted Build Attributes; build-story-sharing: No Enumeration of Shared Builds;
-- build-sequence: Step Photo Storage).
begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

-- Table and columns.
select has_table('public', 'builds', 'the builds table exists');
select col_is_pk('public', 'builds', 'id', 'id is the primary key');
select col_type_is('public', 'builds', 'id', 'uuid', 'id is a uuid');
select col_has_default('public', 'builds', 'id', 'id is generated');
select col_not_null('public', 'builds', 'owner_id', 'a build always has an owner');
select fk_ok('public', 'builds', 'owner_id', 'auth', 'users', 'id', 'owner_id references auth.users');
select col_not_null('public', 'builds', 'name', 'name is required');
select col_is_null('public', 'builds', 'guitar_type', 'guitar type may be not set (imported builds)');
select col_not_null('public', 'builds', 'bobo_neck', 'the BOBO choice is required');
select col_type_is('public', 'builds', 'sequence_state', 'jsonb', 'the step state is a JSON document');
select col_default_is('public', 'builds', 'sequence_state', '[]'::jsonb, 'a new build has no step entries');
select col_type_is('public', 'builds', 'share_token', 'uuid', 'the share token is a uuid');
select col_is_unique('public', 'builds', 'share_token', 'share tokens are unique');
select col_default_is('public', 'builds', 'share_enabled', 'false', 'sharing is off by default');
select col_type_is('public', 'builds', 'created_at', 'timestamp with time zone', 'created_at has a time zone');
select col_type_is('public', 'builds', 'updated_at', 'timestamp with time zone', 'updated_at has a time zone');
select has_index('public', 'builds', 'builds_owner_created_idx', 'the list is served by an index');
select has_trigger('public', 'builds', 'builds_set_updated_at', 'updates move updated_at');

-- Row-level security and privileges.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.builds'::regclass),
  'row-level security is enabled on builds'
);
select ok(not has_table_privilege('anon', 'public.builds', 'select'), 'anonymous clients cannot read builds');
select ok(not has_table_privilege('anon', 'public.builds', 'insert, update, delete'), 'anonymous clients cannot write builds');
select ok(
  not has_column_privilege('authenticated', 'public.builds', 'share_token', 'select'),
  'no signed-in user can read a share token'
);
select ok(
  has_column_privilege('authenticated', 'public.builds', 'sequence_state', 'select'),
  'signed-in users can read the step state (of builds the policies show them)'
);
select ok(
  has_column_privilege('authenticated', 'public.builds', 'name', 'insert')
    and has_column_privilege('authenticated', 'public.builds', 'guitar_type', 'insert')
    and has_column_privilege('authenticated', 'public.builds', 'bobo_neck', 'insert'),
  'a new build is created from its name, guitar type and BOBO choice'
);
select ok(
  not has_column_privilege('authenticated', 'public.builds', 'owner_id', 'insert')
    and not has_column_privilege('authenticated', 'public.builds', 'sequence_state', 'insert')
    and not has_column_privilege('authenticated', 'public.builds', 'share_token', 'insert')
    and not has_column_privilege('authenticated', 'public.builds', 'share_enabled', 'insert'),
  'clients cannot choose the owner, step state or share state of a new build'
);
select ok(
  has_column_privilege('authenticated', 'public.builds', 'guitar_type', 'update')
    and has_column_privilege('authenticated', 'public.builds', 'bobo_neck', 'update'),
  'the construction variant can be changed'
);
select ok(
  not has_column_privilege('authenticated', 'public.builds', 'name', 'update')
    and not has_column_privilege('authenticated', 'public.builds', 'owner_id', 'update')
    and not has_column_privilege('authenticated', 'public.builds', 'sequence_state', 'update')
    and not has_column_privilege('authenticated', 'public.builds', 'share_token', 'update')
    and not has_column_privilege('authenticated', 'public.builds', 'share_enabled', 'update')
    and not has_column_privilege('authenticated', 'public.builds', 'created_at', 'update'),
  'nothing else of a build can be changed directly'
);

-- Functions: settings and who may call them.
select is(
  (select prosecdef from pg_proc where oid = 'public.update_build_step(uuid, text, jsonb)'::regprocedure),
  true,
  'update_build_step runs with definer rights'
);
select is(
  (select proconfig from pg_proc where oid = 'public.update_build_step(uuid, text, jsonb)'::regprocedure),
  array['search_path=""'],
  'update_build_step has a fixed, empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.update_build_step(uuid, text, jsonb)', 'execute'),
  'anonymous clients cannot call update_build_step'
);
select ok(
  has_function_privilege('authenticated', 'public.update_build_step(uuid, text, jsonb)', 'execute'),
  'signed-in users can call update_build_step'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.build_photo_paths(uuid)'::regprocedure),
  false,
  'build_photo_paths runs with the caller''s rights'
);
select ok(
  not has_function_privilege('anon', 'public.build_photo_paths(uuid)', 'execute'),
  'anonymous clients cannot call build_photo_paths'
);
select is(
  (select prosecdef from pg_proc where oid = 'public.is_own_step_photo_path(text)'::regprocedure),
  false,
  'is_own_step_photo_path runs with the caller''s rights'
);
select ok(
  not has_function_privilege('anon', 'public.is_own_step_photo_path(text)', 'execute'),
  'anonymous clients cannot call is_own_step_photo_path'
);
select ok(
  not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'),
  'the updated_at trigger function is not callable by clients'
);

-- The step-photo bucket.
select is(
  (select public from storage.buckets where id = 'step-photos'),
  true,
  'step photos are served publicly by URL'
);
select is(
  (select allowed_mime_types from storage.buckets where id = 'step-photos'),
  array['image/*'],
  'the step-photo bucket accepts only images'
);
select is(
  (select file_size_limit from storage.buckets where id = 'step-photos'),
  null,
  'the step-photo bucket sets no size limit of its own'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname ilike '%step photo%'
      and 'anon' = any (roles)),
  0,
  'no storage policy applies to anonymous clients, so nobody lists the photos'
);
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname ilike '%step photo%'
      and cmd = 'UPDATE'),
  0,
  'no policy lets anyone overwrite a stored photo'
);

select * from finish();
rollback;
