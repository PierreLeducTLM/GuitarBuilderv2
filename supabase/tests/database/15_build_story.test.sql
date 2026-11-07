-- The story data that a share token unlocks (build-story-sharing: Anonymous Story
-- Access, No Enumeration of Shared Builds, Story Progress; build-sequence: Step
-- Applicability by Variant).
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

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

select * from finish();
rollback;
