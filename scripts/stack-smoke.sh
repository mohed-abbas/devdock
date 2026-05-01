#!/bin/bash
# scripts/stack-smoke.sh
# Boots the full DevDock compose stack, waits for all healthchecks, probes each service.
# Deliberately RED until Plan 05 creates docker-compose.yml.
set -euo pipefail

COMPOSE_FILE="docker-compose.yml"
CADDY_PORT="${CADDY_INTERNAL_PORT:-8080}"

echo "[$(date -Iseconds)] stack-smoke: starting"

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "[$(date -Iseconds)] stack-smoke: FAIL — ${COMPOSE_FILE} not found (Plan 05 must create it)"
  exit 1
fi

trap 'docker compose -f "${COMPOSE_FILE}" down -v >/dev/null 2>&1 || true' EXIT

echo "[$(date -Iseconds)] stack-smoke: docker compose up -d --build --wait"
docker compose -f "${COMPOSE_FILE}" up -d --build --wait

echo "[$(date -Iseconds)] stack-smoke: probing app :3000 /api/health"
docker compose -f "${COMPOSE_FILE}" exec -T app wget -qO- http://localhost:3000/api/health | grep -q '"status":"ok"'

echo "[$(date -Iseconds)] stack-smoke: probing terminal :3001 /health"
docker compose -f "${COMPOSE_FILE}" exec -T terminal wget -qO- http://localhost:3001/health | grep -q '"status":"ok"'

echo "[$(date -Iseconds)] stack-smoke: probing caddy :2019 /config/"
docker compose -f "${COMPOSE_FILE}" exec -T app wget -qO- http://caddy:2019/config/ | head -c 20

echo "[$(date -Iseconds)] stack-smoke: probing caddy :${CADDY_PORT} (from host)"
curl -fsS -o /dev/null -w "caddy-public-status=%{http_code}\n" "http://127.0.0.1:${CADDY_PORT}/api/health"

echo "[$(date -Iseconds)] stack-smoke: probing postgres via app container"
docker compose -f "${COMPOSE_FILE}" exec -T app pg_isready -h postgres -U devdock -d devdock

echo "[$(date -Iseconds)] stack-smoke: PASS"
