#!/usr/bin/env bash
# First-admin race: two accounts created at the same moment on an installation
# without profiles must produce exactly one administrator (user-auth: First Account
# Becomes Administrator). Needs two real sessions, so it cannot be a pgTAP test.
#
# Usage: first-admin-race.sh <postgres connection URL>
# It commits rows and removes them afterwards; it refuses to run if any profile
# exists, so it can only touch an empty test database.
set -euo pipefail

URL="${1:?usage: first-admin-race.sh <postgres connection URL>}"
PSQL=(psql -X -q -t -A -v ON_ERROR_STOP=1 "$URL")

existing="$("${PSQL[@]}" -c "select count(*) from public.profiles")"
if [[ "$existing" != "0" ]]; then
  echo "first-admin race: skipped, the database already has $existing profile(s)" >&2
  exit 1
fi

cleanup() {
  "${PSQL[@]}" -c "delete from auth.users where email like 'race-%@test.invalid'" >/dev/null || true
}
trap cleanup EXIT

# Session A creates its account and keeps its transaction open for 2 seconds.
"${PSQL[@]}" -c "begin;
  insert into auth.users (id, email) values (gen_random_uuid(), 'race-a@test.invalid');
  select pg_sleep(2);
  commit;" >/dev/null &
session_a=$!

# Session B signs up while A's profile is not yet committed.
sleep 0.5
"${PSQL[@]}" -c "begin;
  insert into auth.users (id, email) values (gen_random_uuid(), 'race-b@test.invalid');
  commit;" >/dev/null
wait "$session_a"

result="$("${PSQL[@]}" -c "select count(*) filter (where role = 'admin') || ' ' || count(*)
  from public.profiles where email like 'race-%@test.invalid'")"
read -r admins total <<<"$result"

if [[ "$total" == "2" && "$admins" == "1" ]]; then
  echo "ok - first-admin race: 2 concurrent sign-ups, exactly 1 admin"
else
  echo "not ok - first-admin race: expected 2 profiles and 1 admin, got $total and $admins" >&2
  exit 1
fi
