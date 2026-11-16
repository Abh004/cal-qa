#!/usr/bin/env bash
# Starts Cal.diy + Postgres, waits until the app answers, then seeds the test host.
# Usage: npm run app:up            (CALDIY_IMAGE overrides the image under test)
set -euo pipefail
cd "$(dirname "$0")/.."

# The published amd64 image has no arm64 variant; Apple Silicon uses the "-arm" tag.
if [[ -z "${CALDIY_IMAGE:-}" ]]; then
  CALDIY_IMAGE="calcom/cal.com:v6.2.0"
  [[ "$(uname -m)" == "arm64" || "$(uname -m)" == "aarch64" ]] && CALDIY_IMAGE="${CALDIY_IMAGE}-arm"
fi
export CALDIY_IMAGE
echo "Image under test: $CALDIY_IMAGE"

docker/make-env.sh
docker compose -f docker/compose.yml up -d

# Migrations run on first start, so allow a few minutes. /auth/login answers 200
# (or 307 to /auth/setup before any user exists) once the app is serving.
url="${CAL_BASE_URL:-http://localhost:3000}/auth/login"
timeout="${APP_UP_TIMEOUT:-300}"
start=$(date +%s)
until code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "$url") && [[ "$code" == "200" || "$code" == "307" ]]; do
  if (( $(date +%s) - start > timeout )); then
    echo "Cal.diy did not answer within ${timeout}s (last HTTP code: ${code:-none})" >&2
    docker compose -f docker/compose.yml logs --tail 80 calcom >&2
    exit 1
  fi
  sleep 3
done
echo "Cal.diy is up after $(( $(date +%s) - start ))s"

docker/seed.sh
