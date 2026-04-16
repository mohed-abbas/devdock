---
phase: 04-web-terminal-claude-code
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - devdock-terminal.service
  - docker/base/Dockerfile
  - docker/templates/base-compose.yml
  - nginx/devdock-websocket.conf
  - package.json
  - server/__tests__/terminal-auth.test.ts
  - server/env.cjs
  - server/terminal-auth.ts
  - server/terminal-server.ts
  - server/tsconfig.json
  - src/app/api/environments/route.ts
  - src/app/api/terminal/__tests__/token.test.ts
  - src/app/api/terminal/token/route.ts
  - src/app/dashboard/_components/environment-card.tsx
  - src/app/dashboard/env/[id]/terminal/_components/reconnect-overlay.tsx
  - src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx
  - src/app/dashboard/env/[id]/terminal/_components/terminal-instance.tsx
  - src/app/dashboard/env/[id]/terminal/_components/terminal-loader.tsx
  - src/app/dashboard/env/[id]/terminal/_components/terminal-tabs.tsx
  - src/app/dashboard/env/[id]/terminal/page.tsx
  - src/components/ui/tabs.tsx
  - src/components/ui/tooltip.tsx
  - src/lib/config.ts
  - src/lib/docker/__tests__/compose-generator.test.ts
  - src/lib/docker/compose-generator.ts
  - src/lib/docker/docker-service.ts
  - src/lib/docker/types.ts
  - src/lib/terminal/types.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-16
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Phase 04 adds a browser-based terminal backed by xterm.js, Socket.IO, Docker exec, and a short-lived HMAC-signed token scheme for cross-process auth. The overall architecture is sound: auth is validated server-side before any exec is created, the token includes expiry and ownership claims, and cleanup on disconnect is wired up. There are six issues worth fixing before shipping, ranging from one critical security concern (host filesystem write exposure) down to minor bugs and info items.

---

## Critical Issues

### CR-01: Host `~/.claude` mounted read-write into container

**File:** `src/lib/docker/compose-generator.ts:673`

**Issue:** The `claudeConfigPath` volume mount is generated without the `:ro` flag, giving every dev container full write access to the host user's `~/.claude` directory. The comment in the template still says "read-only" and the test at `src/lib/docker/__tests__/compose-generator.test.ts:1633` asserts `:ro` — but the implementation omits it. A compromised or malicious workload inside a container could overwrite Claude session tokens, auth config, or project files on the host.

**Generated line (actual):**
```yaml
- /home/murx-dev/.claude:/home/dev/.claude
```
**Expected:**
```yaml
- /home/murx-dev/.claude:/home/dev/.claude:ro
```

**Fix:** Add `:ro` to the mount in `compose-generator.ts`. If Claude Code genuinely needs to write session files, mount a separate, empty, container-local directory for writes and keep the config source read-only.

```typescript
// compose-generator.ts line ~674
template = template.replace(
  /\{\{CLAUDE_CONFIG_MOUNT\}\}/g,
  `- ${claudeConfigPath}:/home/dev/.claude:ro`,
);
```

Also update the test assertion (line 1633 already expects `:ro`, so the test itself is correct — the implementation is wrong).

---

## Warnings

### WR-01: Token passed via URL query string as fallback

**File:** `server/terminal-server.ts:342-343`

**Issue:** The Socket.IO auth middleware accepts the token from `socket.handshake.query.token` as a fallback when `auth.token` is absent. Query string parameters appear in server access logs, browser history, referrer headers, and nginx proxy logs. The token is short-lived (30s) but it contains a raw Docker container ID and environment ID. The client in `terminal-client.tsx` always sends the token in the `auth` field, so the query-string path is dead code today — but it is an accident waiting to happen.

**Fix:** Remove the query string fallback entirely. The client already uses `auth: { token }` correctly.

```typescript
// terminal-server.ts
const token = socket.handshake.auth?.token as string | undefined;
if (!token) {
  return next(new Error('Authentication required'));
}
```

### WR-02: `ANTHROPIC_API_KEY` written in plaintext to `docker-compose.yml` on disk

**File:** `src/lib/docker/compose-generator.ts:683-685`, `docker/templates/base-compose.yml`

**Issue:** The Anthropic API key is substituted directly into the generated `docker-compose.yml` file at `{DEVDOCK_DATA_DIR}/{slug}/docker-compose.yml`. This file is world-readable by default (`writeFile` uses `0o666` before umask). Anyone who can read the filesystem (another process running as the same user, a compromised environment container that escapes into the data dir, a `git commit` that accidentally includes the data dir) gets the API key.

**Fix:** Use Docker secrets or an env-file approach that keeps the key out of the compose YAML itself, or at minimum set restrictive file permissions on the compose file. The lower-friction option:

```typescript
// Set file mode 0o600 so only the owner can read it
await writeFile(composePath, template, { encoding: 'utf-8', mode: 0o600 });
```

A more robust fix is to inject the key via a `.env` file alongside the compose file (also mode `0o600`) rather than embedding it in the YAML.

### WR-03: `closeTabById` called as a side effect inside `setTabs` updater

**File:** `src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx:866-875`

**Issue:** The `exec:exit` socket handler calls `closeTabById(tab.id)` from inside a `setTabs` functional updater. React updater functions must be pure — calling another state setter inside one causes nested state updates that React Strict Mode deliberately runs twice. In production this produces a race where two `closeTabById` calls fire for the same tab: the first removes it correctly; the second finds it absent and may push to `/dashboard` unexpectedly (via the `setTimeout(() => router.push(...), 0)` branch in `closeTabById`).

```typescript
// Current (buggy): side effect inside setTabs updater
socket.on('exec:exit', ({ sessionIndex }) => {
  setTabs((prev) => {
    const tab = prev.find((t) => t.sessionIndex === sessionIndex);
    if (tab) {
      closeTabById(tab.id);  // <-- side effect inside pure updater
    }
    return prev;
  });
});
```

**Fix:** Find the tab ID outside the updater, then call `closeTabById` directly:

```typescript
socket.on('exec:exit', ({ sessionIndex }) => {
  const tab = tabsRef.current.find((t) => t.sessionIndex === sessionIndex);
  if (tab) closeTabById(tab.id);
});
```

This requires keeping a `tabsRef` in sync with the `tabs` state (one line: `tabsRef.current = tabs` in the render body), which is a common pattern for stale-closure-safe event handlers.

### WR-04: `connect_error` handler reads stale `connectionState` from closure

**File:** `src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx:836-840`

**Issue:** `connect` is a `useCallback` with `[environmentId]` as the only dependency (the rest are explicitly excluded with an eslint-disable comment). The `connect_error` handler inside captures `connectionState` at closure-creation time. If the socket fires `connect_error` after the component has cycled through `connecting -> disconnected -> connecting` (e.g. on retry), the stale `connectionState` value will be `'disconnected'`, not `'connecting'`, and the guard `if (connectionState === 'connecting')` will suppress the error state update, leaving the UI stuck on the reconnect overlay indefinitely.

```typescript
// Stale closure: connectionState is always the value at connect() creation time
socket.on('connect_error', () => {
  if (connectionState === 'connecting') {   // <-- stale
    setConnectionState('disconnected');
  }
});
```

**Fix:** Remove the guard (the check is redundant since `connect_error` only fires during connection attempts), or read state via a ref:

```typescript
// Option A: just always set disconnected on connect_error
socket.on('connect_error', () => {
  setConnectionState('disconnected');
});
```

---

## Info

### IN-01: No server-side cap on `exec:create` events per socket

**File:** `server/terminal-server.ts:375`

**Issue:** The client enforces `MAX_TABS = 5` in the UI, but a malicious or buggy client can emit `exec:create` as many times as it wants. Each call spawns a new Docker exec and registers stream listeners. This is low risk for a single-user self-hosted tool, but worth noting: 100 rapid `exec:create` calls would open 100 exec sessions against the container.

**Fix:** Add a server-side guard:

```typescript
socket.on('exec:create', async (data) => {
  const sessions = socketSessions.get(socket.id) || [];
  if (sessions.length >= 5) {
    socket.emit('exec:error', { message: 'Session limit reached' });
    return;
  }
  // ... rest of handler
});
```

### IN-02: `environmentStatus` prop accepted but never used in `TerminalClient`

**File:** `src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx:751-755`

**Issue:** `TerminalClientProps` declares `environmentStatus: string` and `TerminalLoader` passes it through, but `TerminalClient` destructures only `environmentId` and `environmentName`. The prop is dead code.

**Fix:** Remove `environmentStatus` from `TerminalClientProps` and the `TerminalLoader` interface, or use it (e.g. to gate the connect attempt when status is not `running`).

---

_Reviewed: 2026-04-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
