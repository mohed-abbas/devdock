---
phase: 01-foundation-infrastructure
plan: 01
subsystem: infra
tags: [nextjs, typescript, tailwind, shadcn, drizzle, postgresql, docker, zod]

# Dependency graph
requires: []
provides:
  - "Next.js 15 application skeleton with standalone output"
  - "Drizzle ORM schema: users and environments tables"
  - "Database client singleton (drizzle + pg Pool)"
  - "Centralized config with zod validation"
  - "shadcn/ui initialized with button and card components"
  - "Root layout with Inter font and dark mode"
  - "Docker Compose for local PostgreSQL development"
affects: [02-auth, 03-docker-management, 04-web-terminal, 05-github, 06-dashboard, 07-resource-management]

# Tech tracking
tech-stack:
  added: [next@15.5.15, react@19.1.0, drizzle-orm@0.45.2, drizzle-kit@0.31.10, pg@8.20.0, dockerode@4.0.10, zod@3.25.76, nanoid@5.1.7, yaml@2.8.3, tailwindcss@4, shadcn-ui@4.2.0]
  patterns: [standalone-output, dark-mode-default, zod-env-validation, drizzle-pg-singleton, shadcn-ui-components]

key-files:
  created:
    - src/lib/db/schema.ts
    - src/lib/db/index.ts
    - src/lib/config.ts
    - drizzle.config.ts
    - .env.example
    - docker-compose.dev.yml
    - src/components/ui/button.tsx
    - src/components/ui/card.tsx
  modified:
    - package.json
    - next.config.ts
    - src/app/layout.tsx
    - src/app/page.tsx
    - .gitignore
    - src/app/globals.css

key-decisions:
  - "Pinned zod to v3.25.76 (NOT v4) for ecosystem compatibility with Auth.js and Drizzle"
  - "DATABASE_URL read directly in db/index.ts (not via config.ts) to avoid circular deps with drizzle-kit"
  - "Inter font via next/font/google as default sans-serif (matches shadcn conventions)"

patterns-established:
  - "Config pattern: zod schema validates process.env at startup in src/lib/config.ts"
  - "DB pattern: singleton Pool + Drizzle instance exported from src/lib/db/index.ts"
  - "Schema pattern: pgTable/pgEnum definitions in src/lib/db/schema.ts with typed exports"
  - "Layout pattern: dark mode via class='dark' on html, Inter font, bg-background text-foreground"
  - "Component pattern: shadcn/ui components in src/components/ui/ (copy-paste, not dependency)"

requirements-completed: [DASH-06]

# Metrics
duration: 6min
completed: 2026-04-09
---

# Phase 01 Plan 01: Next.js Scaffold Summary

**Next.js 15 skeleton with Drizzle ORM schema (users + environments), shadcn/ui design system, zod config validation, and dark-themed root page**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-09T08:15:46Z
- **Completed:** 2026-04-09T08:22:16Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Next.js 15.5.15 application scaffolded with TypeScript, Tailwind CSS v4, and standalone output for self-hosting
- Drizzle ORM schema defines users (with role enum) and environments (with status lifecycle, resource limits, activity tracking) tables
- shadcn/ui initialized with button and card foundation components, Inter font, dark mode default
- Centralized config module validates all environment variables at startup via zod

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15 project with dependencies and configuration** - `15800d6` (feat)
2. **Task 2: Create Drizzle ORM schema, database client, and app configuration** - `7b42020` (feat)

## Files Created/Modified
- `package.json` - Next.js 15 with all Phase 1 dependencies
- `next.config.ts` - Standalone output for self-hosting
- `src/app/layout.tsx` - Root layout with Inter font, dark mode, DevDock metadata
- `src/app/page.tsx` - Root page with DevDock branding per UI-SPEC
- `src/app/globals.css` - shadcn/ui CSS variables and Tailwind imports
- `src/lib/db/schema.ts` - Users and environments table definitions with enums
- `src/lib/db/index.ts` - Drizzle client singleton with pg Pool
- `src/lib/config.ts` - Centralized env var validation with zod
- `drizzle.config.ts` - Drizzle Kit configuration for migrations
- `src/components/ui/button.tsx` - shadcn button component
- `src/components/ui/card.tsx` - shadcn card component
- `src/lib/utils.ts` - shadcn utility (cn function)
- `components.json` - shadcn/ui configuration
- `.env.example` - Environment variable template
- `docker-compose.dev.yml` - Local PostgreSQL 16 for development
- `.gitignore` - Updated to protect env files and data directory

## Decisions Made
- Pinned zod to v3.25.76 instead of v4.x because the Auth.js and Drizzle ecosystem has not adopted zod v4's breaking API changes yet
- DATABASE_URL is read directly from process.env in db/index.ts rather than importing config.ts to avoid circular dependency issues when drizzle-kit loads the module independently
- Inter font selected as default sans-serif per shadcn/ui conventions and UI-SPEC

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed zod version from v4 to v3**
- **Found during:** Task 1 (dependency installation)
- **Issue:** `npm install zod` installed v4.3.6 by default; plan requires v3.x for ecosystem compatibility
- **Fix:** Ran `npm install zod@3` to install v3.25.76
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm ls zod` shows 3.25.76
- **Committed in:** 15800d6 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed .gitignore to not exclude .env.example**
- **Found during:** Task 1 (gitignore update)
- **Issue:** Scaffolded .gitignore had `.env*` pattern which would exclude `.env.example` from version control
- **Fix:** Replaced broad `.env*` with specific patterns (`.env.local`, `.env*.local`, etc.)
- **Files modified:** .gitignore
- **Verification:** `.env.example` is tracked by git, `.env.local` is excluded
- **Committed in:** 15800d6 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- `create-next-app` refused to scaffold in a directory with existing files (.planning, CLAUDE.md). Resolved by temporarily moving files to /tmp, scaffolding, then restoring.
- `create-next-app` prompted interactively for Turbopack selection. Resolved by adding `--turbopack` flag.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Application skeleton ready for Plan 02 (database setup and migrations) and Plan 03 (health check API)
- Local PostgreSQL available via `docker compose -f docker-compose.dev.yml up -d`
- Schema ready for `npx drizzle-kit generate` and `npx drizzle-kit migrate` in Plan 02

## Self-Check: PASSED

All 8 created files verified on disk. Both commit hashes (15800d6, 7b42020) found in git log.

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-04-09*
