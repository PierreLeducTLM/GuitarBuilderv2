-- Share links and the public build story.
--
-- Spec: build-story-sharing (Enable Sharing, Disable Sharing, Share Link Regeneration,
-- Share Token Properties, Sharing Restricted to Owner, Share State Consistency).
--
-- Rules enforced here, all covered by supabase/tests/database:
-- * only a build's owner turns its sharing on or off and reads its link; another user,
--   an administrator and an anonymous visitor are refused, and a missing build gives
--   the same error, so nothing is revealed about builds the caller does not own;
-- * turning sharing on keeps the current token while sharing is on, otherwise it draws
--   a new random UUID; turning it off removes the token, so a link never comes back;
-- * the share columns stay unreadable and unwritable through the table itself.

-- ---------------------------------------------------------------------------
-- Share control
-- ---------------------------------------------------------------------------

-- Turns sharing of one of the caller's builds on or off and returns the token, or null
-- when sharing is off. The update moves updated_at through the builds trigger.
create function public.set_build_sharing(p_build_id uuid, p_enabled boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_token uuid;
begin
  select b.share_enabled, b.share_token
    into v_enabled, v_token
    from public.builds b
   where b.id = p_build_id
     and b.owner_id = (select auth.uid())
     for update;
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_enabled then
    if not (v_enabled and v_token is not null) then
      v_token := gen_random_uuid();
    end if;
  else
    v_token := null;
  end if;

  update public.builds
     set share_enabled = v_token is not null,
         share_token = v_token
   where id = p_build_id;

  return v_token;
end;
$$;

comment on function public.set_build_sharing(uuid, boolean) is
  'Turns sharing of one of the caller''s builds on or off (build-story-sharing).';

revoke execute on function public.set_build_sharing(uuid, boolean) from public, anon;
grant execute on function public.set_build_sharing(uuid, boolean) to authenticated;

-- The current share token of one of the caller's builds, or null when it is not shared.
create function public.build_share_token(p_build_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  select case when b.share_enabled then b.share_token end
    into v_token
    from public.builds b
   where b.id = p_build_id
     and b.owner_id = (select auth.uid());
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return v_token;
end;
$$;

comment on function public.build_share_token(uuid) is
  'The share token of one of the caller''s builds, or null when sharing is off.';

revoke execute on function public.build_share_token(uuid) from public, anon;
grant execute on function public.build_share_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Variant applicability
-- ---------------------------------------------------------------------------

-- Whether a template step applies to a build's construction variant (build-sequence:
-- Step Applicability by Variant). The same rule as stepApplies() in
-- apps/web/src/lib/sequence/variant.ts: a BOBO-only step needs a BOBO neck, and a step
-- of one guitar type is hidden only when the build is set to the other type. The key
-- lists between the markers are checked against the app's step template by
-- apps/web/src/lib/story/variantRulesSql.test.ts.
create function public.step_applies(p_key text, p_guitar_type text, p_bobo boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- step-variant-rules:begin
  select not (
    (not p_bobo and p_key = any (array[
      'CLGlueBOBO1', 'CLCutBOBO', 'BOBOFitLoose', 'BOBONeckGroove', 'BOBOGlueLosen',
      'MortiseHeelBolt', 'MakeBoltBar', 'RoutHeelMortise'
    ]))
    or (p_guitar_type is not distinct from 'classical' and p_key = any (array[
      'SSCutBridge', 'SSShapeBridge', 'FabricateBridge', 'CutSideProfile2', 'DrillBridgePin',
      'ShapeBridgeWings', 'ShapeTopBridge', 'CounterBore', 'PolishBridge', 'RadiusBottom',
      'SSFitHeel', 'SSCutHeelTuners'
    ]))
    or (p_guitar_type is not distinct from 'steel_string' and p_key = any (array[
      'CLGlueBOBO1', 'CLCutBOBO', 'FabricateCLBridge', 'DrillStringHoles', 'RoutChannels',
      'GlueTieBlock', 'ShapeBridgeWings2', 'ProfilePolish', 'MachineCompensated',
      'ShapeMarkString', 'CLFitHeadLaminate', 'CLDrillTuners'
    ]))
  );
  -- step-variant-rules:end
$$;

comment on function public.step_applies(text, text, boolean) is
  'Whether a template step applies to a construction variant (build-sequence).';

revoke execute on function public.step_applies(text, text, boolean) from public, anon, authenticated;
