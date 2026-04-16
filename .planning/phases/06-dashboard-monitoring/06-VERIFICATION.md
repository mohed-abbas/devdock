---
phase: 06-dashboard-monitoring
verified: 2026-04-16T14:00:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Subdomain preview proxy works end-to-end with real DNS + TLS (not just /etc/hosts)"
    expected: "Preview button opens {env-id}.preview.devdock.yourdomain.com in new tab, assets load correctly, navigation stays within subdomain"
    why_human: "The 06-06 checkpoint was verified via /etc/hosts + local Playwright simulation. Production subdomain preview requires wildcard DNS record, wildcard TLS cert (certbot --manual), nginx symlink, and PREVIEW_DOMAIN env var set. These are infrastructure steps that cannot be verified programmatically from within the codebase."
  - test: "Container log streaming: exec output appears on Logs page from active terminal sessions"
    expected: "Type commands in web terminal, output appears in real-time on Logs page for same environment"
    why_human: "The 06-05 plan bridge is wired in code (logsNs room broadcast in terminal-server.ts verified). However, end-to-end behavior requires a running environment with the terminal server active and a live Socket.IO connection — not testable without running services."
---

# Phase 6: Dashboard & Monitoring — Verification Report

**Phase Goal:** Users have a unified web interface showing all dev environments and production apps with full lifecycle controls, logs, and preview access
**Verified:** 2026-04-16T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dashboard displays all dev environments with visual status indicators (running/stopped/error) | VERIFIED | `environment-list.tsx` renders `EnvironmentCard` for each env; `EnvironmentCard` uses `StatusBadge` with live status; `environments` GET route reconciles Docker state |
| 2 | User can create, start, stop, and delete environments directly from the dashboard UI | VERIFIED | `environment-card.tsx` fetches `/api/environments/[id]/start`, `/stop`; `DeleteEnvironmentDialog` present; `create-environment-dialog.tsx` POSTs to `/api/environments`; all routes verified in codebase |
| 3 | Dashboard shows production apps from /home/murx/apps/ as read-only entries alongside dev environments | VERIFIED | `production-app-list.tsx` renders `ProductionAppCard` via `useProductionApps` hook; hook polls `/api/production-apps`; route calls `discoverProductionApps()` which queries Docker by compose labels; returns null when empty (D-05) |
| 4 | User can view live-streamed container logs in the web UI for any running environment | VERIFIED | `/dashboard/env/[id]/logs` page exists; `logs-client.tsx` connects to `/logs` Socket.IO namespace; `terminal-server.ts` has `/logs` namespace with Docker demux + exec forwarding (`logsNs.to(container:${containerId})`); logs token route issues HMAC tokens |
| 5 | User can access web apps running inside containers via preview URLs (port forwarding through the platform) | VERIFIED | `deploy/nginx/devdock-preview.conf` wildcard subdomain config exists; `src/app/api/preview/[[...path]]/route.ts` subdomain-aware proxy exists; middleware rewrites subdomain requests; preview button constructs `https://{env-id}.{NEXT_PUBLIC_PREVIEW_DOMAIN}` URL; old path-based proxy deleted |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/db/schema.ts` | previewPort column | VERIFIED | Line 47: `previewPort: integer('preview_port')` |
| `src/lib/config.ts` | PRODUCTION_APPS_DIR + PREVIEW_DOMAIN | VERIFIED | Lines 19-20: both env vars with optional().default('') |
| `src/lib/docker/production-discovery.ts` | discoverProductionApps + ProductionApp | VERIFIED | Exports both; queries Docker by compose labels; filters devdock- containers; graceful degradation |
| `src/app/api/production-apps/route.ts` | GET endpoint | VERIFIED | Auth-protected; calls discoverProductionApps(); substantive (4 lines) |
| `src/app/api/environments/route.ts` | previewPort in create/list | VERIFIED | createSchema line 20; insert line 176; GET uses `.select()` (all columns including previewPort) |
| `src/hooks/use-environments.ts` | previewPort in Environment interface | VERIFIED | Line 16: `previewPort: number \| null` |
| `server/terminal-server.ts` | /logs namespace + exec forwarding | VERIFIED | Lines 177+: logsNs defined; demuxStream line 220; socket.join line 206; logsNs.to broadcasts at lines 104, 114 |
| `src/app/api/environments/[id]/logs/token/route.ts` | POST token endpoint | VERIFIED | Auth-gated; userId scoped; createSignedToken |
| `src/app/dashboard/env/[id]/logs/page.tsx` | Server component with auth + env lookup | VERIFIED | redirect('/login'), redirect('/dashboard'), userId-scoped DB query |
| `src/app/dashboard/env/[id]/logs/_components/logs-loader.tsx` | dynamic import ssr:false | VERIFIED | dynamic() with `ssr: false` |
| `src/app/dashboard/env/[id]/logs/_components/logs-client.tsx` | Full log viewer | VERIFIED | ANSI_REGEX, autoScroll, connectionState, ArrowDownToLine, Trash2, Socket.IO /logs connection |
| `src/app/dashboard/_components/environment-card.tsx` | Logs + Preview buttons | VERIFIED | ScrollText (logs), ExternalLink (preview), getPreviewUrl with NEXT_PUBLIC_PREVIEW_DOMAIN, previewPort check |
| `src/app/dashboard/_components/create-environment-dialog.tsx` | Preview Port field | VERIFIED | Label "Preview Port", placeholder "3000", validation 1-65535, in API POST body |
| `src/hooks/use-production-apps.ts` | useProductionApps hook | VERIFIED | Polls /api/production-apps at 5000ms; visibilityState check; enabled flag |
| `src/app/dashboard/_components/production-app-card.tsx` | Read-only card with Production badge | VERIFIED | formatUptime, Production badge, no CardFooter |
| `src/app/dashboard/_components/production-app-list.tsx` | Conditional grid with Separator | VERIFIED | returns null when apps.length === 0; Separator inside component |
| `src/app/dashboard/page.tsx` | EnvironmentList + ProductionAppList | VERIFIED | Both imported and rendered |
| `src/app/dashboard/_components/environment-list.tsx` | "Dev Environments" heading | VERIFIED | Lines 17, 52: "Dev Environments" (2 occurrences) |
| `deploy/nginx/devdock-preview.conf` | Wildcard subdomain server block | VERIFIED | server_name *.preview.devdock.yourdomain.com; proxy_pass to 127.0.0.1:3000; Host header forwarded |
| `src/app/api/preview/[[...path]]/route.ts` | Subdomain-aware proxy | VERIFIED | extractEnvIdFromHost; inspect() for Docker IP; no HTML rewriting; STRIP_HEADERS; all HTTP methods exported |
| `src/middleware.ts` | Subdomain rewrite for preview | VERIFIED | isPreviewSubdomain detection; NextResponse.rewrite to /api/preview; matcher: ['/(.*)')] |
| `src/app/api/environments/[id]/preview/` (deleted) | Old path-based proxy removed | VERIFIED | Directory does not exist; deleted per D-19 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `environments/route.ts` | `schema.ts` | previewPort in insert/select | WIRED | Line 176: `previewPort: parsed.data.previewPort ?? null`; GET uses `.select()` |
| `production-apps/route.ts` | `production-discovery.ts` | discoverProductionApps import | WIRED | Import line 3; called line 11 |
| `production-app-list.tsx` | `use-production-apps.ts` | useProductionApps hook | WIRED | Import line 3; destructured line 9 |
| `use-production-apps.ts` | `/api/production-apps` | fetch in polling interval | WIRED | Line 21: `fetch('/api/production-apps')` |
| `environment-card.tsx` | `/dashboard/env/[id]/logs` | Link href | WIRED | Line 118: `href={'/dashboard/env/${environment.id}/logs'}` |
| `logs-client.tsx` | `/api/environments/[id]/logs/token` | fetch for HMAC token | WIRED | Line 48: `fetch('/api/environments/${environmentId}/logs/token', { method: 'POST' })` |
| `logs-client.tsx` | `terminal-server.ts /logs namespace` | socket.io-client | WIRED | Line 65: `io('${terminalServerUrl}/logs', ...)` |
| `terminal-server.ts` | `dockerode container.logs()` | Docker log stream with demux | WIRED | Line 210: `container.logs(...)`; line 220: `docker.modem.demuxStream(...)` |
| `/terminal namespace exec:output` | `/logs namespace logs:data` | Socket.IO room broadcast | WIRED | Lines 104, 114: `logsNs.to('container:${containerId}').emit('logs:data', ...)`; line 206: `socket.join(...)` |
| `environment-card.tsx` | subdomain URL | NEXT_PUBLIC_PREVIEW_DOMAIN | WIRED | Lines 13-17: `getPreviewUrl()` constructs `https://${envId}.${previewDomain}` |
| `middleware.ts` | `src/app/api/preview/[[...path]]/route.ts` | NextResponse.rewrite | WIRED | Lines 26-31: isPreviewSubdomain check + URL rewrite |
| `preview/route.ts` | Docker container IP | docker.getContainer().inspect() | WIRED | Lines 60-61: inspect(); NetworkSettings.Networks |
| `nginx/devdock-preview.conf` | Next.js on port 3000 | proxy_pass | WIRED | Line 35: `proxy_pass http://127.0.0.1:3000` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `production-app-list.tsx` | apps | `useProductionApps` → `/api/production-apps` → `discoverProductionApps` → `docker.listContainers` | Yes — Docker API queries real containers | FLOWING |
| `environment-card.tsx` (preview) | previewPort | `useEnvironments` → `/api/environments` (GET) → DB select all columns | Yes — DB query returns all columns including previewPort | FLOWING |
| `logs-client.tsx` | logLines | Socket.IO `logs:data` events from `/logs` namespace → Docker `container.logs()` + exec forwarding | Yes — Docker log stream + terminal exec bridge | FLOWING |
| `environment-list.tsx` | environments | `useEnvironments` → `/api/environments` GET → DB + Docker reconciliation | Yes — DB query with live Docker status reconciliation | FLOWING |

### Behavioral Spot-Checks

Step 7b SKIPPED for server-dependent features (Socket.IO terminal server, Docker socket). TypeScript compiles clean (0 errors) as proxy for structural correctness.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `npx tsc --noEmit` | 0 errors | PASS |
| schema.ts has previewPort | grep | `previewPort: integer('preview_port')` at line 47 | PASS |
| production-discovery.ts calls Docker | grep | `docker.listContainers` at line 31 | PASS |
| terminal-server.ts has /logs namespace | grep | `io.of('/logs')` at line 177 | PASS |
| exec forwarding wired | grep | `logsNs.to('container:${containerId}').emit` at lines 104, 114 | PASS |
| old path-based proxy removed | ls | Directory `src/app/api/environments/[id]/preview/` does not exist | PASS |
| subdomain proxy has no HTML rewriting | grep | No `html.replace` or `innerHTML` patterns found | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DASH-01 | 06-01, 06-03, 06-04 | Dashboard shows all dev environments with status indicators | SATISFIED | environment-list + environment-card with StatusBadge; polling via useEnvironments |
| DASH-02 | 06-01, 06-03, 06-04 | User can create/start/stop/delete from dashboard | SATISFIED | Create dialog, start/stop buttons calling /api/environments/[id]/start\|stop, DeleteEnvironmentDialog |
| DASH-03 | 06-01, 06-03, 06-04 | Dashboard shows production apps from /home/murx/apps/ as read-only | SATISFIED | production-discovery.ts scans PRODUCTION_APPS_DIR; ProductionAppList with read-only cards; hidden when empty (D-05) |
| DASH-04 | 06-02, 06-04, 06-05 | User can view live-streamed container logs | SATISFIED | /logs Socket.IO namespace with demux + exec forwarding; full-screen logs page; HMAC token auth |
| DASH-05 | 06-01, 06-04, 06-06 | User can access web apps via preview URLs (port forwarding) | SATISFIED (infrastructure-dependent) | Subdomain proxy route + nginx config + middleware rewrite fully implemented; requires one-time VPS infrastructure setup (DNS + TLS + env vars) |

### Anti-Patterns Found

No blockers identified. No TODO/FIXME/placeholder patterns found in any Phase 6 files. No stub returns (empty arrays/objects with no data source). All key wiring verified.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

### Human Verification Required

#### 1. Subdomain Preview Proxy — Production Infrastructure

**Test:** On the VPS: (1) Add wildcard DNS `*.preview.devdock.yourdomain.com` → VPS IP. (2) Run `sudo certbot certonly --manual --preferred-challenges dns -d "*.preview.devdock.yourdomain.com"`. (3) Update domain placeholders in `deploy/nginx/devdock-preview.conf`. (4) Symlink to nginx sites-enabled. (5) Set `PREVIEW_DOMAIN` and `NEXT_PUBLIC_PREVIEW_DOMAIN` env vars and rebuild. (6) Create an environment with preview port 3000. Start an app inside the container on port 3000. Click Preview button.

**Expected:** New tab opens at `https://{env-id}.preview.devdock.yourdomain.com`. All JS/CSS assets load (no console errors). Navigation links stay within the subdomain. Burger menus and interactive elements work.

**Why human:** The 06-06 checkpoint was verified with /etc/hosts simulation + Playwright. Production DNS + wildcard TLS cannot be tested programmatically without VPS access and actual domain control.

#### 2. Container Log Streaming — Live Terminal to Logs Page

**Test:** Start the terminal server (`npx tsx server/terminal-server.ts`). Open Logs page for a running environment. In another tab open the Terminal for the same environment. Type `echo "hello from terminal"` in the terminal.

**Expected:** The echo output appears on the Logs page in real-time. "Waiting for log output..." message disappears once output streams.

**Why human:** The exec-to-logs bridge is fully wired in code but requires active Socket.IO connections, a running environment, and the terminal server process to verify end-to-end behavior.

### Gaps Summary

No code gaps found. All 5 success criteria have complete implementations verified across all three artifact levels (exists, substantive, wired) plus data-flow traces. TypeScript compiles clean.

The two human verification items are runtime/infrastructure verification requirements, not code deficiencies:
- DASH-05 (preview): Code is complete; production DNS/TLS infrastructure setup is a one-time ops task
- DASH-04 (logs): Code is complete; live Socket.IO behavior requires running services

---

_Verified: 2026-04-16T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
