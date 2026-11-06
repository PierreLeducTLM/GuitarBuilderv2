-- The legacy import (legacy-data-migration: Build Migration, Wood Panel Recalculation)
-- keeps first-version update times by running `set local gb.keep_updated_at = 'on'` in its
-- own transactions. Clients reach the database only through PostgREST and the step and
-- panel functions, which cannot set arbitrary session settings, so for them every change
-- still moves updated_at (guitar-builds: Update timestamp moves on change).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('gb.keep_updated_at', true), '') <> 'on' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated, service_role;
