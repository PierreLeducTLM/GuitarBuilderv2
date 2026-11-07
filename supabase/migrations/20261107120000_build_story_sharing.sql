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

-- ---------------------------------------------------------------------------
-- Story data
-- ---------------------------------------------------------------------------

-- The story of the build whose sharing is on and whose token is p_token, or null
-- (build-story-sharing: Anonymous Story Access). Steps hidden by the build's variant are
-- left out, an incomplete step is only its key and completion, and stored entries are
-- read leniently, like update_build_step(): malformed fields read as empty. Nothing
-- identifies the owner, the build or the token.
create function public.get_build_story(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'name', b.name,
           'guitarType', b.guitar_type,
           'boboNeck', b.bobo_neck,
           'createdAt', b.created_at,
           'steps', coalesce((
             select jsonb_agg(
                      case when s.completed
                           then jsonb_build_object('key', s.key, 'completed', true,
                                                   'notes', s.notes, 'photos', s.photos,
                                                   'measurements', s.measurements)
                           else jsonb_build_object('key', s.key, 'completed', false)
                      end
                      order by s.ord)
               from (
                 select e.ord,
                        e.elem ->> 'key' as key,
                        coalesce(case when jsonb_typeof(e.elem -> 'completed') = 'boolean'
                                      then (e.elem -> 'completed')::boolean end, false) as completed,
                        coalesce(case when jsonb_typeof(e.elem -> 'notes') = 'string'
                                      then e.elem -> 'notes' end, '""'::jsonb) as notes,
                        coalesce(case when jsonb_typeof(e.elem -> 'photos') = 'array'
                                      then e.elem -> 'photos' end, '[]'::jsonb) as photos,
                        coalesce(case when jsonb_typeof(e.elem -> 'measurements') = 'array'
                                      then e.elem -> 'measurements' end, '[]'::jsonb) as measurements
                   from jsonb_array_elements(b.sequence_state) with ordinality as e (elem, ord)
                  where jsonb_typeof(e.elem -> 'key') = 'string'
               ) s
              where public.step_applies(s.key, b.guitar_type, b.bobo_neck)
           ), '[]'::jsonb))
    from public.builds b
   where b.share_enabled
     and b.share_token = p_token;
$$;

comment on function public.get_build_story(uuid) is
  'The public story of the shared build that a token opens, or null (build-story-sharing).';

revoke execute on function public.get_build_story(uuid) from public;
grant execute on function public.get_build_story(uuid) to anon, authenticated;
