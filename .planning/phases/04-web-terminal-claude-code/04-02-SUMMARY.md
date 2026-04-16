---
phase: 04-web-terminal-claude-code
plan: 02
subsystem: terminal-server
tags: [socket-io, terminal-auth, hmac-tokens, systemd, nginx, websocket]
dependency_graph:
  requires: [terminal-types, docker-exec, terminal-token-api]
  provides: [terminal-server, signed-token-auth, websocket-proxy]
  affects: [token-route, terminal-types, vitest-config]
tech_stack:
  added: []
  patterns: [hmac-signed-tokens, socket-io-namespace, exec-session-bridging]
key_files:
  created:
    - server/terminal-server.ts
    - server/terminal-auth.ts
    - server/tsconfig.json
    - server/__tests__/terminal-auth.test.ts
    - devdock-terminal.service
    - nginx/devdock-websocket.conf
  modified:
    - src/app/api/terminal/token/route.ts
    - src/lib/terminal/types.ts
    - src/app/api/terminal/__tests__/token.test.ts
    - package.json
    - vitest.config.ts
decisions:
  - HMAC-SHA256 signed tokens replace in-memory token store for cross-process auth between Next.js and Socket.IO server
  - Terminal server matches existing devdock.service patterns (User murx-dev, ProtectSystem strict, SupplementaryGroups docker)
  - Vitest config extended to include server/**/*.test.ts pattern
metrics:
  duration: 2min
  completed: "2026-04-13T16:16:30Z"
  tasks: 2
  files: 11
---

# Phase 04 Plan 02: Socket.IO Terminal Server Summary

Standalone Socket.IO terminal server on 127.0.0.1:3001 bridging xterm.js WebSocket connections to Docker exec PTY sessions, with HMAC-SHA256 signed token auth replacing in-memory token store for cross-process compatibility.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | aec603e | Socket.IO terminal server with HMAC-signed token auth |
| 2 | 332cb9c | systemd service and nginx WebSocket proxy config |

## What Was Built

### Task 1: Socket.IO Terminal Server and Signed Token Auth

- Created `server/terminal-server.ts`: standalone Express + Socket.IO server binding to 127.0.0.1:3001 with `/terminal` namespace and `/ws/socket.io` path
- Created `server/terminal-auth.ts`: HMAC-SHA256 signed token creation/verification with timing-safe comparison and expiry checking
- Created `server/tsconfig.json`: TypeScript config for standalone server directory (ES2022 target, bundler moduleResolution)
- Socket.IO auth middleware validates signed tokens before WebSocket upgrade
- Event handlers: `exec:create` (spawns PTY via createExecSession), `exec:input` (pipes to stdin), `exec:resize` (updates PTY dimensions with bounds clamping 1-500 cols, 1-200 rows), `exec:output` (streams to browser), `exec:exit` (notifies session end)
- Disconnect handler destroys all exec streams per socket (Pitfall 2 cleanup)
- Updated `src/app/api/terminal/token/route.ts`: replaced nanoid + storeToken with createSignedToken import from server/terminal-auth.ts
- Removed `storeToken`, `validateTerminalToken`, `cleanupExpiredTokens`, and in-memory `tokenStore` from `src/lib/terminal/types.ts` (kept type interfaces)
- Updated Plan 01 token tests: replaced storeToken/validateTerminalToken unit tests with signed-token format and verification tests
- Added `terminal:dev` script to package.json
- Extended vitest.config.ts to include `server/**/*.test.ts`
- 9 tests passing: 6 terminal-auth tests + 3 token integration tests

### Task 2: systemd Service and nginx Config

- Created `devdock-terminal.service` matching existing devdock.service patterns (User=murx-dev, ProtectSystem=strict, SupplementaryGroups=docker)
- Depends on devdock.service (After + Requires), restarts on failure with 5s delay
- 256M memory limit (lighter than main service's 512M)
- Created `nginx/devdock-websocket.conf` snippet for /ws/ location block with WebSocket upgrade headers and 24h read/send timeout

## Test Results

All 9 tests passing across 2 test files:
- `server/__tests__/terminal-auth.test.ts`: 6 tests (token format, valid/expired/tampered/garbage/empty verification)
- `src/app/api/terminal/__tests__/token.test.ts`: 3 tests (signed token format, verifiability, expiry rejection)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended vitest.config.ts include pattern**
- **Found during:** Task 1
- **Issue:** Vitest config only included `src/**` patterns, so `server/__tests__/*.test.ts` was not discoverable
- **Fix:** Added `server/**/*.test.ts` to the vitest include array
- **Files modified:** `vitest.config.ts`
- **Commit:** aec603e

## Known Stubs

None -- all data paths are wired and functional.

## Self-Check: PASSED

All 6 created files verified present. All 2 commits verified in git log.
