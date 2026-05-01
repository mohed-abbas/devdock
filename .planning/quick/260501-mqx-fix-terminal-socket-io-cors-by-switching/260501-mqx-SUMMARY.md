---
phase: 260501-mqx
plan: 01
subsystem: terminal
tags: [socket.io, cors, caddy, websocket, terminal, logs, bind-host]
dependency_graph:
  requires: []
  provides: [same-origin Socket.IO connection through Caddy /ws/* proxy, terminal server reachable from sibling containers]
  affects: [terminal-client, logs-client, terminal-server]
tech_stack:
  added: []
  patterns: [same-origin Socket.IO fallback via empty-string URL, env-driven listen host for compose-friendly bind]
key_files:
  created: []
  modified:
    - src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx
    - src/app/dashboard/env/[id]/logs/_components/logs-client.tsx
    - server/terminal-server.ts
decisions:
  - Same-origin fallback (empty string) for Socket.IO instead of hardcoded localhost:3001 — socket.io-client uses window.location origin when URL is empty, routing through Caddy /ws/* proxy which is the only published port (8080)
  - Bind terminal server to 0.0.0.0 (configurable via TERMINAL_HOST) instead of 127.0.0.1 — the previous loopback bind was inherited from the pre-Phase-999.2 host-running layout where 127.0.0.1 was the security boundary; now that the service runs in a container with no published port, the compose network itself is the boundary, so binding 0.0.0.0 lets sibling containers (Caddy) connect while host remains unable to reach it
metrics:
  duration: ~8min
  completed: 2026-05-01
---

# Quick Task 260501-mqx: Fix Terminal Socket.IO CORS by Switching to Same-Origin

**One-liner:** Changed Socket.IO fallback URL from `http://localhost:3001` to `''` so the browser routes WebSocket connections through Caddy on port 8080 instead of the unpublished port 3001, eliminating CORS and unreachable-port errors.

## What Was Done

Both client files had a hardcoded fallback of `http://localhost:3001` in their `terminalServerUrl` declaration. Port 3001 is only reachable internally within the Docker Compose network — Caddy on `127.0.0.1:8080` is the only published host endpoint. The cross-origin fallback caused two failures:

1. CORS error: browser on `http://localhost:8080` making request to `http://localhost:3001` (different port = different origin)
2. Connection failure: port 3001 is not published, so even without CORS the connection would fail

**Fix:** Replace `'http://localhost:3001'` with `''`. When socket.io-client receives an empty string as the URL (or a bare namespace like `'' + '/terminal'`), it derives the origin from `window.location`. Combined with `path: '/ws/socket.io'`, the actual request becomes `ws://localhost:8080/ws/socket.io` — which Caddy's existing `/ws/*` handle already proxies to `terminal:3001` internally.

An explicit `NEXT_PUBLIC_TERMINAL_URL` env var still overrides via the `||` short-circuit, preserving backward compatibility.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Switch terminal + logs Socket.IO fallback to same-origin | a9a10b9 | terminal-client.tsx, logs-client.tsx |
| 2 | Rebuild app image (NEXT_PUBLIC_ baked at build time) | (build only, no source change) | devdock-app image |
| 3 (cascade) | Bind terminal server to 0.0.0.0 so Caddy can reach it | 93e2a08 | server/terminal-server.ts |
| 4 (cascade) | Rebuild + recreate terminal image with new bind | (build + recreate) | devdock-terminal image |

## Deviations from Plan

**Cascade fix uncovered during verification (Rule 3 deviation, auto-fixed):** After the Task 1+2 patch landed, browser verification showed Socket.IO requests now correctly hit `localhost:8080/ws/socket.io` (CORS gone), but xterm still displayed "Connection lost". Caddy logs revealed every connect attempt as `dial tcp 172.20.0.5:3001: connect: connection refused` (status 502). Root cause: `server/terminal-server.ts:263` hardcoded `httpServer.listen(PORT, '127.0.0.1', ...)` — only loopback inside the terminal container, unreachable from the Caddy container even on the same compose network.

The 127.0.0.1 bind dated from the pre-containerization layout where the terminal server ran on the host alongside Next.js and loopback was the security boundary. Once Phase 999.2 moved it into its own container with no published port, the compose network became the security boundary — binding 0.0.0.0 lets Caddy connect while the host still cannot reach 3001 (no `ports:` mapping).

**Decision:** Apply the bind fix in the same quick task rather than spawn a new one — same root incident (terminal connectivity), same fix-and-verify cycle, surfaced during this task's verification. Added env override (`TERMINAL_HOST`) so the server can still be pinned to loopback when running outside compose.

## Known Stubs

None.

## Threat Flags

None — no new network surface introduced. The 0.0.0.0 bind only widens reachability inside the existing compose network (`devdock-net`); the host port mapping is unchanged (terminal has no `ports:` entry, only Caddy publishes to 127.0.0.1:8080). Same security envelope as before.

## Verification (Claude-in-Chrome E2E)

- Navigated to `http://localhost:8080/dashboard/env/.../terminal` after both rebuilds
- Resource Timing shows 5/5 Socket.IO requests succeeded with `transferSize > 0` (was 0 before)
- 0 requests to `localhost:3001`, all 6 to `localhost:8080`
- xterm rendered the bash prompt: `dev@96e54a03f80f:/workspace$` with the standard sudo banner
- Caddy access logs show 200/101 (WebSocket upgrade) instead of 502
- terminal-server log line: `DevDock terminal server listening on 0.0.0.0:3001`

## Self-Check: PASSED

- [x] `terminal-client.tsx` line 73: `process.env.NEXT_PUBLIC_TERMINAL_URL || ''`
- [x] `logs-client.tsx` line 64: `process.env.NEXT_PUBLIC_TERMINAL_URL || ''`
- [x] Neither file contains `localhost:3001`
- [x] `terminal-server.ts` binds via `process.env.TERMINAL_HOST || '0.0.0.0'`
- [x] Commits a9a10b9 + 93e2a08 exist
- [x] `docker compose build app` and `docker compose build terminal` both succeeded
- [x] Live browser session shows working terminal prompt
