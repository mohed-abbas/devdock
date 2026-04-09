---
phase: 01-foundation-infrastructure
plan: 02
subsystem: infra
tags: [docker, dockerfile, compose, nginx, systemd, cleanup, ubuntu]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure-01
    provides: "Project scaffolding and directory structure"
provides:
  - "Base dev container Dockerfile (Ubuntu 24.04 with Node.js, Python, Claude Code CLI)"
  - "Docker Compose template for per-project environment provisioning"
  - "Docker daemon log rotation config"
  - "Nginx reverse proxy server block with HTTPS and WebSocket support"
  - "systemd service file for DevDock process management"
  - "Threshold-based Docker cleanup script"
affects: [docker-management, environment-lifecycle, deployment, terminal-websocket]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Per-project Docker Compose isolation with named networks", "Template-based Compose generation with variable substitution", "Progressive Docker cache cleanup (dangling -> containers -> build cache -> aggressive)"]

key-files:
  created:
    - docker/base/Dockerfile
    - docker/base/entrypoint.sh
    - docker/templates/base-compose.yml
    - docker/daemon.json
    - deploy/nginx/devdock.conf
    - deploy/systemd/devdock.service
    - scripts/docker-cleanup.sh
  modified: []

key-decisions:
  - "Non-root dev user with configurable UID/GID in Dockerfile for host volume permission matching"
  - "No published ports on any Compose service -- internal network only (INFRA-05)"
  - "Network NOT internal:true so containers can access internet for npm install/git clone"
  - "Progressive cleanup strategy: dangling images -> stopped containers -> build cache -> aggressive system prune"

patterns-established:
  - "Docker socket isolation: socket never referenced in Dockerfile or Compose template"
  - "Per-project network naming: devdock-{slug}-net"
  - "Container naming: devdock-{slug}-{service}"
  - "Template variables: {{PROJECT_SLUG}}, {{BASE_IMAGE}}, {{HOST_UID}}, {{HOST_GID}}"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05]

# Metrics
duration: 2min
completed: 2026-04-09
---

# Phase 1 Plan 2: Docker Infrastructure & Deployment Config Summary

**Base Ubuntu 24.04 dev container with Claude Code CLI, per-project Compose template with sidecar support, nginx HTTPS proxy with WebSocket upgrade, systemd service with 512MB memory cap, and threshold-based Docker cleanup at 80% disk usage**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-09T08:25:01Z
- **Completed:** 2026-04-09T08:27:51Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments
- Base dev container Dockerfile builds from Ubuntu 24.04 with Node.js 22, Python 3, Git, SSH, common CLIs, and Claude Code CLI pre-installed, with non-root user matching host UID/GID
- Docker Compose template provides per-project isolation with optional Postgres/Redis sidecars on dedicated bridge networks, zero published ports, and no Docker socket access
- Nginx reverse proxy configuration handles HTTPS termination, WebSocket upgrade for terminal connections, security headers, and SSR streaming
- systemd service runs DevDock as murx-dev user with MemoryMax=512M, NoNewPrivileges, and ProtectSystem=strict
- Docker cleanup script implements progressive threshold-based pruning (dangling images, stopped containers, build cache, then aggressive system prune) when disk usage exceeds 80%

## Task Commits

Each task was committed atomically:

1. **Task 1: Create base dev container Dockerfile and entrypoint** - `b41c850` (feat)
2. **Task 2: Create Compose template, daemon config, nginx config, systemd service, and Docker cleanup script** - `5fb4fbe` (feat)

## Files Created/Modified
- `docker/base/Dockerfile` - Ubuntu 24.04 base dev container with Node.js, Python, Claude Code CLI, non-root user
- `docker/base/entrypoint.sh` - Container entrypoint that keeps container alive for docker exec
- `docker/templates/base-compose.yml` - Template for per-project Docker Compose environments with optional sidecars
- `docker/daemon.json` - Docker daemon log rotation config (max-size 10m, max-file 3)
- `deploy/nginx/devdock.conf` - Nginx reverse proxy with HTTPS, WebSocket upgrade, security headers
- `deploy/systemd/devdock.service` - systemd unit file running as murx-dev with memory limits and security hardening
- `scripts/docker-cleanup.sh` - Threshold-based Docker cache cleanup script (80% disk usage trigger)

## Decisions Made
- Non-root `dev` user with configurable UID/GID build args to prevent volume permission mismatches (Pitfall #9)
- Docker socket intentionally excluded from all container configs -- only API server process has access (INFRA-04, Pitfall #1)
- No `ports:` directive on any Compose service -- all services communicate on internal project network only (INFRA-05, Pitfall #8)
- Network is NOT `internal: true` because containers need internet access for npm install, git clone (Pitfall #6)
- Progressive cleanup strategy in docker-cleanup.sh: start conservative (dangling), escalate to aggressive (system prune) only if still over threshold

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. These are template/config files that will be deployed to the VPS in a later phase.

## Next Phase Readiness
- Docker infrastructure templates ready for the environment lifecycle management module
- Nginx config ready to be symlinked on VPS deployment
- systemd service ready for production deployment
- Phase 7 resource management can add mem_limit/cpus to the Compose template where marked

## Self-Check: PASSED

All 7 created files verified present. Both task commits (b41c850, 5fb4fbe) verified in git log.

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-04-09*
