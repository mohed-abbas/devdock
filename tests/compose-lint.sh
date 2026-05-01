#!/bin/bash
# tests/compose-lint.sh
# Validates docker-compose.yml + docker-compose.override.yml syntax and interpolation.
# Exits 0 on success. Deliberately RED until Plan 05 creates the compose files.
set -euo pipefail

COMPOSE_FILE="docker-compose.yml"
OVERRIDE_FILE="docker-compose.override.yml"

echo "[$(date -Iseconds)] compose-lint: validating ${COMPOSE_FILE}"

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "[$(date -Iseconds)] compose-lint: FAIL — ${COMPOSE_FILE} not found (Plan 05 must create it)"
  exit 1
fi

# docker compose config validates syntax + env-var interpolation
docker compose -f "${COMPOSE_FILE}" config >/dev/null
echo "[$(date -Iseconds)] compose-lint: ${COMPOSE_FILE} OK"

if [ -f "${OVERRIDE_FILE}" ]; then
  echo "[$(date -Iseconds)] compose-lint: validating ${COMPOSE_FILE} + ${OVERRIDE_FILE}"
  docker compose -f "${COMPOSE_FILE}" -f "${OVERRIDE_FILE}" config >/dev/null
  echo "[$(date -Iseconds)] compose-lint: merged config OK"
fi

echo "[$(date -Iseconds)] compose-lint: PASS"
