#!/usr/bin/env bash
# Regenerates src/database.types.ts from the local Supabase stack.
# Requires the Supabase CLI and a running stack (`supabase start` or `supabase db start`).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
command -v supabase >/dev/null || {
  echo "gen-types: install the Supabase CLI (https://supabase.com/docs/guides/local-development/cli/getting-started)" >&2
  exit 1
}
supabase gen types typescript --local --schema public > packages/db/src/database.types.ts
echo "gen-types: wrote packages/db/src/database.types.ts (review the diff and run pnpm format)"
