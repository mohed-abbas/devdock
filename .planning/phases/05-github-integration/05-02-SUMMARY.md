---
phase: 05-github-integration
plan: 02
subsystem: api
tags: [oauth, github, octokit, encryption, docker, git-clone, caching]

requires:
  - phase: 05-github-integration-01
    provides: "GitHub OAuth helpers, encryption, client factory, DB schema"
provides:
  - "OAuth authorize/callback flow for GitHub account connection"
  - "GitHub disconnect and connection status endpoints"
  - "Repo listing API with 5-min in-memory cache"
  - "Branch listing API for specific repos"
  - "Token-aware cloneRepo with branch support and error sanitization"
affects: [06-ui-github-settings, environment-creation-ui]

tech-stack:
  added: []
  patterns: ["in-memory cache with TTL per user", "auto-disconnect on GitHub 401", "token sanitization in error paths"]

key-files:
  created:
    - src/app/api/github/authorize/route.ts
    - src/app/api/github/callback/route.ts
    - src/app/api/github/disconnect/route.ts
    - src/app/api/github/connection/route.ts
    - src/app/api/github/repos/route.ts
    - src/app/api/github/repos/[owner]/[repo]/branches/route.ts
    - src/app/api/github/__tests__/repos.test.ts
  modified:
    - src/lib/docker/docker-service.ts
    - src/lib/docker/__tests__/docker-service.test.ts
    - src/app/api/environments/route.ts

key-decisions:
  - "In-memory Map cache for repos (5min TTL) -- simplest approach for single-process Next.js"
  - "Auto-disconnect on GitHub 401 to handle revoked/expired tokens gracefully"
  - "Dynamic import for decrypt in environments route to avoid circular deps"

patterns-established:
  - "GitHub API route pattern: auth check, config check, DB lookup, Octokit call, error handling with 401 auto-disconnect"
  - "Token sanitization: replaceAll(token, '***') before any error storage or response"

requirements-completed: [AUTH-05, GH-01, GH-02, GH-05]

duration: 3min
completed: 2026-04-14
---

# Phase 05 Plan 02: GitHub API Routes Summary

**OAuth flow, repo/branch listing with cache, and token-aware cloneRepo with error sanitization**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-14T09:25:13Z
- **Completed:** 2026-04-14T09:28:42Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Complete OAuth authorize/callback flow with CSRF state validation via httpOnly cookie (sameSite:lax)
- Six GitHub API routes: authorize, callback, disconnect, connection, repos, branches
- cloneRepo extended with branch and token support; tokens never leak in error messages
- Repo listing with in-memory cache (5min TTL) and auto-disconnect on expired tokens
- Environments POST route now passes branch and decrypted GitHub token to cloneRepo

## Task Commits

Each task was committed atomically:

1. **Task 1: OAuth routes and clone modification** - `d9a2f48` (feat)
2. **Task 2: Repo listing and branch listing with caching** - `eaa186b` (feat)

## Files Created/Modified
- `src/app/api/github/authorize/route.ts` - OAuth initiation, sets state cookie, redirects to GitHub
- `src/app/api/github/callback/route.ts` - OAuth callback, validates state, encrypts and stores token
- `src/app/api/github/disconnect/route.ts` - Deletes github_accounts row for user
- `src/app/api/github/connection/route.ts` - Returns GitHub connection status
- `src/app/api/github/repos/route.ts` - Paginated repo listing with 5min cache
- `src/app/api/github/repos/[owner]/[repo]/branches/route.ts` - Branch listing for specific repo
- `src/app/api/github/__tests__/repos.test.ts` - Tests for repo mapping, cache, and 401 handling
- `src/lib/docker/docker-service.ts` - cloneRepo now accepts branch and token params
- `src/lib/docker/__tests__/docker-service.test.ts` - 7 new tests for token auth, branch, sanitization
- `src/app/api/environments/route.ts` - Passes branch and GitHub token to cloneRepo

## Decisions Made
- In-memory Map cache for repos (5min TTL) -- simplest approach for single-process Next.js, no Redis needed
- Auto-disconnect on GitHub 401 to handle revoked/expired tokens without user confusion
- Dynamic import for decrypt in environments route to keep import graph clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. GitHub OAuth credentials were configured in Plan 01.

## Next Phase Readiness
- All server-side GitHub integration routes are complete
- Ready for UI integration (settings page GitHub connection, repo picker in environment creation)
- Pre-existing test failure in compose-generator.test.ts (from Phase 04) is unrelated to this plan

---
*Phase: 05-github-integration*
*Completed: 2026-04-14*
