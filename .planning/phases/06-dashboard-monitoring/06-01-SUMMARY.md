---
phase: 06-dashboard-monitoring
plan: 01
subsystem: api
tags: [drizzle, dockerode, nextjs, api-routes, preview-proxy, production-discovery]

# Dependency graph
requires:
  - phase: 03-environment-lifecycle
    provides: environments table schema, docker-service.ts, environments API
  - phase: 02-authentication
    provides: auth() session function, Auth.js setup
provides:
  - previewPort column on environments table (schema + API)
  - PRODUCTION_APPS_DIR config variable for production app discovery
  - production-discovery.ts service (discoverProductionApps, ProductionApp)
  - /api/production-apps GET endpoint (read-only, auth-protected)
  - /api/environments/[id]/preview/[...path] proxy route (all HTTP methods)
affects:
  - 06-03-dashboard-ui (consumes previewPort, production apps API, preview proxy)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "API-proxied preview: route forwards requests to container internal IP via Docker network, no nginx config needed"
    - "Graceful production discovery: returns empty array when dir unset/unreadable, never throws to caller"
    - "IDOR prevention on proxy: scope DB lookup to (envId, userId) pair"

key-files:
  created:
    - src/lib/docker/production-discovery.ts
    - src/app/api/production-apps/route.ts
    - src/app/api/environments/[id]/preview/[...path]/route.ts
  modified:
    - src/lib/db/schema.ts
    - src/lib/config.ts
    - src/app/api/environments/route.ts
    - src/hooks/use-environments.ts

key-decisions:
  - "Preview proxy uses API-proxied approach (Option A): Next.js route forwards to container internal IP, no nginx config regeneration needed"
  - "Preview proxy returns 404 (not 403) for unauthorized/missing environments to avoid information disclosure (T-06-03)"
  - "Production discovery filters out devdock- containers to prevent self-reporting"
  - "PRODUCTION_APPS_DIR empty string = feature disabled, graceful degradation on unreadable dir"

patterns-established:
  - "Preview proxy: strip cookie and authorization headers before forwarding to container apps"
  - "Production discovery: Promise.allSettled for resilience — one failing project doesn't block others"

requirements-completed: [DASH-02, DASH-03, DASH-05]

# Metrics
duration: 8min
completed: 2026-04-14
---

# Phase 6 Plan 01: Backend Foundation for Dashboard & Monitoring Summary

**previewPort schema column, API-proxied preview proxy route, and production app discovery service using Docker compose labels and internal container IPs**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-14T13:50:00Z
- **Completed:** 2026-04-14T13:58:25Z
- **Tasks:** 2
- **Files modified:** 7 (4 modified, 3 created)

## Accomplishments

- Added previewPort column to environments schema and wired it through the environments POST API and client-side Environment interface
- Created production discovery service that scans a configurable directory, queries Docker by compose project label, and returns status/uptime/ports while excluding devdock containers
- Created API-proxied preview route that authenticates, scope-checks by userId, inspects container IP via dockerode, and forwards all HTTP methods with sensitive headers stripped

## Task Commits

1. **Task 1: Schema, config, environments API, and production discovery** - `bb359cb` (feat)
2. **Task 2: Preview proxy API route** - `621c83f` (feat)

## Files Created/Modified

- `src/lib/db/schema.ts` - Added `previewPort: integer('preview_port')` column to environments table
- `src/lib/config.ts` - Added `PRODUCTION_APPS_DIR: z.string().optional().default('')`
- `src/app/api/environments/route.ts` - Added previewPort to createSchema and db.insert values
- `src/hooks/use-environments.ts` - Added `previewPort: number | null` to Environment interface
- `src/lib/docker/production-discovery.ts` - New: discoverProductionApps service with graceful degradation
- `src/app/api/production-apps/route.ts` - New: GET /api/production-apps (auth-protected, read-only)
- `src/app/api/environments/[id]/preview/[...path]/route.ts` - New: API-proxied preview route (all HTTP methods)

## Decisions Made

- Used API-proxied approach for preview (Option A from plan): forwards directly to container internal Docker network IP rather than generating nginx config entries. Simpler, no nginx reload needed, works within the existing Next.js API surface.
- Preview proxy returns 404 for unauthorized/missing/stopped environments (not 403) per T-06-03 to avoid information disclosure about whether an environment exists.
- Production discovery uses `Promise.allSettled` so a single failing project lookup does not prevent other projects from appearing.
- devdock containers are excluded from production discovery by checking compose project label prefix `devdock-`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

TypeScript compilation reported pre-existing errors in `data/` workspace directories (dev environment clones) and a pre-existing missing module error in `src/app/api/environments/[id]/logs/token/route.ts`. Neither is caused by or related to this plan's changes. All files created/modified in this plan compile cleanly.

## User Setup Required

None - no external service configuration required. `PRODUCTION_APPS_DIR` defaults to empty string (feature disabled) until set by user in environment variables.

## Next Phase Readiness

- All backend APIs needed by Plan 03 (Dashboard UI) are ready:
  - `GET /api/environments` now returns `previewPort` in each environment
  - `POST /api/environments` accepts optional `previewPort`
  - `GET /api/production-apps` returns production app list with status/uptime/ports
  - `GET|POST|PUT|PATCH|DELETE /api/environments/[id]/preview/[...path]` proxies to container
- A DB migration is needed to add the `preview_port` column before deployment (not in plan scope — handled at deploy time via `drizzle-kit push` or migration)

---
*Phase: 06-dashboard-monitoring*
*Completed: 2026-04-14*
