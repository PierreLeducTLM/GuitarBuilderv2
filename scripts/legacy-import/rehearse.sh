#!/usr/bin/env bash
# Rehearses the legacy import (legacy-account-and-build-import, design decision 10) against a
# real first-version stack: starts one from the first-version repository's migrations and a
# fresh v2 stack, each with its own project id and ports, then runs rehearse.mts, which seeds
# the first version through its Auth, Storage and SQL, runs the import (dry run, apply, apply
# again) and checks the result.
#
# Requirements: Docker, the Supabase CLI, psql, and the first-version checkout:
#   LEGACY_REPO_DIR=~/path/to/GuitarBuilder bash scripts/legacy-import/rehearse.sh
# Requires jq too. KEEP_STACKS=1 leaves both stacks running afterwards; REHEARSAL_UI=0 skips
# the browser check (apps/web/e2e-rehearsal), which builds the app against the v2 stack.
# V1_PORT_PREFIX and V2_PORT_PREFIX (default 585 and 575) replace the 543 of the default ports.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
: "${LEGACY_REPO_DIR:?Set LEGACY_REPO_DIR to the first-version repository checkout.}"
[[ -f "$LEGACY_REPO_DIR/supabase/config.toml" ]] || {
  echo "rehearse: $LEGACY_REPO_DIR/supabase/config.toml not found" >&2
  exit 2
}

V1_PORTS="${V1_PORT_PREFIX:-585}"
V2_PORTS="${V2_PORT_PREFIX:-575}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/gb-rehearsal.XXXXXX")"
EXCLUDED="studio,edge-runtime,logflare,vector,imgproxy,mailpit,realtime,postgres-meta,supavisor"

# A Supabase work directory for one stack: the source's migrations, its config with another
# project id and ports.
workdir() {
  local name="$1" source="$2" project="$3" ports="$4"
  local dir="$WORK/$name/supabase"
  mkdir -p "$dir"
  ln -s "$source/migrations" "$dir/migrations"
  if [[ -d "$source/templates" ]]; then ln -s "$source/templates" "$dir/templates"; fi
  sed -E -e "s/^project_id = .*/project_id = \"$project\"/" -e "s/= 543([0-9]{2})/= ${ports}\1/" \
    "$source/config.toml" >"$dir/config.toml"
  echo "$WORK/$name"
}

V1="$(workdir v1 "$LEGACY_REPO_DIR/supabase" gb-rehearsal-v1 "$V1_PORTS")"
V2="$(workdir v2 "$ROOT/supabase" gb-rehearsal-v2 "$V2_PORTS")"

cleanup() {
  if [[ "${KEEP_STACKS:-0}" == 1 ]]; then
    echo "rehearse: stacks kept; stop them with supabase stop --workdir $V1 (and $V2)"
    return
  fi
  supabase stop --workdir "$V1" --no-backup >/dev/null 2>&1 || true
  supabase stop --workdir "$V2" --no-backup >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

echo "rehearse: starting the first-version stack"
supabase start --workdir "$V1" -x "$EXCLUDED" >"$WORK/v1-start.log" 2>&1 || {
  cat "$WORK/v1-start.log" >&2
  exit 1
}
echo "rehearse: starting the v2 stack"
supabase start --workdir "$V2" -x "$EXCLUDED" >"$WORK/v2-start.log" 2>&1 || {
  cat "$WORK/v2-start.log" >&2
  exit 1
}

V1_STATUS="$(supabase status --workdir "$V1" -o json 2>/dev/null)"
V2_STATUS="$(supabase status --workdir "$V2" -o json 2>/dev/null)"
export V1_STATUS V2_STATUS
export REHEARSAL_WORK="$WORK"

node "$ROOT/scripts/legacy-import/rehearse.mts"

# Task 6.2: open what the import wrote in the v2 app built against the rehearsal's v2 stack.
if [[ "${REHEARSAL_UI:-1}" != 0 ]]; then
  echo "rehearse: opening the imported build and wood panel in the v2 app"
  REHEARSAL_SUPABASE_URL="$(jq -r .API_URL <<<"$V2_STATUS")" \
    REHEARSAL_SUPABASE_KEY="$(jq -r .PUBLISHABLE_KEY <<<"$V2_STATUS")" \
    pnpm --dir "$ROOT/apps/web" exec playwright test -c playwright.rehearsal.config.ts
fi
