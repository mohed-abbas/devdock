---
phase: 06-dashboard-monitoring
plan: 05
subsystem: terminal-server
tags: [logs, terminal, socket.io, gap-closure]
dependency_graph:
  requires: [06-02, 06-03]
  provides: [log-streaming-from-exec]
  affects: [logs-page]
tech_stack:
  added: []
  patterns: [socket.io-room-broadcast, cross-namespace-forwarding]
key_files:
  modified:
    - server/terminal-server.ts
decisions:
  - "Cross-namespace forwarding via Socket.IO rooms keyed by containerId — auth-gated on both sides, no cross-container leakage"
  - "Exec output forwarded after existing exec:output emit — single chunk.toString() call reused"
  - "Existing container.logs() streaming preserved alongside exec forwarding"
metrics:
  duration: ~5min
  completed: 2026-04-16
  tasks_completed: 1
  tasks_total: 2
  files_modified: 1
---

# Phase 06 Plan 05: Bridge Exec Output to Logs Namespace Summary

**One-liner:** Cross-namespace exec output forwarding from /terminal to /logs via Socket.IO rooms keyed by containerId.

## What Was Built

Container PID 1 runs `sleep infinity` which produces no stdout/stderr, making the logs page permanently empty. This plan bridges the gap: exec session output from the /terminal namespace is now broadcast to /logs namespace subscribers watching the same container.

**Changes to `server/terminal-server.ts`:**

1. In `logsNs.on('connection')`: added `socket.join(`container:${containerId}`)` before the Docker logs setup so each /logs subscriber joins the container-keyed room.

2. In `terminalNs.on('connection')`, inside the `stream.on('data')` callback: added `logsNs.to(`container:${containerId}`).emit('logs:data', { data: chunk.toString('utf-8') })` after the existing `socket.emit('exec:output', ...)` call.

Both /terminal and /logs sockets are HMAC-token authenticated, so a subscriber can only join/receive the room matching their token's containerId — no cross-container leakage.

## Tasks

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | Bridge exec output from /terminal to /logs namespace | Complete | bff8fcb |
| 2 | Verify log streaming from terminal sessions | Checkpoint — awaiting human verify | — |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The forwarding is fully wired. The logs:data event shape `{ data: string }` matches what LogsClient already handles.

## Threat Flags

No new threat surface introduced beyond what the plan's threat model covers. Both endpoints are auth-gated with the same HMAC token verification.

## Self-Check: PASSED

- server/terminal-server.ts modified: FOUND
- Commit bff8fcb: FOUND (git rev-parse HEAD)
- logsNs.to reference present in modified file: FOUND
- socket.join reference present in modified file: FOUND
