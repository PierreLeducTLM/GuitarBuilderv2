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
