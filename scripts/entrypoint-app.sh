#!/bin/bash
# scripts/entrypoint-app.sh — DevDock `app` service entrypoint (Phase 999.2)
#
# Runs as root initially so it can:
#   1. Wait for postgres to be reachable (`pg_isready`)
#   2. Fix up the docker socket group (runtime GID detection — RESEARCH.md §3)
#   3. Run drizzle-kit push (BLOCKING: schema push requirement for this phase)
#   4. Run seed-admin-boot.ts (idempotent; guarded on empty users table)
#   5. `exec gosu nextjs "$@"` — drop privileges and start the Next.js server
#
# Security:
#   - Never log the value of ADMIN_PASSWORD_HASH, POSTGRES_PASSWORD, AUTH_SECRET
#   - drizzle-kit push runs WITHOUT the force flag (T-999.2-06 mitigation): if drizzle
#     prompts for destructive confirmation, it exits non-zero on non-TTY —
#     fail-closed is the desired behavior. Change schema evolution policy in the
#     OSS distribution phase (switch to `drizzle-kit migrate` with committed SQL).
#   - GID fixup is idempotent: `getent group` checks before adding.
set -euo pipefail

log() { echo "[$(date -Iseconds)] entrypoint-app: $*"; }

log "starting (pid $$)"

# ---- Step 1: Wait for postgres -------------------------------------------------
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-devdock}"
POSTGRES_DB_NAME="${POSTGRES_DB:-devdock}"
POSTGRES_WAIT_TIMEOUT="${POSTGRES_WAIT_TIMEOUT:-60}"

log "waiting for postgres at ${POSTGRES_HOST} (timeout=${POSTGRES_WAIT_TIMEOUT}s)"
elapsed=0
until pg_isready -h "${POSTGRES_HOST}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB_NAME}" >/dev/null 2>&1; do
  if [ "${elapsed}" -ge "${POSTGRES_WAIT_TIMEOUT}" ]; then
    log "postgres not ready after ${POSTGRES_WAIT_TIMEOUT}s — giving up"
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done
log "postgres ready after ${elapsed}s"

# ---- Step 2: Docker socket GID fixup ------------------------------------------
# If the socket is mounted, ensure `nextjs` can read it. No-op if not mounted
# (covers `terminal`-only deployments or dev runs without docker.sock).
SOCK=/var/run/docker.sock
if [ -S "${SOCK}" ]; then
  DOCKER_SOCK_GID=$(stat -c '%g' "${SOCK}")
  log "detected docker socket gid=${DOCKER_SOCK_GID}"
  # Prefer explicit DOCKER_GID env var; fall back to detected.
  TARGET_GID="${DOCKER_GID:-$DOCKER_SOCK_GID}"
  if ! getent group "${TARGET_GID}" >/dev/null 2>&1; then
    groupadd --gid "${TARGET_GID}" docker-host || log "warning: groupadd failed (gid=${TARGET_GID}); continuing"
  fi
  GROUP_NAME=$(getent group "${TARGET_GID}" | cut -d: -f1)
  if [ -n "${GROUP_NAME}" ]; then
    usermod -aG "${GROUP_NAME}" nextjs || log "warning: usermod failed; continuing"
    log "added nextjs to group ${GROUP_NAME} (gid=${TARGET_GID})"
  fi
else
  log "no docker socket at ${SOCK} — skipping GID fixup"
fi

# ---- Step 3: drizzle-kit push (BLOCKING schema push) --------------------------
# Runs NON-interactively. On a blank DB (fresh volume), no prompts. On schema
# changes that require data-loss confirmation, drizzle-kit exits non-zero on
# non-TTY — which aborts boot (fail-closed per T-999.2-06).
log "running drizzle-kit push"
# npx finds drizzle-kit in ./node_modules/.bin (Plan 03 Dockerfile copied it there).
npx --no-install drizzle-kit push --config=drizzle.config.ts
log "drizzle-kit push complete"

# ---- Step 4: Admin seed (idempotent) ------------------------------------------
# Runs seed-admin-boot.ts (Plan 02) — NO-OP when ADMIN_* unset or when users table
# already has rows. Never logs the hash value itself.
if [ -n "${ADMIN_USERNAME:-}" ] && [ -n "${ADMIN_PASSWORD_HASH:-}" ]; then
  log "running admin seed (ADMIN_USERNAME set)"
else
  log "admin seed SKIPPED (ADMIN_USERNAME or ADMIN_PASSWORD_HASH unset)"
fi
# Always invoke — the script itself prints "skipping seed" when appropriate.
npx --no-install tsx src/scripts/seed-admin-boot.ts
log "admin seed step complete"

# ---- Step 5: Drop privileges and exec CMD -------------------------------------
# Ensure nextjs user owns the writable dirs it needs. The standalone output was
# chowned at COPY time (Plan 03 Dockerfile); .next/cache must exist and be writable.
mkdir -p .next/cache
chown -R nextjs:nodejs .next/cache 2>/dev/null || true

log "dropping privileges to nextjs; exec $*"
exec gosu nextjs "$@"
