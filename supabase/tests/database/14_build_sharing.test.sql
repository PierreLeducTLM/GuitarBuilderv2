-- Turning a build's sharing on and off, and reading its link (build-story-sharing:
-- Enable Sharing, Disable Sharing, Share Link Regeneration, Share Token Properties,
-- Sharing Restricted to Owner, Share State Consistency).
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

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

-- Admin A (first account) and users B and C. B owns build 1, C owns build 2.
delete from auth.users;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'admin@example.com');
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into auth.users (id, email) values ('c0000000-0000-4000-8000-00000000000c', 'c@example.com');
insert into public.builds (id, owner_id, name, guitar_type, bobo_neck, created_at, updated_at)
values ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', 'OM #3',
        'steel_string', true, '2025-12-06', '2025-12-06'),
       ('20000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-00000000000c', 'C build',
        'classical', false, '2025-12-06', '2025-12-06');

create temporary table seen (label text primary key, token uuid) on commit drop;
grant all on seen to authenticated, anon;

-- The owner turns sharing on.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select is(
  public.build_share_token('10000000-0000-4000-8000-000000000001'), null,
  'an unshared build has no link'
);
insert into seen values ('first', public.set_build_sharing('10000000-0000-4000-8000-000000000001', true));
select isnt((select token from seen where label = 'first'), null, 'turning sharing on returns a token');
select is(
  (select token from seen where label = 'first')::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  true,
  'the token is a random (version 4) UUID'
);
select isnt(
  (select token from seen where label = 'first'), '10000000-0000-4000-8000-000000000001'::uuid,
  'the token is not the build id'
);
select results_eq(
  $$ select share_enabled, updated_at > '2025-12-06'::timestamptz
       from public.builds where id = '10000000-0000-4000-8000-000000000001' $$,
  $$ values (true, true) $$,
  'the build is shared and its last-update time moves'
);
select is(
  public.build_share_token('10000000-0000-4000-8000-000000000001'),
  (select token from seen where label = 'first'),
  'the owner reads the current link back'
);
select is(
  public.set_build_sharing('10000000-0000-4000-8000-000000000001', true),
  (select token from seen where label = 'first'),
  'turning sharing on while it is on keeps the token'
);

-- The token stays out of the table's columns.
select throws_ok(
  $$ select share_token from public.builds $$,
  '42501', null,
  'the owner still cannot read share_token from the table'
);
select throws_ok(
  $$ update public.builds set share_enabled = false where id = '10000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'the share columns are still not writable directly'
);

-- Off, then on again.
select is(
  public.set_build_sharing('10000000-0000-4000-8000-000000000001', false), null,
  'turning sharing off returns no token'
);
reset role;
select results_eq(
  $$ select share_enabled, share_token from public.builds
      where id = '10000000-0000-4000-8000-000000000001' $$,
  $$ values (false, null::uuid) $$,
  'turning sharing off removes the token and the flag'
);
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select is(
  public.build_share_token('10000000-0000-4000-8000-000000000001'), null,
  'an unshared build has no link after sharing is turned off'
);
insert into seen values ('second', public.set_build_sharing('10000000-0000-4000-8000-000000000001', true));
select isnt(
  (select token from seen where label = 'second'), (select token from seen where label = 'first'),
  'turning sharing on again gives a different token'
);
select isnt((select token from seen where label = 'second'), null, 'and it is a token');

-- A build left unshared with an old token (the legacy app could leave one behind).
reset role;
update public.builds set share_enabled = false, share_token = 'ffffffff-0000-4000-8000-00000000000f'
 where id = '10000000-0000-4000-8000-000000000001';
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select is(
  public.build_share_token('10000000-0000-4000-8000-000000000001'), null,
  'a leftover token of an unshared build is not a link'
);
insert into seen values ('third', public.set_build_sharing('10000000-0000-4000-8000-000000000001', true));
select isnt(
  (select token from seen where label = 'third'), 'ffffffff-0000-4000-8000-00000000000f'::uuid,
  'turning sharing on never brings a leftover token back'
);
select isnt((select token from seen where label = 'third'), null, 'and gives a new token');

-- Other users, an administrator and anonymous visitors are refused.
reset role;
update public.builds set share_enabled = true, share_token = 'eeeeeeee-0000-4000-8000-00000000000e'
 where id = '20000000-0000-4000-8000-000000000002';
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select throws_ok(
  $$ select public.set_build_sharing('20000000-0000-4000-8000-000000000002', false) $$,
  '42501', null,
  'a user cannot turn off sharing of another user''s build'
);
select throws_ok(
  $$ select public.build_share_token('20000000-0000-4000-8000-000000000002') $$,
  '42501', null,
  'a user cannot read the link of another user''s build'
);
select throws_ok(
  $$ select public.set_build_sharing('99999999-0000-4000-8000-000000000009', true) $$,
  '42501', null,
  'a missing build gives the same error'
);
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select throws_ok(
  $$ select public.set_build_sharing('10000000-0000-4000-8000-000000000001', false) $$,
  '42501', null,
  'an administrator cannot change sharing of another user''s build'
);
select throws_ok(
  $$ select public.build_share_token('10000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'an administrator cannot read the link of another user''s build'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.set_build_sharing('10000000-0000-4000-8000-000000000001', false) $$,
  '42501', null,
  'an anonymous visitor cannot change sharing'
);
select throws_ok(
  $$ select public.build_share_token('10000000-0000-4000-8000-000000000001') $$,
  '42501', null,
  'an anonymous visitor cannot read a link'
);

reset role;
select results_eq(
  $$ select id::text, share_enabled, share_token = (select token from seen where label = 'third')
       from public.builds where id = '10000000-0000-4000-8000-000000000001'
     union all
     select id::text, share_enabled, share_token = 'eeeeeeee-0000-4000-8000-00000000000e'
       from public.builds where id = '20000000-0000-4000-8000-000000000002' $$,
  $$ values ('10000000-0000-4000-8000-000000000001', true, true),
            ('20000000-0000-4000-8000-000000000002', true, true) $$,
  'refused requests leave both builds'' sharing unchanged'
);

select * from finish();
rollback;
