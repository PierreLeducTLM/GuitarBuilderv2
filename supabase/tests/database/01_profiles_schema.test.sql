-- Schema, privileges and function settings of the profiles migration.
begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

-- Table shape (user-auth: User Profile Data)
select has_table('public', 'profiles', 'profiles table exists');
select columns_are(
  'public', 'profiles',
  array['id', 'email', 'role', 'created_at', 'updated_at'],
  'profiles has exactly the specified columns'
);
select col_is_pk('public', 'profiles', 'id', 'the profile id is the primary key');
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'the profile id is the account id');
select col_not_null('public', 'profiles', 'role', 'role is required');
select col_default_is('public', 'profiles', 'role', 'user', 'role defaults to user');
select col_has_check('public', 'profiles', 'role', 'role is constrained to user or admin');
select col_not_null('public', 'profiles', 'created_at', 'created_at is required');
select col_not_null('public', 'profiles', 'updated_at', 'updated_at is required');
select is(
  (select confdeltype from pg_constraint
   where conrelid = 'public.profiles'::regclass and contype = 'f'),
  'c'::"char",
  'deleting an account deletes its profile'
);

-- Row-level security and policies (user-auth: Profile Visibility)
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'row-level security is enabled on profiles'
);
select policies_are(
  'public', 'profiles',
  array['Users read their own profile', 'Administrators read every profile'],
  'profiles has only the two read policies'
);
select policy_cmd_is('public', 'profiles', 'Users read their own profile', 'SELECT', 'the own-profile policy is read-only');
select policy_cmd_is('public', 'profiles', 'Administrators read every profile', 'SELECT', 'the administrator policy is read-only');
select policy_roles_are('public', 'profiles', 'Users read their own profile', array['authenticated']);
select policy_roles_are('public', 'profiles', 'Administrators read every profile', array['authenticated']);

-- Table privileges: read-only for clients, nothing for anonymous visitors
select table_privs_are('public', 'profiles', 'anon', array[]::text[], 'anon has no privilege on profiles');
select table_privs_are('public', 'profiles', 'authenticated', array['SELECT'], 'signed-in users can only select');
select table_privs_are('public', 'profiles', 'service_role', array['SELECT'], 'the service role can only select');

-- Functions run as definer with a fixed search_path
select is_definer('public', 'is_admin', array[]::name[], 'is_admin is SECURITY DEFINER');
select is_definer('public', 'handle_new_user', array[]::name[], 'handle_new_user is SECURITY DEFINER');
select is_definer('public', 'handle_user_email_change', array[]::name[], 'handle_user_email_change is SECURITY DEFINER');
select is_definer('public', 'admin_list_users', array[]::name[], 'admin_list_users is SECURITY DEFINER');
select is_definer('public', 'admin_set_role', array['uuid', 'text']::name[], 'admin_set_role is SECURITY DEFINER');
select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('is_admin', 'handle_new_user', 'handle_user_email_change', 'admin_list_users', 'admin_set_role')
     and p.proconfig @> array['search_path=""']),
  array['admin_list_users', 'admin_set_role', 'handle_new_user', 'handle_user_email_change', 'is_admin'],
  'every SECURITY DEFINER function pins an empty search_path'
);

-- Function privileges
select function_privs_are('public', 'is_admin', array[]::name[], 'anon', array[]::text[], 'anon cannot call is_admin');
select function_privs_are('public', 'is_admin', array[]::name[], 'authenticated', array['EXECUTE'], 'signed-in users can call is_admin');
select function_privs_are('public', 'admin_set_role', array['uuid', 'text']::name[], 'anon', array[]::text[], 'anon cannot call admin_set_role');
select function_privs_are('public', 'admin_set_role', array['uuid', 'text']::name[], 'authenticated', array['EXECUTE'], 'signed-in users can call admin_set_role (it checks the role itself)');
select function_privs_are('public', 'admin_list_users', array[]::name[], 'anon', array[]::text[], 'anon cannot call admin_list_users');
select function_privs_are('public', 'admin_list_users', array[]::name[], 'authenticated', array['EXECUTE'], 'signed-in users can call admin_list_users (it checks the role itself)');
select function_privs_are('public', 'handle_new_user', array[]::name[], 'authenticated', array[]::text[], 'clients cannot call the sign-up trigger function');
select function_privs_are('public', 'handle_new_user', array[]::name[], 'anon', array[]::text[], 'anon cannot call the sign-up trigger function');
select function_privs_are('public', 'handle_user_email_change', array[]::name[], 'authenticated', array[]::text[], 'clients cannot call the email-sync trigger function');
select ok(
  not has_function_privilege('public', 'public.admin_set_role(uuid, text)', 'execute'),
  'PUBLIC cannot call admin_set_role'
);
select ok(
  not has_function_privilege('public', 'public.is_admin()', 'execute'),
  'PUBLIC cannot call is_admin'
);

-- Triggers on auth.users (user-auth: Automatic Profile Creation)
select has_trigger('auth', 'users', 'on_auth_user_created', 'auth.users has the sign-up trigger');
select trigger_is('auth', 'users', 'on_auth_user_created', 'public', 'handle_new_user', 'the sign-up trigger creates the profile');
select has_trigger('auth', 'users', 'on_auth_user_email_changed', 'auth.users has the email-sync trigger');
select trigger_is('auth', 'users', 'on_auth_user_email_changed', 'public', 'handle_user_email_change', 'the email-sync trigger updates the profile');
select is(
  (select count(*)::int from pg_trigger
   where tgrelid = 'public.profiles'::regclass and not tgisinternal),
  0,
  'profiles has no triggers of its own'
);

select * from finish();
rollback;
