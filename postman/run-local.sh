#!/usr/bin/env bash
# Full local run: creates the throwaway claims, runs the collection, always removes the claims.
# Extra arguments go to Newman. Exits with Newman's status.
set -u
cd "$(dirname "$0")/.."
export DATABASE_URL="${NEWMAN_DATABASE_URL:-postgresql://admin:password@localhost:5432/smart_reimburse}"

fixtures() { (cd backend && uv run --quiet python -m seeds.newman_fixtures "$1"); }

trap 'fixtures down' EXIT
fixtures up || exit 1
npx --yes newman@6 run postman/reclaim-pay.postman_collection.json \
  -e postman/env.local.json --env-var require_fixtures=true --timeout-request 40000 "$@"
