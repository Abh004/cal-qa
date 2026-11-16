#!/usr/bin/env bash
# Creates the test host (qa-host) and its 30-minute event in the running Cal.diy container.
set -euo pipefail
cd "$(dirname "$0")"
docker compose exec -T calcom sh -c \
  'cp /seed/seed-qa.ts /calcom/scripts/seed-qa.ts && cd /calcom && npx ts-node --transpile-only scripts/seed-qa.ts'
