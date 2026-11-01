-- Profiles, roles and the administrator role operations.
--
-- Specs: user-auth (Automatic Profile Creation, First Account Becomes Administrator,
-- User Profile Data, User Roles, Role Changes Restricted, Profile Visibility,
-- Administrator Cross-User Access) and admin-console (Server-Side Administrator
-- Check, List All Users Operation, Change Role Operation).
--
-- Rules enforced here, all covered by supabase/tests/database:
-- * a profile is created only by the sign-up trigger; the first one is admin;
-- * clients can read (own profile, or every profile for admins) but never write;
-- * roles change only through admin_set_role(), never one's own.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user'
    constraint profiles_role_check check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'One profile per account: email copied for display, and the role (user or admin).';
comment on column public.profiles.email is
  'Copy of auth.users.email, kept in sync by on_auth_user_email_changed.';

alter table public.profiles enable row level security;

-- Clients only ever read profiles. Supabase grants every API role full table
-- privileges by default; reduce them so that a missing policy and a missing grant
-- both block writes.
revoke all on table public.profiles from public, anon, authenticated, service_role;
grant select on table public.profiles to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Role check
-- ---------------------------------------------------------------------------

-- True when the caller's own profile has the role admin. SECURITY DEFINER so it can
-- read the caller's profile without going through (and recursing into) RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'Whether the calling user''s profile has the role admin. A missing profile counts as user.';

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row-level security: read own profile; administrators read every profile.
-- No insert, update or delete policy exists for any client role.
-- ---------------------------------------------------------------------------

create policy "Users read their own profile"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Administrators read every profile"
  on public.profiles
  for select
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Profile creation at sign-up
-- ---------------------------------------------------------------------------

-- Creates the profile of every new account. The first profile ever created gets the
-- role admin, every later one the role user. The advisory lock serializes concurrent
-- sign-ups: under READ COMMITTED each statement takes a fresh snapshot, so a sign-up
-- that waited for the lock sees the profile committed by the one before it.
-- A failure is logged and swallowed so it never blocks account creation; such an
-- account has no profile and is treated as role user everywhere.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role text;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.profiles:first-admin', 0));

  begin
    if exists (select 1 from public.profiles) then
      assigned_role := 'user';
    else
      assigned_role := 'admin';
    end if;

    insert into public.profiles (id, email, role)
    values (new.id, new.email, assigned_role);
  exception
    when others then
      raise warning 'handle_new_user: no profile created for user %: % (SQLSTATE %)',
        new.id, sqlerrm, sqlstate;
  end;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Keeps the profile's copy of the email address in sync with the account.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Administrator operations (admin-console)
-- ---------------------------------------------------------------------------

-- Every profile, newest account first. Administrators only.
create function public.admin_list_users()
returns setof public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied. Admin privileges required.'
      using errcode = '42501';
  end if;

  return query
    select *
    from public.profiles
    order by created_at desc, id;
end;
$$;

comment on function public.admin_list_users() is
  'admin-console List All Users Operation: every profile, newest first; administrators only.';

-- Sets another user's role. Checks run in this order so that a non-administrator
-- learns nothing about the target or the value: caller is admin, role is valid,
-- target is not the caller, target exists.
create function public.admin_set_role(target_user_id uuid, new_role text)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  updated public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Access denied. Admin privileges required.'
      using errcode = '42501';
  end if;

  if new_role is null or new_role not in ('user', 'admin') then
    raise exception 'Invalid role. Must be "user" or "admin".'
      using errcode = '22023';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'Cannot change your own role.'
      using errcode = '42501';
  end if;

  update public.profiles
  set role = new_role,
      updated_at = now()
  where id = target_user_id
  returning * into updated;

  if not found then
    raise exception 'User not found.'
      using errcode = 'P0002';
  end if;

  return updated;
end;
$$;

comment on function public.admin_set_role(uuid, text) is
  'admin-console Change Role Operation: administrators change another user''s role.';

revoke execute on function public.admin_list_users() from public, anon;
revoke execute on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
