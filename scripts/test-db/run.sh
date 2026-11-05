#!/usr/bin/env bash
# Runs the pgTAP database tests (supabase/tests/database) without Docker:
# starts a throwaway Postgres cluster, loads a Supabase shim, applies the
# migrations, runs every test file with Perl's `prove`, then the first-admin
# and default-panels race tests. CI runs the same files with `supabase test db`.
#
# Requirements: Postgres 16+ server binaries (PG_BIN, default
# /usr/lib/postgresql/16/bin), the pgTAP extension installed into that server
# (https://pgtap.org: `make && make install` from the PGXN release), and `prove`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PORT="${TEST_DB_PORT:-55432}"
DB=gb_test

fail() {
  echo "test:db: $*" >&2
  exit 1
}

[[ -x "$PG_BIN/initdb" ]] || fail "Postgres server binaries not found in $PG_BIN (set PG_BIN)."
command -v prove >/dev/null || fail "'prove' (Perl Test::Harness) is required."
SHAREDIR="$("$PG_BIN/pg_config" --sharedir)"
[[ -f "$SHAREDIR/extension/pgtap.control" ]] || fail "pgTAP is not installed in $SHAREDIR.
  Install it from source: download https://api.pgxn.org/dist/pgtap/1.3.4/pgtap-1.3.4.zip,
  unzip, then run: make PG_CONFIG=$PG_BIN/pg_config && make install PG_CONFIG=$PG_BIN/pg_config"

# initdb and postgres refuse to run as root; use the postgres OS account then.
as_pg() {
  if [[ "$(id -u)" == 0 ]]; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}

WORK="$(mktemp -d "${TMPDIR:-/tmp}/gb-test-db.XXXXXX")"
chmod 755 "$WORK"
[[ "$(id -u)" == 0 ]] && chown postgres "$WORK"

cleanup() {
  as_pg "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "test:db: starting a throwaway Postgres cluster in $WORK"
as_pg "$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust -E UTF8 --locale=C --no-sync >/dev/null
as_pg "$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/postgres.log" -w \
  -o "-k $WORK -p $PORT -c listen_addresses='' -c fsync=off" start >/dev/null

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres)
"${PSQL[@]}" -d postgres -c "create database $DB"
"${PSQL[@]}" -d "$DB" -c "alter database $DB set search_path = \"\$user\", public, extensions"
"${PSQL[@]}" -d "$DB" -f "$ROOT/scripts/test-db/supabase-shim.sql"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "test:db: applying $(basename "$migration")"
  "${PSQL[@]}" -d "$DB" -1 -f "$migration"
done
"${PSQL[@]}" -d "$DB" -c "create extension pgtap with schema extensions"

echo "test:db: running pgTAP tests"
cd "$ROOT"
PGOPTIONS="-c client_min_messages=warning" \
  prove --failures --exec "${PSQL[*]} -d $DB -t -A -f" supabase/tests/database/*.test.sql

echo "test:db: running the first-admin race test"
bash "$ROOT/scripts/test-db/first-admin-race.sh" "postgresql://postgres@/$DB?host=$WORK&port=$PORT"
echo "test:db: running the default-panels race test"
bash "$ROOT/scripts/test-db/default-panels-race.sh" "postgresql://postgres@/$DB?host=$WORK&port=$PORT"
