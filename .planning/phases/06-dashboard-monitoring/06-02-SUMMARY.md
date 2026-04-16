---
phase: 06-dashboard-monitoring
plan: 02
subsystem: terminal-server, ui
tags: [socket.io, docker-logs, xterm, streaming, websocket]

# Dependency graph
requires:
  - phase: 04-web-terminal-claude-code
    provides: terminal-server.ts, terminal-auth.ts (HMAC token pattern), Socket.IO infrastructure
  - phase: 03-environment-lifecycle
    provides: environments table, docker-service.ts (findDevContainerId)
provides:
  - Socket.IO /logs namespace on terminal server (HMAC auth, Docker log streaming with demux)
  - /api/environments/[id]/logs/token POST endpoint
  - /dashboard/env/[id]/logs page (server + client components)
affects:
  - 06-03-dashboard-ui (environment card gets Logs button linking to this page)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Docker log demux via docker.modem.demuxStream() prevents binary garbage in stdout/stderr"
    - "Reuse terminal server Socket.IO instance for /logs namespace — single process, shared auth pattern"
    - "Client-side ANSI stripping with regex — no external dependency needed"

key-files:
  created:
    - src/app/api/environments/[id]/logs/token/route.ts
    - src/app/dashboard/env/[id]/logs/page.tsx
    - src/app/dashboard/env/[id]/logs/_components/logs-loader.tsx
    - src/app/dashboard/env/[id]/logs/_components/logs-client.tsx
  modified:
    - server/terminal-server.ts

key-decisions:
  - "Reuse terminal server for log streaming — /logs namespace alongside /terminal, same HMAC token auth"
  - "Strip ANSI codes client-side with regex — simpler than rendering, sufficient for log viewing"
  - "5000-line browser buffer cap to prevent memory exhaustion (T-06-09)"
  - "tail: 200 lines on connect for immediate context without overwhelming the client"

patterns-established:
  - "Socket.IO namespace reuse: add namespaces to existing server rather than creating new servers"
  - "Log stream cleanup: destroy Docker stream + PassThrough on socket disconnect"

requirements-completed: [DASH-04]

# Metrics
duration: 4min
completed: 2026-04-14
---

# Phase 6 Plan 02: Container Log Streaming Summary

**Socket.IO /logs namespace with HMAC auth, Docker log demux, and full-screen logs page with auto-scroll and connection state overlays**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-14T13:50:00Z
- **Completed:** 2026-04-14T14:02:00Z
- **Tasks:** 2
- **Files modified:** 5 (1 modified, 4 created)

## Accomplishments

- Added /logs namespace to terminal-server.ts with HMAC token auth middleware (same pattern as /terminal namespace), Docker log streaming with demuxStream, tail: 200 history, and cleanup on disconnect
- Created logs token API route mirroring terminal token pattern with IDOR prevention (userId scoped)
- Built full-screen logs page: server component with auth/ownership guards, dynamic import wrapper (ssr: false), and LogsClient with auto-scroll toggle, clear button, ANSI stripping, 5000-line buffer cap, and connection state overlays

## Task Commits

1. **Task 1: Socket.IO /logs namespace and logs token API** - `9b1b0d3` (feat)
2. **Task 2: Logs page UI** - `e14b73c` (feat)

## Files Created/Modified

- `server/terminal-server.ts` - Added /logs namespace with auth middleware, Docker log streaming, demux, cleanup
- `src/app/api/environments/[id]/logs/token/route.ts` - New: POST endpoint for HMAC log stream tokens
- `src/app/dashboard/env/[id]/logs/page.tsx` - New: server component with auth, env lookup, running check
- `src/app/dashboard/env/[id]/logs/_components/logs-loader.tsx` - New: dynamic import wrapper (ssr: false)
- `src/app/dashboard/env/[id]/logs/_components/logs-client.tsx` - New: log viewer with Socket.IO, auto-scroll, connection states

## Decisions Made

- Reused terminal server's Socket.IO instance for /logs namespace rather than creating a separate server — reduces operational surface and shares the same HMAC auth pattern
- ANSI codes stripped client-side with simple regex rather than rendering them — sufficient for log viewing, avoids external dependency
- 5000-line cap in browser memory prevents DoS from high-volume container output
- tail: 200 provides immediate context on connect without overwhelming initial render

## Deviations from Plan

None — plan executed as written.

## Issues Encountered

Agent 06-02 hit a tool permission boundary on the final commit. Files were created correctly but required manual commit by the orchestrator.

## Next Phase Readiness

- Logs page is ready for Plan 03 to add the Logs button to environment cards (link to /dashboard/env/[id]/logs)
- Log streaming infrastructure is complete and ready for human verification in Plan 04

---
*Phase: 06-dashboard-monitoring*
*Completed: 2026-04-14*
