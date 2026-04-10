---
phase: 03-environment-lifecycle
plan: 01
subsystem: docker
tags: [docker, dockerode, compose, typescript, vitest, child_process]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: Docker base image Dockerfile, base-compose.yml template, config module, schema
provides:
  - Docker TypeScript types (EnvironmentStatus, ComposeOptions, DockerServiceResult, ContainerInfo, EnvironmentStatusResult)
  - Compose file generator with sidecar uncommenting
  - Docker service module wrapping lifecycle operations (up/stop/down/status/clone/remove)
  - Vitest configuration with path aliases
  - Schema errorMessage column for error state tracking
  - Config DEVDOCK_DATA_DIR absolute path resolution
affects: [03-environment-lifecycle, 04-web-terminal]

# Tech tracking
tech-stack:
  added: []
  patterns: [execFile-not-exec for shell injection prevention, vi.hoisted for vitest mock factories, template string substitution for compose generation]

key-files:
  created:
    - src/lib/docker/types.ts
    - src/lib/docker/compose-generator.ts
    - src/lib/docker/docker-service.ts
    - src/lib/docker/__tests__/types-config.test.ts
    - src/lib/docker/__tests__/compose-generator.test.ts
    - src/lib/docker/__tests__/docker-service.test.ts
    - vitest.config.ts
  modified:
    - src/lib/db/schema.ts
    - src/lib/config.ts

key-decisions:
  - "Used vi.hoisted() for mock functions in vitest to avoid factory hoisting issues"
  - "Error messages truncated to 500 chars before storage per T-03-04"
  - "Shallow clone (--depth 1) for repo cloning speed"
  - "Line-by-line uncommenting for sidecar sections instead of regex-based approach for reliability"

patterns-established:
  - "Pattern: execFile with argument arrays for all CLI operations (never exec with string interpolation)"
  - "Pattern: vi.hoisted() + vi.mock() for modules requiring constructor mocking (dockerode)"
  - "Pattern: Static imports from mocked modules instead of dynamic imports per test for vitest"
  - "Pattern: Docker service as thin wrapper -- API routes never call child_process or dockerode directly"

requirements-completed: [ENV-01, ENV-02, ENV-03, ENV-04, ENV-05, ENV-06]

# Metrics
duration: 8min
completed: 2026-04-10
---

# Phase 03 Plan 01: Docker Backend Foundation Summary

**Docker types, compose generator with sidecar uncommenting, and lifecycle service module with 23 passing unit tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-10T08:00:46Z
- **Completed:** 2026-04-10T08:08:24Z
- **Tasks:** 3 (of 4 -- Task 0 Docker prerequisite deferred)
- **Files modified:** 9

## Accomplishments
- Created complete TypeScript type system for environment operations (5 types/interfaces + runtime validator)
- Built compose generator that handles template variable substitution and conditional sidecar uncommenting for postgres/redis
- Built Docker service module wrapping all lifecycle operations (up/stop/down/status/clone/remove) with proper error handling
- Established vitest infrastructure with path aliases matching tsconfig
- Added errorMessage column to schema and fixed config to resolve relative paths to absolute

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, schema update, config fix, and test infrastructure** - `eeac129` (feat)
2. **Task 2: Compose generator with sidecar uncommenting and unit tests** - `9a4d6f9` (feat)
3. **Task 3: Docker service module with lifecycle operations and unit tests** - `55864dd` (feat)

_Note: Task 0 (Docker socket prerequisite) was deferred -- docker ps returns permission denied. All code tasks proceeded with mocked tests._

## Files Created/Modified
- `src/lib/docker/types.ts` - EnvironmentStatus, ComposeOptions, DockerServiceResult, ContainerInfo, EnvironmentStatusResult types
- `src/lib/docker/compose-generator.ts` - Template variable substitution + sidecar uncommenting + workspace dir creation
- `src/lib/docker/docker-service.ts` - composeUp/Stop/Down, getProjectStatus, cloneRepo, removeDataDir
- `src/lib/docker/__tests__/types-config.test.ts` - 3 tests for types and config path resolution
- `src/lib/docker/__tests__/compose-generator.test.ts` - 10 tests for compose generation
- `src/lib/docker/__tests__/docker-service.test.ts` - 10 tests for docker service operations
- `vitest.config.ts` - Test framework config with @ path alias
- `src/lib/db/schema.ts` - Added errorMessage column to environments table
- `src/lib/config.ts` - Added path.resolve() for DEVDOCK_DATA_DIR

## Decisions Made
- Used `vi.hoisted()` pattern for vitest mock factories to handle mock hoisting correctly -- `vi.fn()` declarations at module scope are not available inside `vi.mock()` factories without this
- Error messages from Docker stderr truncated to 500 characters before storage (per T-03-04 threat mitigation)
- Line-by-line section uncommenting for compose template instead of regex-based approach -- more reliable with YAML indentation sensitivity
- Static module imports with `vi.mock()` instead of dynamic `await import()` per test -- simpler and avoids module cache timing issues

## Deviations from Plan

### Task 0 Docker Prerequisite (Deferred)

**Docker socket access is denied.** The `docker ps` command fails with "permission denied" because `mohed_abbas` is not in the docker group. This is documented in RESEARCH.md as a known blocker.

**Impact:** Tasks 1-3 proceeded successfully because all tests use mocked Docker calls. The Docker socket prerequisite must be resolved before integration testing in Plan 03-04. No code changes are blocked by this.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed vitest mock hoisting with vi.hoisted()**
- **Found during:** Task 3 (Docker service tests)
- **Issue:** `vi.mock()` factories are hoisted to top of file and cannot reference `const` declarations
- **Fix:** Used `vi.hoisted()` to declare mock functions before hoisting
- **Files modified:** src/lib/docker/__tests__/docker-service.test.ts
- **Verification:** All 10 tests pass
- **Committed in:** 55864dd (Task 3 commit)

**2. [Rule 3 - Blocking] Fixed dockerode mock to be a class constructor**
- **Found during:** Task 3 (Docker service tests)
- **Issue:** `new Docker()` requires a constructor, `vi.fn().mockImplementation()` is not a constructor
- **Fix:** Used `class MockDocker { listContainers = mockListContainers }` in mock factory
- **Files modified:** src/lib/docker/__tests__/docker-service.test.ts
- **Verification:** All 10 tests pass
- **Committed in:** 55864dd (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking), 1 deferred (Docker prerequisite)
**Impact on plan:** Auto-fixes were necessary for test infrastructure correctness. Docker prerequisite is a known pre-condition that does not block code implementation.

## Issues Encountered
- Docker socket permission denied (expected, documented in RESEARCH.md as known blocker)
- Vitest mock hoisting requires `vi.hoisted()` pattern when mock factories reference external variables

## User Setup Required

Docker socket access must be configured before integration testing. The user needs to run:
```bash
sudo groupadd docker 2>/dev/null || true
sudo usermod -aG docker mohed_abbas
sudo snap connect docker:docker-daemon
newgrp docker
```

## Next Phase Readiness
- All Docker backend modules are ready for API route consumption (Plan 03-02)
- Types define the contract for all downstream consumers
- Docker socket access must be resolved before Plan 03-04 integration checkpoint
- Schema migration (drizzle-kit push for errorMessage column) needed in Plan 03-04

## Self-Check: PASSED

All 7 created files exist. All 3 task commits verified. Schema errorMessage column and config path.resolve confirmed.

---
*Phase: 03-environment-lifecycle*
*Completed: 2026-04-10*
