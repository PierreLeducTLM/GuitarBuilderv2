-- Step changes through update_build_step (build-sequence: Step Completion Tracking,
-- Step Notes, Step Photo Storage, Step Measurement Record, Step Measurement List,
-- Step Measurement Deletion, Step State Persistence, Step State Loading, Step Data
-- Access; guitar-builds: Persisted Build Attributes, Administrator Access to Builds).
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

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
-- A valid measurement with the given id, description and top frequency.
create function tests.measurement(id text, description text, top numeric default 1999) returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', id, 'timestamp', 1733500000000, 'description', description, 'frequency', 187.4,
    'spectrum', jsonb_build_object(
      'frequencies', jsonb_build_array(32.2265625, 35.15625, top),
      'magnitudes', jsonb_build_array(0.001, 0.002, 0.0005),
      'magnitudesDb', jsonb_build_array(-60, -54, -66),
      'sampleRate', 48000, 'fftSize', 16384, 'binWidth', 2.9296875));
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- Admin A, owner B, other user C; B owns build X.
delete from auth.users;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'admin@example.com');
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into auth.users (id, email) values ('c0000000-0000-4000-8000-00000000000c', 'c@example.com');
insert into public.builds (id, owner_id, name, guitar_type, bobo_neck, updated_at)
values ('e0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-00000000000b',
        'Build X', 'steel_string', true, '2025-01-01T00:00:00Z');

-- Completion and notes.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'ThicknessBlank',
                           '{"op": "set_completed", "completed": true}'),
  '{"key": "ThicknessBlank", "completed": true, "notes": "", "photos": [], "measurements": []}'::jsonb,
  'completing a step creates its entry and returns it'
);
select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'ThicknessBlank',
                           jsonb_build_object('op', 'set_notes', 'notes', E'Used 3 mm\nbrace stock')),
  jsonb_build_object('key', 'ThicknessBlank', 'completed', true, 'notes', E'Used 3 mm\nbrace stock',
                     'photos', '[]'::jsonb, 'measurements', '[]'::jsonb),
  'notes keep line breaks and leave the completion as it was'
);
select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'ThicknessBlank',
                           '{"op": "set_completed", "completed": false}') -> 'notes',
  to_jsonb(E'Used 3 mm\nbrace stock'::text),
  'reopening a step keeps its notes'
);
select is(
  (select updated_at > '2025-01-01T00:00:00Z' from public.builds
    where id = 'e0000000-0000-4000-8000-00000000000e'),
  true,
  'a step change moves the build''s updated_at'
);

-- Photos.
select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
    'op', 'add_photos', 'photos', jsonb_build_array(
      jsonb_build_object('url', 'https://x.supabase.co/storage/v1/object/public/step-photos/e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000000_k3j9x2ab.jpg',
                         'name', '1733500000000_k3j9x2ab.jpg', 'extra', 'dropped'),
      jsonb_build_object('url', 'https://x.supabase.co/storage/v1/object/public/step-photos/e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000001_aaaa1111.png',
                         'name', '1733500000001_aaaa1111.png')))) -> 'photos',
  jsonb_build_array(
    jsonb_build_object('url', 'https://x.supabase.co/storage/v1/object/public/step-photos/e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000000_k3j9x2ab.jpg',
                       'name', '1733500000000_k3j9x2ab.jpg'),
    jsonb_build_object('url', 'https://x.supabase.co/storage/v1/object/public/step-photos/e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000001_aaaa1111.png',
                       'name', '1733500000001_aaaa1111.png')),
  'photos are appended in the given order with only their URL and name'
);
select is(
  jsonb_array_length(public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
    'op', 'add_photos', 'photos', jsonb_build_array(
      jsonb_build_object('url', 'https://x.supabase.co/storage/v1/object/public/step-photos/e0000000-0000-4000-8000-00000000000e/TapTestPanels/1733500000002_bbbb2222.jpg',
                         'name', '1733500000002_bbbb2222.jpg')))) -> 'photos'),
  3,
  'new photos are added after the existing ones'
);
select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels',
                           '{"op": "remove_photo", "name": "1733500000001_aaaa1111.png"}') -> 'photos' -> 1 ->> 'name',
  '1733500000002_bbbb2222.jpg',
  'removing the second of three photos keeps the first and third in order'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
       'op', 'add_photos', 'photos', jsonb_build_array(jsonb_build_object(
         'url', 'https://x.supabase.co/storage/v1/object/public/step-photos/e0000000-0000-4000-8000-00000000000e/OtherStep/1_abc.jpg',
         'name', '1_abc.jpg')))) $$,
  '22023', 'Invalid photo',
  'a photo URL must point into this build''s step folder'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
       'op', 'add_photos', 'photos', jsonb_build_array(jsonb_build_object(
         'url', 'https://x/e0000000-0000-4000-8000-00000000000e/TapTestPanels/../evil.html',
         'name', '../evil.html')))) $$,
  '22023', 'Invalid photo',
  'a photo name must be a generated file name'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels',
                                     '{"op": "add_photos", "photos": []}') $$,
  '22023', null,
  'adding no photos is refused'
);

-- Measurements.
select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
    'op', 'add_measurement', 'measurement', tests.measurement('m-1', '  Back plate free  '))) -> 'measurements' -> 0 ->> 'description',
  'Back plate free',
  'a measurement is stored with its trimmed description'
);
select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
    'op', 'add_measurement', 'measurement', tests.measurement('m-2', 'Resonance Analysis', 2000))) -> 'measurements' -> 1 -> 'spectrum' -> 'binWidth',
  '2.9296875'::jsonb,
  'measurements are listed in the order they were added, with their spectrum'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
       'op', 'add_measurement', 'measurement', tests.measurement('m-3', 'Too high', 2000.5))) $$,
  '22023', 'Invalid spectrum',
  'a spectrum may not go above 2000 Hz'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
       'op', 'add_measurement', 'measurement',
       jsonb_set(tests.measurement('m-3', 'Short'), '{spectrum,magnitudesDb}', '[-60, -54]'))) $$,
  '22023', 'Invalid spectrum',
  'the frequency, magnitude and dB lists must have the same length'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
       'op', 'add_measurement', 'measurement', tests.measurement('m-3', '   '))) $$,
  '22023', 'Invalid measurement',
  'a measurement needs a description'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
       'op', 'add_measurement', 'measurement', tests.measurement('m-3', 'No spectrum') - 'spectrum')) $$,
  '22023', 'Invalid measurement',
  'a capture without a spectrum is not attached'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels', jsonb_build_object(
       'op', 'add_measurement', 'measurement', tests.measurement('m-1', 'Again'))) $$,
  '22023', 'Duplicate measurement',
  'measurement identifiers are unique within a step'
);
select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels',
    '{"op": "set_measurement_description", "id": "m-2", "description": " Top after bracing "}') -> 'measurements' -> 1 ->> 'description',
  'Top after bracing',
  'a measurement description is edited and trimmed'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels',
       '{"op": "set_measurement_description", "id": "m-2", "description": "  "}') $$,
  '22023', 'Invalid description',
  'a description cannot be made blank'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels',
       '{"op": "set_measurement_description", "id": "nope", "description": "x"}') $$,
  '22023', 'Measurement not found',
  'editing an unknown measurement is refused'
);
select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels',
    '{"op": "remove_measurement", "id": "m-1"}') -> 'measurements' -> 0 ->> 'id',
  'm-2',
  'deleting a measurement keeps the others'
);

-- One step's change keeps the other steps' state.
select is(
  (select jsonb_agg(e ->> 'key' order by e ->> 'key')
     from public.builds b, jsonb_array_elements(b.sequence_state) e
    where b.id = 'e0000000-0000-4000-8000-00000000000e'),
  '["TapTestPanels", "ThicknessBlank"]'::jsonb,
  'each step has one entry and changes to one step leave the other in place'
);
select is(
  (select e ->> 'notes' from public.builds b, jsonb_array_elements(b.sequence_state) e
    where b.id = 'e0000000-0000-4000-8000-00000000000e' and e ->> 'key' = 'ThicknessBlank'),
  E'Used 3 mm\nbrace stock',
  'the notes of ThicknessBlank survived the changes to TapTestPanels'
);

-- Entries written by older versions (or the legacy import) are read leniently and kept.
reset role;
update public.builds
   set sequence_state = sequence_state || '[{"key": "Neck", "completed": true}, {"key": "RetiredStep", "notes": "kept"}]'
 where id = 'e0000000-0000-4000-8000-00000000000e';
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select is(
  public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'Neck',
                           '{"op": "set_notes", "notes": "Mahogany"}'),
  '{"key": "Neck", "completed": true, "notes": "Mahogany", "photos": [], "measurements": []}'::jsonb,
  'an older entry with only a key and a completion flag gains empty fields'
);
select is(
  (select count(*)::int from public.builds b, jsonb_array_elements(b.sequence_state) e
    where b.id = 'e0000000-0000-4000-8000-00000000000e' and e ->> 'key' = 'RetiredStep'),
  1,
  'an entry whose key is not in the template is kept in storage'
);

-- Invalid calls.
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'Thickness blank',
                                     '{"op": "set_completed", "completed": true}') $$,
  '22023', 'Invalid step key',
  'step keys are letters and digits only'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'Neck', '{"op": "explode"}') $$,
  '22023', 'Unknown operation',
  'unknown operations are refused'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'Neck',
                                     '{"op": "set_completed", "completed": "yes"}') $$,
  '22023', 'completed must be a boolean',
  'completion must be a boolean'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'Neck',
                                     '{"op": "set_notes", "notes": 42}') $$,
  '22023', 'notes must be text',
  'notes must be text'
);
select throws_ok(
  $$ select public.update_build_step('f0000000-0000-4000-8000-00000000000f', 'Neck',
                                     '{"op": "set_completed", "completed": true}') $$,
  'P0002', 'Build not found',
  'a missing build is reported as not found'
);

-- Only the owner changes steps.
reset role;
create temporary table before_state on commit drop as
  select sequence_state from public.builds where id = 'e0000000-0000-4000-8000-00000000000e';
select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'Neck',
                                     '{"op": "set_completed", "completed": false}') $$,
  'P0002', 'Build not found',
  'another user cannot change the build''s steps and learns nothing about it'
);
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'Neck',
                                     '{"op": "set_completed", "completed": false}') $$,
  'P0002', 'Build not found',
  'an administrator cannot change another user''s steps'
);
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'TapTestPanels',
                                     '{"op": "remove_photo", "name": "1733500000000_k3j9x2ab.jpg"}') $$,
  'P0002', 'Build not found',
  'an administrator cannot remove another user''s step photos'
);
select is(
  (select array_length(array_agg(e), 1) from public.builds b, jsonb_array_elements(b.sequence_state) e
    where b.id = 'e0000000-0000-4000-8000-00000000000e'),
  4,
  'an administrator can still read the step state'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.update_build_step('e0000000-0000-4000-8000-00000000000e', 'Neck',
                                     '{"op": "set_completed", "completed": false}') $$,
  '42501', null,
  'anonymous visitors cannot call the step function'
);
reset role;
select is(
  (select sequence_state from public.builds where id = 'e0000000-0000-4000-8000-00000000000e'),
  (select sequence_state from before_state),
  'the refused calls left the stored state unchanged'
);

select * from finish();
rollback;
