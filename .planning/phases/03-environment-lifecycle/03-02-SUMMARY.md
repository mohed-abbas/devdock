---
phase: 03-environment-lifecycle
plan: 02
subsystem: api
tags: [nextjs-api-routes, zod, drizzle, docker, auth, rest]

# Dependency graph
requires:
  - phase: 03-environment-lifecycle
    provides: Docker service module (composeUp/Stop/Down, getProjectStatus, cloneRepo, removeDataDir), types, compose generator
  - phase: 02-authentication
    provides: Auth.js auth() session helper, middleware route protection
provides:
  - Environment CRUD API routes (list, create, get, delete)
  - Environment lifecycle API routes (start, stop)
  - Slug generation and validation utility
  - Background Docker operation pattern (non-blocking 202 responses)
affects: [03-environment-lifecycle, 04-web-terminal]

# Tech tracking
tech-stack:
  added: []
  patterns: [async-params for Next.js 15 App Router, Promise.resolve().then for non-blocking background ops, userId-scoped queries for IDOR prevention]

key-files:
  created:
    - src/lib/docker/slug.ts
    - src/app/api/environments/route.ts
    - src/app/api/environments/[id]/route.ts
    - src/app/api/environments/[id]/start/route.ts
    - src/app/api/environments/[id]/stop/route.ts
  modified: []

key-decisions:
  - "Promise.resolve().then() pattern for background Docker ops to avoid blocking HTTP 202 responses"
  - "Two separate queries for running+starting count instead of SQL IN on enum (simpler Drizzle API)"
  - "Docker state reconciliation on GET requests to catch out-of-band status changes"

patterns-established:
  - "Pattern: Background Docker operations via Promise.resolve().then() -- return 202 immediately, update DB on completion/failure"
  - "Pattern: Every API route starts with auth() check returning 401 if no session"
  - "Pattern: Every DB query scoped by eq(environments.userId, session.user.id) to prevent IDOR"
  - "Pattern: Status transition guards before state-changing operations (start requires stopped/error, stop requires running, delete rejects starting/stopping)"
  - "Pattern: Next.js 15 async params: type Params = { params: Promise<{ id: string }> }"

requirements-completed: [ENV-01, ENV-02, ENV-03, ENV-04, ENV-05, ENV-06, ENV-07]

# Metrics
duration: 4min
completed: 2026-04-10
---

# Phase 03 Plan 02: Environment API Routes Summary

**REST API routes for environment CRUD and lifecycle (create/list/get/delete/start/stop) with auth, IDOR prevention, concurrent limits, and background Docker operations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T12:23:14Z
- **Completed:** 2026-04-10T12:50:58Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created all 6 environment API endpoints (GET list, POST create, GET single, DELETE, POST start, POST stop) across 4 route files
- Every route enforces authentication via auth() and authorization via userId-scoped DB queries
- POST create and POST start check DEVDOCK_MAX_CONCURRENT_ENVS before proceeding (T-03-08)
- Background Docker operations return 202 immediately and update DB status asynchronously
- Input validation with zod on creation, slug validation before Docker/filesystem use (T-03-07)
- Docker state reconciliation on GET requests catches out-of-band status changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Slug utility and environment list/create API routes** - `caed263` (feat)
2. **Task 2: Single environment, delete, start, and stop API routes** - `d4873d9` (feat)

## Files Created/Modified
- `src/lib/docker/slug.ts` - generateSlug and isValidSlug for URL-safe Docker project names
- `src/app/api/environments/route.ts` - GET (list with reconciliation) and POST (create with background start)
- `src/app/api/environments/[id]/route.ts` - GET (single with reconciliation) and DELETE (full cleanup)
- `src/app/api/environments/[id]/start/route.ts` - POST start with concurrent limit check
- `src/app/api/environments/[id]/stop/route.ts` - POST stop with background compose stop

## Decisions Made
- Used `Promise.resolve().then()` for background Docker operations -- simpler than task queues for single-VPS use case, returns 202 immediately per D-04
- Two separate DB queries for running + starting environment count instead of SQL IN operator on enum -- Drizzle API is simpler this way and performance difference is negligible for small counts
- Docker state reconciliation happens on every GET request for running/starting environments -- catches Docker crashes or manual interventions without requiring a separate polling service

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All environment API routes ready for dashboard UI consumption (Plan 03-03)
- Slug utility available for any component needing environment name sanitization
- Background operation pattern established for reuse in future lifecycle operations
- Docker socket access still needed before integration testing (documented in Plan 01 summary)

## Self-Check: PENDING

---
*Phase: 03-environment-lifecycle*
*Completed: 2026-04-10*
