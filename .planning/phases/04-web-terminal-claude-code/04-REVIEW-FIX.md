---
phase: 04-web-terminal-claude-code
fixed_at: 2026-04-16T00:00:00Z
review_path: .planning/phases/04-web-terminal-claude-code/04-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-04-16
**Source review:** .planning/phases/04-web-terminal-claude-code/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Host `~/.claude` mounted read-write into container

**Files modified:** `src/lib/docker/compose-generator.ts`
**Commit:** 41d6895
**Applied fix:** Added `:ro` suffix to the Claude config volume mount string so the host `~/.claude` directory is mounted read-only into containers. Updated the comment to reflect the read-only intent.

### WR-01: Token passed via URL query string as fallback

**Files modified:** `server/terminal-server.ts`
**Commit:** f86558f
**Applied fix:** Removed the `socket.handshake.query?.token` fallback from the Socket.IO auth middleware. Token is now only accepted from `socket.handshake.auth?.token`, preventing accidental exposure in server logs and browser history.

### WR-02: ANTHROPIC_API_KEY written in plaintext to docker-compose.yml

**Files modified:** `src/lib/docker/compose-generator.ts`
**Commit:** b0cb10d
**Applied fix:** Changed the `writeFile` call for the compose file from a plain `'utf-8'` encoding string to an options object with `{ encoding: 'utf-8', mode: 0o600 }`, restricting the generated docker-compose.yml to owner-only read/write permissions.

### WR-03: closeTabById called inside setTabs updater

**Files modified:** `src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx`
**Commit:** 7a253b3
**Applied fix:** Added a `tabsRef` (kept in sync with `tabs` state on every render) and rewrote the `exec:exit` handler to read the tab from `tabsRef.current` instead of calling `closeTabById` as a side effect inside a `setTabs` functional updater. This eliminates the nested state update that React Strict Mode would trigger twice.

### WR-04: Stale connectionState closure in connect_error handler

**Files modified:** `src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx`
**Commit:** edea168
**Applied fix:** Removed the `if (connectionState === 'connecting')` guard from the `connect_error` handler. The guard read a stale closure value since `connect` only depends on `[environmentId]`. The `connect_error` event only fires during connection attempts, so unconditionally setting `'disconnected'` is correct behavior.

---

_Fixed: 2026-04-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
