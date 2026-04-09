---
phase: 02-authentication
plan: 01
subsystem: auth
tags: [next-auth, auth.js-v5, bcrypt, jwt, credentials, middleware, edge-runtime, rate-limit]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: "PostgreSQL users table schema, Drizzle ORM, config.ts env validation, Next.js 15 App Router"
provides:
  - "Auth.js v5 configured with Credentials provider and JWT sessions"
  - "Edge-safe auth config split (auth.config.ts + auth.ts)"
  - "Middleware protecting /dashboard/* and /api/* routes"
  - "Server actions for login (with rate limiting) and logout"
  - "In-memory rate limiter (5 attempts / 30s cooldown)"
  - "TypeScript type augmentation for session.user.id and session.user.role"
  - "API route handler at /api/auth/[...nextauth]"
affects: [02-authentication, 03-dashboard, 06-dashboard-ui]

# Tech tracking
tech-stack:
  added: [next-auth@5.0.0-beta.30, bcrypt@6.0.0, "@types/bcrypt@6.0.0", vitest@4.1.4]
  patterns: [edge-runtime-split, server-actions-for-auth, in-memory-rate-limiting, tdd-red-green]

key-files:
  created:
    - src/auth.config.ts
    - src/auth.ts
    - src/middleware.ts
    - src/app/api/auth/[...nextauth]/route.ts
    - src/lib/auth/actions.ts
    - src/lib/auth/rate-limit.ts
    - types/next-auth.d.ts
    - tests/auth/rate-limit.test.ts
  modified:
    - src/lib/config.ts
    - .env.example
    - package.json

key-decisions:
  - "Migrated NEXTAUTH_SECRET to AUTH_SECRET and NEXTAUTH_URL to AUTH_URL for Auth.js v5 convention"
  - "Native bcrypt (not bcryptjs) since it only runs in Node.js authorize function, never in Edge middleware"
  - "Installed vitest as test framework (TDD requirement, was a Wave 0 gap)"

patterns-established:
  - "Edge Runtime Split: auth.config.ts (edge-safe, no DB/bcrypt) for middleware; auth.ts (full Node.js) for API routes and server components"
  - "Server Actions for Auth: login/logout as 'use server' functions in src/lib/auth/actions.ts"
  - "Rate Limiter Pattern: In-memory Map with per-username tracking, configurable attempts and cooldown"
  - "TDD with vitest: tests in tests/ directory, write failing tests first then implement"

requirements-completed: [AUTH-01, AUTH-02, AUTH-04]

# Metrics
duration: 5min
completed: 2026-04-09
---

# Phase 02 Plan 01: Auth Backend Summary

**Auth.js v5 with edge-safe split pattern, Credentials provider (bcrypt + DB), JWT 7-day sessions, route-protecting middleware, login/logout server actions, and in-memory rate limiter**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-09T15:40:11Z
- **Completed:** 2026-04-09T15:45:22Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Auth.js v5 installed and configured with Credentials provider using bcrypt password verification and Drizzle DB lookup
- Edge-safe split pattern established: middleware imports only auth.config.ts (no bcrypt/pg/drizzle in Edge Runtime)
- Middleware protects /dashboard/* and /api/* routes, excludes /api/auth/* and /api/health
- Server actions for login (generic error messages per D-04, rate limit messaging) and logout (redirect to /login per D-17)
- In-memory rate limiter: 5 failed attempts triggers 30-second cooldown per username
- TypeScript type augmentation adds id and role to Session and JWT interfaces
- 5 passing unit tests for rate limiter (TDD: red-green flow)

## Task Commits

Each task was committed atomically:

1. **Task 0 (TDD RED): Failing rate limiter tests** - `9bf885f` (test)
2. **Task 1: Install Auth.js + bcrypt, create auth config split, API route, type augmentation** - `e458f40` (feat)
3. **Task 2: Create middleware, server actions, and extended rate limiter tests** - `bb6f4fb` (feat)

_Note: TDD RED commit (test) precedes the GREEN implementation commit (feat)_

## Files Created/Modified
- `src/auth.config.ts` - Edge-safe auth config: authorized callback, JWT 7-day sessions, /login page
- `src/auth.ts` - Full auth config: Credentials provider with bcrypt + DB + rate limiting, JWT/session callbacks
- `src/middleware.ts` - Route protection middleware importing only auth.config.ts
- `src/app/api/auth/[...nextauth]/route.ts` - Auth.js API route handler exporting GET/POST
- `src/lib/auth/actions.ts` - Server actions: login (with rate limit + generic error) and logout
- `src/lib/auth/rate-limit.ts` - In-memory rate limiter: 5 attempts, 30s cooldown, per-username tracking
- `types/next-auth.d.ts` - TypeScript augmentation for id and role on Session/JWT
- `tests/auth/rate-limit.test.ts` - 5 unit tests for rate limiter
- `src/lib/config.ts` - Migrated NEXTAUTH_SECRET to AUTH_SECRET, NEXTAUTH_URL to AUTH_URL
- `.env.example` - Updated env var names to Auth.js v5 convention
- `package.json` - Added next-auth, bcrypt, @types/bcrypt, vitest

## Decisions Made
- Migrated from NEXTAUTH_SECRET/NEXTAUTH_URL to AUTH_SECRET/AUTH_URL (Auth.js v5 convention, clean break)
- Used native bcrypt (not bcryptjs) since authorize function runs only in Node.js, never in Edge middleware
- Installed vitest as test framework to satisfy TDD requirement (was listed as Wave 0 gap in research)
- Used `satisfies NextAuthConfig` for type safety without widening the type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed vitest test framework**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** No test framework installed (identified as Wave 0 gap in research). TDD requirement could not proceed.
- **Fix:** Installed vitest@4.1.4 as devDependency
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx vitest run` executes tests successfully
- **Committed in:** e458f40 (Task 1 commit)

**2. [Rule 3 - Blocking] Updated .env.local to match new AUTH_SECRET naming**
- **Found during:** Task 1 (config migration)
- **Issue:** .env.local still had NEXTAUTH_SECRET (31 chars, under minimum). Config.ts now validates AUTH_SECRET.
- **Fix:** Renamed vars in .env.local and extended secret to 34 chars to pass min(32) validation
- **Files modified:** .env.local (not committed, gitignored)
- **Verification:** `npm run build` passes, config validates successfully
- **Committed in:** N/A (.env.local is gitignored)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for TDD execution and build success. No scope creep.

## Issues Encountered
None -- plan executed smoothly with only the expected Wave 0 gap (vitest) requiring resolution.

## User Setup Required
None -- no external service configuration required. Users must ensure their `.env.local` uses `AUTH_SECRET` (not `NEXTAUTH_SECRET`) with a value of at least 32 characters. The `.env.example` has been updated with the correct variable names.

## Next Phase Readiness
- Auth backend is complete and ready for Plan 02 (login UI with form integration)
- Server actions (login/logout) are ready to be called from React form components
- Middleware is active and will redirect unauthenticated users to /login
- /api/health remains accessible without authentication
- Plan 03 (seed script + dashboard placeholder) can proceed after Plan 02

## Self-Check: PASSED

All 8 created files verified present on disk. All 3 commits (9bf885f, e458f40, bb6f4fb) verified in git log.

---
*Phase: 02-authentication*
*Completed: 2026-04-09*
