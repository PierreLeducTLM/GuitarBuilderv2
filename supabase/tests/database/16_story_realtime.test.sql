-- The "changed" signal a shared build sends to its open stories, and who may receive
-- it (build-story-sharing: Live Story Updates, Anonymous Story Access, Disable Sharing).
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

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
-- How the Realtime server checks a client joining a private channel: as the client's
-- role, with the topic in realtime.topic, reading realtime.messages.
create function tests.visible_signals(topic text) returns integer
language plpgsql as $$
declare
  n integer;
begin
  perform set_config('realtime.topic', topic, true);
  select count(*)::int into n from realtime.messages m where m.topic = visible_signals.topic;
  return n;
end;
$$;
grant execute on function tests.visible_signals(text) to anon, authenticated;

-- User B owns a shared build (S), an unshared one (U) and a shared one to delete (D).
delete from auth.users;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'admin@example.com');
insert into auth.users (id, email) values ('b0000000-0000-4000-8000-00000000000b', 'b@example.com');
insert into public.builds (id, owner_id, name, guitar_type, bobo_neck, share_enabled, share_token)
values ('10000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000b', 'Shared',
        'classical', true, true, '11111111-0000-4000-8000-000000000001'),
       ('20000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-00000000000b', 'Unshared',
        'classical', true, false, null),
       ('30000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-00000000000b', 'Doomed',
        'classical', true, true, '33333333-0000-4000-8000-000000000003');
delete from realtime.messages;

-- Changes to a shared build signal its story.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select public.update_build_step('10000000-0000-4000-8000-000000000001', 'TrussRod',
                                '{"op": "set_notes", "notes": "Rod bent."}');
reset role;
select results_eq(
  $$ select topic, event, private, payload - 'id' from realtime.messages $$,
  $$ values ('story:11111111-0000-4000-8000-000000000001', 'changed', true, '{}'::jsonb) $$,
  'a step change sends one empty "changed" signal on the story''s private topic'
);

select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
update public.builds set guitar_type = 'steel_string' where id = '10000000-0000-4000-8000-000000000001';
reset role;
select is(
  (select count(*)::int from realtime.messages where topic = 'story:11111111-0000-4000-8000-000000000001'),
  2,
  'a variant change made directly by the owner signals too'
);

select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select public.update_build_step('20000000-0000-4000-8000-000000000002', 'TrussRod',
                                '{"op": "set_completed", "completed": true}');
reset role;
select is((select count(*)::int from realtime.messages), 2, 'an unshared build sends no signal');

-- Viewers receive a signal only on the topic of a build that is shared now.
insert into realtime.messages (topic, extension, event, payload, private)
values ('story:99999999-0000-4000-8000-000000000009', 'broadcast', 'changed', '{}', true),
       ('story:abc', 'broadcast', 'changed', '{}', true),
       ('elsewhere', 'broadcast', 'changed', '{}', true),
       ('story:44444444-0000-4000-8000-000000000004', 'broadcast', 'changed', '{}', true);
-- An unshared build that still holds an old token (the legacy app could leave one).
insert into public.builds (id, owner_id, name, guitar_type, bobo_neck, share_enabled, share_token)
values ('40000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-00000000000b', 'Leftover',
        'classical', true, false, '44444444-0000-4000-8000-000000000004');
select tests.authenticate_as_anon();
select is(
  tests.visible_signals('story:11111111-0000-4000-8000-000000000001'), 2,
  'an anonymous viewer with a valid token receives its story''s signals'
);
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select is(
  tests.visible_signals('story:11111111-0000-4000-8000-000000000001'), 2,
  'so does a signed-in viewer'
);
select tests.authenticate_as_anon();
select is(
  tests.visible_signals('story:99999999-0000-4000-8000-000000000009'), 0,
  'a token that matches no build receives nothing'
);
select is(tests.visible_signals('story:abc'), 0, 'a malformed token receives nothing');
select is(
  tests.visible_signals('story:44444444-0000-4000-8000-000000000004'), 0,
  'the leftover token of an unshared build receives nothing'
);
select is(tests.visible_signals('elsewhere'), 0, 'another topic receives nothing');
select throws_ok(
  $$ insert into realtime.messages (topic, extension, event, payload, private)
     values ('story:11111111-0000-4000-8000-000000000001', 'broadcast', 'changed', '{}', true) $$,
  '42501', null,
  'a viewer cannot send signals'
);

-- Turning sharing off signals the old topic, which then admits nobody.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select public.set_build_sharing('10000000-0000-4000-8000-000000000001', false);
reset role;
select is(
  (select count(*)::int from realtime.messages where topic = 'story:11111111-0000-4000-8000-000000000001'),
  3,
  'turning sharing off signals the story one last time'
);
select tests.authenticate_as_anon();
select is(
  tests.visible_signals('story:11111111-0000-4000-8000-000000000001'), 0,
  'a revoked token receives nothing'
);

-- Turning sharing on signals nothing; nobody can be listening yet.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select public.set_build_sharing('20000000-0000-4000-8000-000000000002', true);
reset role;
select is(
  (select count(*)::int from realtime.messages where topic not in
     ('story:99999999-0000-4000-8000-000000000009', 'story:abc', 'elsewhere',
      'story:44444444-0000-4000-8000-000000000004')),
  3,
  'turning sharing on sends no signal'
);

-- Deleting a shared build signals its story.
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
delete from public.builds where id = '30000000-0000-4000-8000-000000000003';
reset role;
select is(
  (select count(*)::int from realtime.messages where topic = 'story:33333333-0000-4000-8000-000000000003'),
  1,
  'deleting a shared build signals its story'
);
select tests.authenticate_as_anon();
select is(
  tests.visible_signals('story:33333333-0000-4000-8000-000000000003'), 0,
  'and the deleted build''s token then receives nothing'
);

select * from finish();
rollback;
