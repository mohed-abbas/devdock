#!/bin/bash
# scripts/entrypoint-terminal.sh — DevDock `terminal` service entrypoint (Phase 999.2)
#
# Lighter than entrypoint-app.sh — the terminal server has NO database access
# (RESEARCH.md Open Questions #6, verified in server/terminal-server.ts).
# Only responsibility: docker-socket GID fixup, then drop privileges and exec CMD.
set -euo pipefail

log() { echo "[$(date -Iseconds)] entrypoint-terminal: $*"; }

log "starting (pid $$)"

SOCK=/var/run/docker.sock
if [ -S "${SOCK}" ]; then
  DOCKER_SOCK_GID=$(stat -c '%g' "${SOCK}")
  log "detected docker socket gid=${DOCKER_SOCK_GID}"
  TARGET_GID="${DOCKER_GID:-$DOCKER_SOCK_GID}"
  if ! getent group "${TARGET_GID}" >/dev/null 2>&1; then
    groupadd --gid "${TARGET_GID}" docker-host || log "warning: groupadd failed (gid=${TARGET_GID}); continuing"
  fi
  GROUP_NAME=$(getent group "${TARGET_GID}" | cut -d: -f1)
  if [ -n "${GROUP_NAME}" ]; then
    usermod -aG "${GROUP_NAME}" termuser || log "warning: usermod failed; continuing"
    log "added termuser to group ${GROUP_NAME} (gid=${TARGET_GID})"
  fi
else
  log "no docker socket at ${SOCK} — skipping GID fixup"
fi

log "dropping privileges to termuser; exec $*"
exec gosu termuser "$@"
