---
phase: 06-dashboard-monitoring
plan: 03
subsystem: ui
tags: [nextjs, react, shadcn, lucide, dashboard, production-monitoring]

# Dependency graph
requires:
  - phase: 06-dashboard-monitoring
    plan: 01
    provides: previewPort field on environments API, /api/production-apps, preview proxy route
  - phase: 06-dashboard-monitoring
    plan: 02
    provides: /dashboard/env/[id]/logs page
provides:
  - Enhanced environment card with Logs and Preview buttons
  - Preview Port field in create environment dialog
  - useProductionApps polling hook
  - ProductionAppCard read-only component with Production badge
  - ProductionAppList conditional grid component
  - Restructured dashboard with Dev Environments + Production Apps sections
affects:
  - dashboard UX (users can now access logs and previews from cards)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Production section self-manages separator: Separator + heading live inside ProductionAppList so returning null hides both"
    - "Preview link uses <a> not Next.js Link for target=_blank support"
    - "mapStatus helper bridges ProductionApp status (running/stopped/partial) to EnvironmentStatus for StatusBadge reuse"

key-files:
  created:
    - src/hooks/use-production-apps.ts
    - src/app/dashboard/_components/production-app-card.tsx
    - src/app/dashboard/_components/production-app-list.tsx
  modified:
    - src/app/dashboard/_components/environment-card.tsx
    - src/app/dashboard/_components/create-environment-dialog.tsx
    - src/app/dashboard/_components/environment-list.tsx
    - src/app/dashboard/page.tsx

key-decisions:
  - "ProductionAppList includes its own Separator so returning null cleanly hides both the divider and the section"
  - "Preview button uses plain <a> tag with target=_blank rather than Next.js Link (Link does not support target=_blank cleanly)"
  - "mapStatus maps partial -> starting (amber) since StatusBadge has no partial variant and amber is the right semantic for degraded state"

requirements-completed: [DASH-01, DASH-03]

# Metrics
duration: 15min
completed: 2026-04-14
---

# Phase 6 Plan 03: Dashboard UI Layer Summary

**Environment cards enhanced with Logs (ScrollText) and Preview (ExternalLink) buttons, create dialog gains optional Preview Port field, and new read-only Production Apps section added below Dev Environments with polling hook and conditional rendering**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-14T14:00:00Z
- **Completed:** 2026-04-14T14:16:24Z
- **Tasks:** 2
- **Files modified:** 7 (4 modified, 3 created)

## Accomplishments

- Added Preview button (ExternalLink icon, new tab) and Logs button (ScrollText icon) to environment cards in correct UI-SPEC order (Preview, Logs, Terminal, Start, Stop, Delete)
- Added optional Preview Port number input to create environment dialog with client-side validation (1–65535), helper text, and integration into API POST body
- Created `useProductionApps` hook mirroring `useEnvironments` pattern with 5s polling, visibilityState check, and enabled flag for graceful degradation
- Created `ProductionAppCard` as a read-only card with Production badge (blue), status badge, formatted uptime, and exposed ports — no action buttons per D-04
- Created `ProductionAppList` that returns null when apps array is empty or feature disabled (D-05), with Separator and heading self-contained so they disappear together
- Renamed "Environments" section heading to "Dev Environments" per UI-SPEC copywriting contract
- Restructured dashboard page to render EnvironmentList + ProductionAppList

## Task Commits

1. **Task 1: Environment card enhancements and create dialog preview port field** - `f5a6ce8`
2. **Task 2: Production app components, hook, and dashboard page restructure** - `021635f`

## Files Created/Modified

- `src/app/dashboard/_components/environment-card.tsx` - Added ScrollText, ExternalLink imports; Preview button (running + previewPort); Logs button (running)
- `src/app/dashboard/_components/create-environment-dialog.tsx` - Added previewPort state, Preview Port input field, port validation, previewPort in API body
- `src/hooks/use-production-apps.ts` - New: polling hook for /api/production-apps with enabled flag
- `src/app/dashboard/_components/production-app-card.tsx` - New: read-only card with Production badge, uptime formatter, status mapping
- `src/app/dashboard/_components/production-app-list.tsx` - New: conditional grid with Separator, returns null when empty
- `src/app/dashboard/_components/environment-list.tsx` - Renamed "Environments" -> "Dev Environments" in both heading occurrences
- `src/app/dashboard/page.tsx` - Added ProductionAppList import and render

## Decisions Made

- ProductionAppList includes its own Separator so returning null cleanly hides the divider and the section together, implementing D-05 without any conditional logic in the parent page.
- Preview button uses a plain `<a>` tag with `target="_blank"` rather than Next.js `Link` — Next.js Link does not cleanly support `target="_blank"` and the preview URL goes through the API proxy (not a client-side route).
- `mapStatus` maps `partial` -> `starting` (amber dot + "Starting" label) for the production card StatusBadge, as amber is the correct semantic for a degraded/partial state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken import/identifier in environment-list.tsx from overly broad replace_all**

- **Found during:** Task 2
- **Issue:** `replace_all` on "Environments" replaced occurrences inside `useEnvironments` and the hook call `useEnvironments()`, breaking the file with parse errors (`useDev Environments`)
- **Fix:** Restored both `useEnvironments` identifiers to their correct names while keeping the heading text updated to "Dev Environments"
- **Files modified:** `src/app/dashboard/_components/environment-list.tsx`
- **Commit:** `021635f` (fix applied within same task commit)

## Known Stubs

None — all data flows are wired to real APIs (useProductionApps -> /api/production-apps, environment card buttons -> real routes from Plan 01 and Plan 02).

## Threat Flags

None — no new network endpoints or auth paths introduced. All UI components consume existing Plan 01 APIs.

## Self-Check: PASSED

- `src/hooks/use-production-apps.ts` — FOUND
- `src/app/dashboard/_components/production-app-card.tsx` — FOUND
- `src/app/dashboard/_components/production-app-list.tsx` — FOUND
- Commit `f5a6ce8` — FOUND
- Commit `021635f` — FOUND
- `grep 'Dev Environments' environment-list.tsx` — FOUND (2 occurrences)
- `grep 'ProductionAppList' page.tsx` — FOUND
- `grep 'ScrollText' environment-card.tsx` — FOUND
- `grep 'Preview Port' create-environment-dialog.tsx` — FOUND
- `npx tsc --noEmit` (src/ only) — PASSED (0 errors)
