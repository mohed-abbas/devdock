#!/bin/bash
# tests/entrypoint.test.sh
# Runs scripts/entrypoint-app.sh against a throwaway postgres and asserts:
#   1. drizzle-kit push succeeds on empty DB
#   2. seed-admin-boot.ts inserts one admin on first run (ADMIN_USERNAME + ADMIN_PASSWORD_HASH provided)
#   3. Re-running does NOT create a duplicate user (idempotent guard works)
# Deliberately RED until Plan 04 creates the entrypoint.
set -euo pipefail

ENTRYPOINT="scripts/entrypoint-app.sh"

echo "[$(date -Iseconds)] entrypoint.test: checking ${ENTRYPOINT}"

if [ ! -x "${ENTRYPOINT}" ]; then
  echo "[$(date -Iseconds)] entrypoint.test: FAIL — ${ENTRYPOINT} not found or not executable (Plan 04 must create it)"
  exit 1
fi

# Throwaway postgres for the test
CONTAINER_NAME="devdock-entrypoint-test-pg"
trap 'docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true' EXIT

docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run -d --name "${CONTAINER_NAME}" \
  -e POSTGRES_USER=devdock \
  -e POSTGRES_PASSWORD=testpw \
  -e POSTGRES_DB=devdock \
  -p 127.0.0.1:55432:5432 \
  postgres:16-alpine >/dev/null

# Wait for postgres to become ready
for i in {1..30}; do
  if docker exec "${CONTAINER_NAME}" pg_isready -U devdock -d devdock >/dev/null 2>&1; then break; fi
  sleep 1
done

# Precomputed bcrypt hash of "test-password-123" at rounds=12 (stable for the test)
TEST_HASH='$2b$12$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ1234567'

export DATABASE_URL="postgresql://devdock:testpw@127.0.0.1:55432/devdock"
export ADMIN_USERNAME="entrypoint-test-admin"
export ADMIN_PASSWORD_HASH="${TEST_HASH}"

# Run entrypoint twice with a no-op CMD to exercise migrations + seed
echo "[$(date -Iseconds)] entrypoint.test: first run"
"${ENTRYPOINT}" /bin/true

echo "[$(date -Iseconds)] entrypoint.test: second run (idempotency check)"
"${ENTRYPOINT}" /bin/true

# Assert exactly one admin user exists
COUNT=$(docker exec "${CONTAINER_NAME}" psql -U devdock -d devdock -t -A -c "SELECT count(*) FROM users WHERE username='entrypoint-test-admin'")
if [ "${COUNT}" != "1" ]; then
  echo "[$(date -Iseconds)] entrypoint.test: FAIL — expected 1 admin row, found ${COUNT}"
  exit 1
fi

echo "[$(date -Iseconds)] entrypoint.test: PASS"
