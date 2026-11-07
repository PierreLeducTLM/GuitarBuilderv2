-- The story data that a share token unlocks (build-story-sharing: Anonymous Story
-- Access, No Enumeration of Shared Builds, Story Progress; build-sequence: Step
-- Applicability by Variant).
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
create function tests.authenticate_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end;
$$;

-- The 132 keys of the step template, in template order.
create temporary table template_keys (key text primary key) on commit drop;
insert into template_keys (key) values
  ('TrussRod'), ('MakeTrussNut'), ('MakeTrussBlock'), ('CutBendRod'), ('ThreadRod'),
  ('AssembleParts'), ('BindRod'), ('Fretboard'), ('SquareUp'), ('ThicknessBlank'),
  ('CutFrets'), ('RoutNut'), ('CLGlueBOBO1'), ('Crown'), ('TaperFret'), ('PressFrets'),
  ('Neck'), ('SquareShaft'), ('CLCutBOBO'), ('SquareHeel'), ('CutGlueHead'),
  ('GlueHeel'), ('CutTrussRod'), ('CutNeckTenon'), ('BandHeelProfile'), ('FitLevelEars'),
  ('TaperThinHead'), ('TopPanel'), ('CutRectangle'), ('ReduceThickness'), ('TapTest'),
  ('TrimBackStrip'), ('InlayRosette'), ('PlaneThickness'), ('ReinforceSound'),
  ('FitGlueBraces'), ('BraceBridgePlate'), ('SSCutBridge'), ('CutBraceBlank'),
  ('BendFalcate'), ('LaminateFalcate'), ('GableBack'), ('ShapeBase'), ('ShapeFitFan'),
  ('SSShapeBridge'), ('BackPanel'), ('CutRectOutline'), ('PlaneThickness2'),
  ('TapTestPanels'), ('JoinPanels'), ('PlaneTargetThickness'), ('CutPanelOutline'),
  ('GlueShapeBackStrip'), ('FitGlueBracesBack'), ('SidesBindings'), ('PlaneThickness3'),
  ('TrimBindings'), ('CutSideProfile'), ('ThinCutaway'), ('BendSides'),
  ('ApplyPurfling'), ('BendBindings'), ('FitSideMould'), ('EndBlockLinings'),
  ('CutHeadBlockParts'), ('CutTailBlock'), ('CutLiningBlanks'), ('FabricateHeadBlock'),
  ('ShapeTailBlock'), ('KerfBendLinings'), ('Bridge'), ('FabricateBridge'),
  ('CutSideProfile2'), ('DrillBridgePin'), ('ShapeBridgeWings'), ('ShapeTopBridge'),
  ('CounterBore'), ('PolishBridge'), ('RadiusBottom'), ('FabricateCLBridge'),
  ('DrillStringHoles'), ('RoutChannels'), ('GlueTieBlock'), ('ShapeBridgeWings2'),
  ('ProfilePolish'), ('MachineCompensated'), ('ShapeMarkString'), ('NutSaddle'),
  ('CutBlanks'), ('ShapeSaddleBlank'), ('PolishSaddleBlank'), ('AssembleNeckRod'),
  ('DressEnds'), ('CLFitHeadLaminate'), ('CLDrillTuners'), ('CarveNeck'),
  ('FitGlueHeadCap'), ('FitGlueFretsMarkers'), ('SandGrainFinish'),
  ('BuffNeckFitTuners'), ('BOBOFitLoose'), ('BOBONeckGroove'), ('BOBOGlueLosen'),
  ('MakeHeelCap'), ('SandGrainBody'), ('BuffBody'), ('FixNeckBody'), ('SSFitHeel'),
  ('SSCutHeelTuners'), ('PreCarveHeel'), ('PreFitNeck'), ('MortiseHeelBolt'),
  ('MakeBoltBar'), ('RoutHeelMortise'), ('FitTopBack'), ('GlueTopBack'),
  ('MakeMassBlocks'), ('GlueMassBlocks'), ('DomeSides'), ('FitGlueHeadTail'),
  ('GlueBackPanel'), ('CheckFitTopPanel'), ('GlueTopPanel'), ('BindBody'),
  ('FitNutSaddle'), ('StringGuitar'), ('SetRelief'), ('SetAction'), ('SetIntonation'),
  ('TunePlay'), ('AssessAcoustic'), ('OptimiseAcoustic');

-- Which steps apply to each variant (build-sequence: Variant step and arrow counts).
select is(
  (select count(*)::int from template_keys where public.step_applies(key, 'classical', true)), 120,
  'a classical build with a BOBO neck has 120 steps'
);
select is(
  (select count(*)::int from template_keys where public.step_applies(key, 'classical', false)), 112,
  'a classical build without a BOBO neck has 112 steps'
);
select is(
  (select count(*)::int from template_keys where public.step_applies(key, 'steel_string', true)), 120,
  'a steel-string build with a BOBO neck has 120 steps'
);
select is(
  (select count(*)::int from template_keys where public.step_applies(key, 'steel_string', false)), 114,
  'a steel-string build without a BOBO neck has 114 steps'
);
select is(
  (select count(*)::int from template_keys where public.step_applies(key, null, true)), 132,
  'a build without a guitar type and with a BOBO neck has all 132 steps'
);
select is(
  (select count(*)::int from template_keys where public.step_applies(key, null, false)), 124,
  'a build without a guitar type and without a BOBO neck has 124 steps'
);

-- A shared classical build without a BOBO neck, owned by B. Its step state holds a
-- documented completed step, an incomplete step with content, a steel-string step and a
-- BOBO step left over from earlier variants, and two malformed entries.
delete from auth.users;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'admin@example.com');
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into auth.users (id, email) values ('c0000000-0000-4000-8000-00000000000c', 'c@example.com');
insert into public.builds (id, owner_id, name, guitar_type, bobo_neck, created_at, share_enabled,
                           share_token, sequence_state)
values ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', 'OM #3',
        'classical', false, '2025-12-06T15:30:00Z', true, 'dddddddd-0000-4000-8000-00000000000d',
        '[{"key": "TrussRod", "completed": true, "notes": "Rod bent.",
           "photos": [{"url": "https://x/rod.jpg", "name": "1_a.jpg"}],
           "measurements": [{"id": "m1", "timestamp": 1, "description": "Tap", "frequency": 187.4,
                             "spectrum": {"frequencies": [1], "magnitudes": [1], "magnitudesDb": [0],
                                          "sampleRate": 48000, "fftSize": 2, "binWidth": 1}}]},
          {"key": "MakeTrussNut", "completed": false, "notes": "Secret plan",
           "photos": [{"url": "https://x/nut.jpg", "name": "2_b.jpg"}], "measurements": []},
          {"key": "SSCutBridge", "completed": true, "notes": "Steel-string leftover",
           "photos": [], "measurements": []},
          {"key": "CLGlueBOBO1", "completed": true, "notes": "BOBO leftover",
           "photos": [], "measurements": []},
          {"key": "ThreadRod", "completed": "yes", "notes": 5, "photos": "x"},
          {"key": "BindRod", "completed": true, "notes": 5, "photos": "x", "measurements": null}]'),
       ('20000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-00000000000c', 'Unshared',
        'steel_string', true, now(), false, 'eeeeeeee-0000-4000-8000-00000000000e', '[]'),
       ('30000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-00000000000c', 'No type',
        null, true, now(), true, 'ffffffff-0000-4000-8000-00000000000f',
        '[{"completed": true, "notes": "No key"}, ["TrussRod"], "TrussRod"]');

create temporary table story on commit drop as
  select public.get_build_story('dddddddd-0000-4000-8000-00000000000d') as data limit 0;
grant all on story to anon, authenticated;

-- An anonymous visitor with the token.
select tests.authenticate_as_anon();
insert into story select public.get_build_story('dddddddd-0000-4000-8000-00000000000d');
select results_eq(
  $$ select array_agg(k order by k) from story, jsonb_object_keys(data) k $$,
  $$ values (array['boboNeck', 'createdAt', 'guitarType', 'name', 'steps']) $$,
  'the story holds the name, guitar type, BOBO choice, creation date and steps, and nothing else'
);
select results_eq(
  $$ select data ->> 'name', data ->> 'guitarType', (data -> 'boboNeck')::boolean,
            (data ->> 'createdAt')::timestamptz from story $$,
  $$ values ('OM #3', 'classical', false, '2025-12-06T15:30:00Z'::timestamptz) $$,
  'with the build''s values'
);
select is(
  (select step from story, jsonb_array_elements(data -> 'steps') step where step ->> 'key' = 'TrussRod'),
  '{"key": "TrussRod", "completed": true, "notes": "Rod bent.",
    "photos": [{"url": "https://x/rod.jpg", "name": "1_a.jpg"}],
    "measurements": [{"id": "m1", "timestamp": 1, "description": "Tap", "frequency": 187.4,
                      "spectrum": {"frequencies": [1], "magnitudes": [1], "magnitudesDb": [0],
                                   "sampleRate": 48000, "fftSize": 2, "binWidth": 1}}]}'::jsonb,
  'a completed step comes with its notes, photos and measurements'
);
select is(
  (select step from story, jsonb_array_elements(data -> 'steps') step where step ->> 'key' = 'MakeTrussNut'),
  '{"key": "MakeTrussNut", "completed": false}'::jsonb,
  'an incomplete step comes without its notes, photos or measurements'
);
select is(
  (select count(*)::int from story, jsonb_array_elements(data -> 'steps') step
    where step ->> 'key' in ('SSCutBridge', 'CLGlueBOBO1')),
  0,
  'steps hidden by the variant are left out'
);
select is(
  (select step from story, jsonb_array_elements(data -> 'steps') step where step ->> 'key' = 'ThreadRod'),
  '{"key": "ThreadRod", "completed": false}'::jsonb,
  'a malformed completion reads as not completed'
);
select is(
  (select step from story, jsonb_array_elements(data -> 'steps') step where step ->> 'key' = 'BindRod'),
  '{"key": "BindRod", "completed": true, "notes": "", "photos": [], "measurements": []}'::jsonb,
  'malformed notes, photos and measurements read as empty'
);
select is(
  (select jsonb_array_length(data -> 'steps') from story), 4,
  'the story holds exactly the four applicable stored steps'
);
select is(
  (select data::text ~* 'b0000000|dddddddd|10000000' from story), false,
  'the story carries neither the owner, nor the token, nor the build id'
);

-- Tokens that do not open a story.
select is(
  public.get_build_story('99999999-0000-4000-8000-000000000009'), null,
  'an unknown token gives nothing'
);
select is(
  public.get_build_story('eeeeeeee-0000-4000-8000-00000000000e'), null,
  'the token of a build whose sharing is off gives nothing'
);

select is(
  public.get_build_story('ffffffff-0000-4000-8000-00000000000f') -> 'steps', '[]'::jsonb,
  'stored entries without a step key are left out'
);

-- A signed-in visitor sees the same story.
select tests.authenticate_as('c0000000-0000-4000-8000-00000000000c');
select is(
  public.get_build_story('dddddddd-0000-4000-8000-00000000000d'), (select data from story),
  'a signed-in visitor gets the same story'
);

-- Once the owner turns sharing off, the old token gives nothing.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select public.set_build_sharing('10000000-0000-4000-8000-000000000001', false);
select tests.authenticate_as_anon();
select is(
  public.get_build_story('dddddddd-0000-4000-8000-00000000000d'), null,
  'a revoked token gives nothing'
);

-- Nothing can be listed (No Enumeration of Shared Builds).
reset role;
insert into storage.objects (bucket_id, name)
  select 'step-photos', '10000000-0000-4000-8000-000000000001/TrussRod/1_a.jpg'
   where exists (select 1 from storage.buckets where id = 'step-photos');
select tests.authenticate_as_anon();
select throws_ok(
  $$ select id from public.builds $$,
  '42501', null,
  'an anonymous client cannot list builds'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'step-photos'), 0,
  'an anonymous client cannot list the stored step photos'
);

select * from finish();
rollback;
