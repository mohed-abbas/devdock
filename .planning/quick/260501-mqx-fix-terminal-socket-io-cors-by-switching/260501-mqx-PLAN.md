---
phase: 260501-mqx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx
  - src/app/dashboard/env/[id]/logs/_components/logs-client.tsx
autonomous: false
requirements:
  - QUICK-260501-MQX
must_haves:
  truths:
    - "Browser opens terminal page and Socket.IO connects without CORS errors"
    - "Network panel shows Socket.IO requests going to ws://localhost:8080/ws/socket.io (NOT localhost:3001)"
    - "xterm shows a live shell prompt instead of 'Connection lost — The terminal session could not be restored.'"
    - "Logs page also streams via the same same-origin Caddy route"
    - "Setting NEXT_PUBLIC_TERMINAL_URL still overrides the same-origin default (backward compatible)"
  artifacts:
    - path: "src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx"
      provides: "Terminal Socket.IO client using same-origin fallback"
      contains: "process.env.NEXT_PUBLIC_TERMINAL_URL || ''"
    - path: "src/app/dashboard/env/[id]/logs/_components/logs-client.tsx"
      provides: "Logs Socket.IO client using same-origin fallback"
      contains: "process.env.NEXT_PUBLIC_TERMINAL_URL || ''"
  key_links:
    - from: "browser (window.location origin = http://localhost:8080)"
      to: "terminal:3001"
      via: "Caddy /ws/* reverse_proxy"
      pattern: "ws://localhost:8080/ws/socket.io"
---

<objective>
Fix the "Cross-Origin Request Blocked" error that breaks terminal and live-log streaming. The Socket.IO clients currently fall back to `http://localhost:3001`, a port that is NOT published by docker-compose (only Caddy on `127.0.0.1:8080` is reachable from the host). Change the fallback to an empty string so socket.io-client uses the page origin (`http://localhost:8080`), which Caddy already proxies to `terminal:3001` via the existing `/ws/*` route.

Purpose: Restore terminal + live logs in the dashboard. No env-var configuration required for the default Caddy setup; explicit `NEXT_PUBLIC_TERMINAL_URL` still wins for non-Caddy dev setups.

Output: Two patched client components + a rebuilt `app` image (because `NEXT_PUBLIC_*` is baked at Next.js build time).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@Caddyfile
@src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx
@src/app/dashboard/env/[id]/logs/_components/logs-client.tsx

<interfaces>
<!-- Caddy already routes the Socket.IO path. Client just needs to use same-origin. -->

From Caddyfile (verified):
```
:8080 {
    handle /ws/* {
        reverse_proxy terminal:3001
    }
    handle {
        reverse_proxy app:3000
    }
}
```

From terminal-client.tsx (current, line 73):
```ts
const terminalServerUrl = process.env.NEXT_PUBLIC_TERMINAL_URL || 'http://localhost:3001';
const socket = io(`${terminalServerUrl}/terminal`, {
  path: '/ws/socket.io',
  auth: { token },
  ...
});
```

From logs-client.tsx (current, line 64):
```ts
const terminalServerUrl = process.env.NEXT_PUBLIC_TERMINAL_URL || 'http://localhost:3001';
const socket = io(`${terminalServerUrl}/logs`, {
  path: '/ws/socket.io',
  ...
});
```

socket.io-client behavior: when the URL passed is empty / a bare namespace (e.g. `io('/terminal', opts)` or `io('' + '/terminal', opts)`), it derives the origin from `window.location`. Combined with `path: '/ws/socket.io'`, the actual request becomes `ws://<page-host>/ws/socket.io/?EIO=4&...` — which Caddy proxies to `terminal:3001`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Switch terminal + logs Socket.IO fallback to same-origin</name>
  <files>src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx, src/app/dashboard/env/[id]/logs/_components/logs-client.tsx</files>
  <action>
In BOTH files, change the fallback in the `terminalServerUrl` declaration from `'http://localhost:3001'` to `''` (empty string).

terminal-client.tsx (line 73):
```ts
// Before
const terminalServerUrl = process.env.NEXT_PUBLIC_TERMINAL_URL || 'http://localhost:3001';
// After
const terminalServerUrl = process.env.NEXT_PUBLIC_TERMINAL_URL || '';
```

logs-client.tsx (line 64): identical change.

Do NOT change the `io(...)` call sites, the `path: '/ws/socket.io'` option, the namespaces (`/terminal`, `/logs`), the auth token flow, or any reconnection options. Do NOT touch server/terminal-server.ts. Do NOT create or modify any .env files — the empty-string fallback makes env config unnecessary, and an explicit `NEXT_PUBLIC_TERMINAL_URL` still overrides via the `||` short-circuit.

Rationale (per problem statement): when the URL string is empty, socket.io-client uses `window.location` as origin → request goes to `ws://localhost:8080/ws/socket.io` → Caddy `/ws/*` handle proxies to `terminal:3001`. This eliminates both the cross-origin error AND the unreachable-port issue (3001 is not published by compose; only 127.0.0.1:8080 is).
  </action>
  <verify>
    <automated>grep -n "NEXT_PUBLIC_TERMINAL_URL" src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx src/app/dashboard/env/[id]/logs/_components/logs-client.tsx | grep -v "localhost:3001" | grep -c "|| ''" | grep -qx 2 &amp;&amp; echo OK</automated>
  </verify>
  <done>Both files show `process.env.NEXT_PUBLIC_TERMINAL_URL || ''`. Neither file contains the literal string `localhost:3001` anymore. No other lines changed.</done>
</task>

<task type="auto">
  <name>Task 2: Rebuild app image so the NEXT_PUBLIC_ change is baked in</name>
  <files>(no source files; runs docker compose)</files>
  <action>
`NEXT_PUBLIC_*` values are inlined at Next.js build time, so a code-only change does not propagate until the `app` image is rebuilt.

From the repo root:
```bash
docker compose build app
docker compose up -d app
```

Then confirm the new container is up:
```bash
docker compose ps app
```

Do NOT rebuild the `terminal` or `caddy` services — they are unaffected. Do NOT run `docker compose down` (would interrupt other dev environments).
  </action>
  <verify>
    <automated>docker compose ps app --format json 2>/dev/null | grep -q '"State":"running"' &amp;&amp; echo OK</automated>
  </verify>
  <done>`docker compose ps app` shows the `app` service as `running` after the rebuild. No errors in `docker compose logs app --tail=50`.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Browser-side verification — Socket.IO hits localhost:8080, terminal connects</name>
  <what-built>Same-origin Socket.IO connection through Caddy. Terminal and logs streams should now work without CORS or unreachable-port errors.</what-built>
  <how-to-verify>
1. Hard-refresh the dashboard at http://localhost:8080/ (Cmd+Shift+R) to clear cached JS.
2. Open DevTools → Network tab, filter by "socket.io" or "ws".
3. Navigate to a running env's terminal page: `/dashboard/env/{id}/terminal`.
4. Confirm in Network tab:
   - Socket.IO polling/upgrade requests go to `http://localhost:8080/ws/socket.io/?EIO=4&...` (NOT `localhost:3001`).
   - The WebSocket upgrade returns `101 Switching Protocols`.
   - No "Cross-Origin Request Blocked" errors in Console.
5. Confirm xterm shows a live shell prompt (type a command like `ls` and see output).
6. Navigate to the logs page: `/dashboard/env/{id}/logs`. Confirm log lines stream in and the same `ws://localhost:8080/ws/socket.io` URL is used.
7. (Optional) Confirm backward-compat: an explicit `NEXT_PUBLIC_TERMINAL_URL` (if you ever set one) still overrides — out of scope for this fix, just don't set it.
  </how-to-verify>
  <resume-signal>Type "approved" if terminal + logs both work via localhost:8080. If still broken, paste the failing Network entry (URL + status) and the Console error.</resume-signal>
</task>

</tasks>

<verification>
- Both client files use `|| ''` fallback (not `|| 'http://localhost:3001'`).
- `app` container rebuilt and running.
- Browser confirms Socket.IO traffic on `localhost:8080/ws/socket.io`, no CORS errors, terminal interactive, logs streaming.
</verification>

<success_criteria>
- Terminal page shows live shell (no "Connection lost" banner).
- Logs page streams updates.
- DevTools Network shows all Socket.IO requests on `http://localhost:8080/ws/socket.io` (origin = page origin).
- No `localhost:3001` references hit by the browser.
- Console is free of CORS / cross-origin errors related to Socket.IO.
</success_criteria>

<output>
After completion, create `.planning/quick/260501-mqx-fix-terminal-socket-io-cors-by-switching/260501-mqx-01-SUMMARY.md`
</output>
