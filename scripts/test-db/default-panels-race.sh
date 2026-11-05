#!/usr/bin/env bash
# "Load Default Panels" race: the same user copying the reference set from two tabs at
# the same moment must get one copy (wood-panel-properties: Load Default Panels Feedback,
# "Two tabs at once"). Needs two real sessions, so it cannot be a pgTAP test.
#
# Usage: default-panels-race.sh <postgres connection URL>
# It commits rows and removes them afterwards; it refuses to run if the reference set is
# not empty, so it can only touch a test database.
set -euo pipefail

URL="${1:?usage: default-panels-race.sh <postgres connection URL>}"
PSQL=(psql -X -q -t -A -v ON_ERROR_STOP=1 "$URL")
USER_ID="d0000000-0000-4000-8000-00000000000d"
CLAIMS="{\"sub\": \"$USER_ID\", \"role\": \"authenticated\"}"

existing="$("${PSQL[@]}" -c "select count(*) from public.default_wood_panels")"
if [[ "$existing" != "0" ]]; then
  echo "default-panels race: skipped, the reference set already has $existing panel(s)" >&2
  exit 1
fi

cleanup() {
  "${PSQL[@]}" -c "delete from auth.users where id = '$USER_ID';
    delete from public.default_wood_panels where name like 'race-%'" >/dev/null || true
}
trap cleanup EXIT

"${PSQL[@]}" -c "insert into auth.users (id, email) values ('$USER_ID', 'race-panels@test.invalid');
  insert into public.default_wood_panels (name, sample_length_mm, sample_width_mm, sample_thickness_mm,
    sample_mass_g, freq_longitudinal_hz, freq_cross_grain_hz, freq_diagonal_hz, plate_length_mm, plate_width_mm)
  select 'race-' || i, 605, 238, 4, 228, 61.6, 105, 38.2, 500, 380 from generate_series(1, 5) i;" >/dev/null

copy="begin;
  select set_config('request.jwt.claims', '$CLAIMS', true);
  set local role authenticated;
  select public.load_default_wood_panels();"

# Tab A copies and keeps its transaction open for 2 seconds.
"${PSQL[@]}" -c "$copy select pg_sleep(2); commit;" >/dev/null &
tab_a=$!

# Tab B asks for the same copy while A's copies are not yet committed.
sleep 0.5
"${PSQL[@]}" -c "$copy commit;" >/dev/null
wait "$tab_a"

total="$("${PSQL[@]}" -c "select count(*) from public.wood_panels where owner_id = '$USER_ID'")"
if [[ "$total" == "5" ]]; then
  echo "ok - default-panels race: 2 concurrent copies, 5 panels"
else
  echo "not ok - default-panels race: expected 5 panels, got $total" >&2
  exit 1
fi
