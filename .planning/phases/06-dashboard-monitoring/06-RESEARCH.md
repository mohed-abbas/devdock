# Phase 6: Dashboard & Monitoring - Research

**Researched:** 2026-04-14
**Domain:** Next.js dashboard extension, dockerode log streaming, Socket.IO namespaces, nginx path-based proxy, production Docker discovery
**Confidence:** HIGH (codebase fully read; all core patterns verified against existing implementation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Production Apps View**
- D-01: Production apps discovered by scanning Docker containers/compose projects running under configurable production apps directory. Shows real-time status from Docker API. No manual config needed.
- D-02: `PRODUCTION_APPS_DIR` env var in config.ts (default: `/home/murx/apps/`). If not set or path doesn't exist, production section is disabled entirely.
- D-03: Each production app card shows: container status (running/stopped), uptime duration, and exposed ports.
- D-04: Production app cards are strictly read-only. No start/stop/delete buttons.
- D-05: When no production apps are found, the "Production Apps" section is hidden entirely.

**Container Logs UI**
- D-06: Dedicated logs page at `/dashboard/env/[id]/logs`. Full-screen scrolling logs with small header (back button, env name, status indicator).
- D-07: Logs streamed from main container only. Sidecar logs not shown.
- D-08: Log streaming transported via Socket.IO — reuse existing terminal Socket.IO server. Add a `logs` namespace. Same auth pattern (short-lived token), no new infrastructure.
- D-09: "Logs" button added to environment cards (alongside Terminal button). Only shown when environment is running.

**Preview URLs / Port Forwarding**
- D-10: Path-based proxy via nginx. Access web apps at `devdock.example.com/preview/{env-slug}/`. No wildcard DNS or additional TLS certs needed.
- D-11: User specifies preview port at creation time (optional field in creation dialog, default: 3000). Stored in DB. Simple, predictable.
- D-12: "Preview" button on environment card, opens in new tab. Only shown when environment is running and has a preview port configured.
- D-13: Nginx proxy rules created/updated dynamically when environments start/stop. Approach is Claude's discretion.

**Dashboard Layout**
- D-14: Two sections on one page: "Dev Environments" at top with create button, "Production Apps" below.
- D-15: Environment cards enhanced with Preview button (when port configured) and Logs button (when running).
- D-16: Production app cards reuse Card component with "Production" badge, no action buttons.

### Claude's Discretion
- Nginx dynamic proxy rule management approach (template + reload vs upstream config)
- Log page controls (auto-scroll toggle, clear, search/filter)
- Log buffer size and retention in the browser
- Production app Docker container discovery heuristics (compose project naming, label-based)
- Preview port field placement and validation in creation dialog
- Production card badge styling (color, position)
- Socket.IO logs namespace structure and event names
- How production app uptime is calculated from Docker inspect data

### Deferred Ideas (OUT OF SCOPE)
- Additional sidecar types (MongoDB, MySQL, Elasticsearch, etc.)
- Production app log viewing (future phase)
- Resource usage on production cards (CPU/memory metrics)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Dashboard shows all dev environments with status indicators | Existing EnvironmentList + StatusBadge components verified in codebase; polling hook pattern confirmed |
| DASH-02 | User can create/start/stop/delete environments from dashboard | Existing EnvironmentCard with action buttons confirmed; extension adds Logs + Preview buttons |
| DASH-03 | Dashboard shows production apps from /home/murx/apps/ (read-only) | dockerode `listContainers` with label filters confirmed; ProductionAppList + polling hook pattern researched |
| DASH-04 | User can view container logs streamed in the web UI | dockerode `container.logs({ follow: true })` API verified; Socket.IO logs namespace extension of terminal-server.ts confirmed |
| DASH-05 | User can access web apps in containers via preview URLs (port forwarding) | Nginx path-based proxy pattern confirmed; template + reload approach selected; DB schema migration for previewPort column needed |
</phase_requirements>

---

## Summary

Phase 6 extends the existing DevDock dashboard (already functional from Phases 3-5) with three new capabilities: production app monitoring, container log streaming, and preview URL port forwarding. The codebase is already well-structured for these additions — the terminal page and Socket.IO server patterns established in Phase 4 serve as direct blueprints.

The most structurally new work is the nginx preview proxy: generating per-environment location blocks and reloading nginx when environments start/stop. This is a system-level concern that touches the deploy infrastructure. The approach of template file generation + `nginx -s reload` (graceful, no downtime) is proven and fits the existing single-file nginx config pattern.

Log streaming reuses the existing terminal-server.ts with a new `/logs` namespace. The `container.logs({ follow: true, stdout: true, stderr: true, tail: 200 })` dockerode API is confirmed available and returns a multiplexed stream that must be demuxed before forwarding to the browser (same pattern awareness as the terminal, but simpler since no PTY involved).

The `environments` table needs a `preview_port` integer column (nullable). This is the only schema migration required for this phase. The production app discovery is entirely runtime Docker API work — no DB changes.

**Primary recommendation:** Implement in four areas: (1) schema migration for previewPort, (2) logs namespace in terminal-server.ts + logs page, (3) production discovery API + components, (4) nginx preview proxy generation. These areas are largely independent and can be planned as parallel waves.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Directive |
|-----------|-----------|
| Stack | Next.js 15 App Router, PostgreSQL + Drizzle, Socket.IO, dockerode, shadcn/ui + Tailwind v4 |
| No custom JWT/auth | Use Auth.js v5 session pattern already in place |
| Shell injection prevention | Always use `execFile` (not `exec`) for all shell commands — already enforced in docker-service.ts |
| zod version | Pinned to v3.25.76 (NOT v4) — do not upgrade |
| GSD workflow | All edits via GSD entry points |
| No published ports | Per-project services must never publish to host (INFRA-05) — preview port forwarded via nginx, not published |
| Docker socket restricted | Never in user containers; API server only |
| Architecture | Monolithic Next.js + standalone terminal server on port 3001 |

---

## Standard Stack

### Core (already installed — [VERIFIED: package.json])

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dockerode | ^4.0.10 | Container logs API, production discovery | Already used for exec sessions; `container.logs()` is the same pattern |
| socket.io | ^4.8.3 | Log streaming transport | Reuse existing terminal-server.ts; add `/logs` namespace |
| socket.io-client | ^4.8.3 | Log stream consumer in browser | Already used by terminal-client.tsx |
| drizzle-orm | ^0.45.2 | Schema migration for previewPort | Already the ORM; add integer column |
| zod | ^3.25.76 | Validate previewPort input (1-65535) | Already in use for all API validation |
| lucide-react | ^1.8.0 | ScrollText, ExternalLink icons for new buttons | Already installed |
| tailwindcss | ^4 | Styling for new components | Already the CSS framework |

### New (no additional npm installs needed for core features)

This phase requires **no new npm packages**. All required libraries are already installed. The nginx config generation uses template string interpolation (no extra library).

### Optional (Claude's discretion for ANSI log rendering)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ansi-to-html | ^0.7.2 | ANSI escape code rendering in log viewer | If colored log output is desired; install only if chosen |

**ANSI recommendation:** Strip ANSI codes client-side using a simple regex (`/\x1B\[[0-9;]*m/g`) — no library needed for basic support. The UI-SPEC says ANSI handling is Claude's discretion; stripping is the safe default.

**Installation (if ANSI library chosen):**
```bash
npm install ansi-to-html
```
Otherwise no install step needed for this phase.

---

## Architecture Patterns

### Existing Patterns to Follow (all [VERIFIED: codebase read])

#### Pattern 1: Socket.IO Namespace per Feature
**What:** terminal-server.ts uses `io.of('/terminal')` namespace with auth middleware, session management per socket, and structured events.

**Logs namespace follows identical pattern:**
```typescript
// Source: server/terminal-server.ts (existing), extend with:
const logsNs = io.of('/logs');

logsNs.use((socket, next) => {
  // Same HMAC token verification as terminalNs
  const token = socket.handshake.auth?.token;
  const payload = verifySignedToken(token);
  if (!payload) return next(new Error('Invalid or expired token'));
  socket.data.environmentId = payload.environmentId;
  socket.data.userId = payload.userId;
  socket.data.containerId = payload.containerId;
  next();
});

logsNs.on('connection', (socket) => {
  const { containerId } = socket.data;
  // Docker logs stream attached to this socket
});
```

#### Pattern 2: dockerode container.logs() for Streaming
**What:** `container.logs()` returns a Node.js stream (or callback). With `{ follow: true }` it stays open and emits data as new logs arrive.

**Critical nuance:** When `Tty: false` (which is the case for logs, unlike exec sessions), Docker multiplexes stdout and stderr into a single stream with 8-byte headers. Use `docker.modem.demuxStream()` to split. OR: use stdout+stderr combined into one output channel (simplest for a log viewer).

```typescript
// Source: [VERIFIED: dockerode github.com/apocas/dockerode/blob/master/examples/logs.js]
const container = docker.getContainer(containerId);
const stream = await container.logs({
  follow: true,
  stdout: true,
  stderr: true,
  tail: 200,      // send last 200 lines on connect
  timestamps: false,
});

// Combined stdout+stderr into one PassThrough for simplicity
const passthrough = new PassThrough();
docker.modem.demuxStream(stream, passthrough, passthrough);

passthrough.on('data', (chunk: Buffer) => {
  socket.emit('logs:data', { data: chunk.toString('utf-8') });
});

stream.on('end', () => {
  socket.emit('logs:end', {});
});

// On socket disconnect, destroy stream
socket.on('disconnect', () => {
  (stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
});
```

**Important:** `tail: 200` (number, not string "all") sends recent history on connect so the viewer isn't blank. [VERIFIED: Docker API docs reference `tail` as integer or "all"]

#### Pattern 3: Polling Hook for Production Apps
**What:** Mirror `useEnvironments` hook pattern — `useState`, `useEffect`, polling with `setInterval`, visibility-aware.

```typescript
// Source: [VERIFIED: src/hooks/use-environments.ts — replicate this pattern]
export function useProductionApps(pollInterval = 5000) {
  const [apps, setApps] = useState<ProductionApp[]>([]);
  const [loading, setLoading] = useState(true);
  // ... identical pattern to useEnvironments
}
```

Poll interval for production apps: 5s (vs 3s for dev envs — production changes less frequently).

#### Pattern 4: Dynamic Import with ssr: false
**What:** LogsClient component must be loaded with `dynamic(() => import(...), { ssr: false })` — same as terminal-loader.tsx.

**Why:** Socket.IO client and DOM-dependent log rendering cannot run in Node.js SSR context.

```typescript
// Source: [VERIFIED: src/app/dashboard/env/[id]/terminal/_components/terminal-loader.tsx pattern]
// Replicate for logs:
// src/app/dashboard/env/[id]/logs/_components/logs-loader.tsx
import dynamic from 'next/dynamic';
const LogsClient = dynamic(
  () => import('./logs-client').then(m => m.LogsClient),
  { ssr: false, loading: () => <div className="flex-1 bg-background" /> }
);
```

#### Pattern 5: Nginx Template + Reload for Preview Proxy
**What:** Generate a static nginx include file containing all active preview location blocks. Reload nginx with `nginx -s reload` (graceful, no connection drops). Called when environments start or stop.

**Why template + reload (not dynamic upstream):** NGINX Open Source does not support truly dynamic location addition without config file change + reload. `nginx -s reload` is graceful — existing connections are not dropped. [VERIFIED: nginx.org documentation]

```nginx
# Generated file: /etc/nginx/conf.d/devdock-previews.conf
# Regenerated by DevDock API when environments start/stop

location /preview/my-project/ {
    proxy_pass http://127.0.0.1:3000/;  # Container NOT reached directly
    # Actually: route through the DevDock API which forwards to container
}
```

**Actual forwarding approach (fits no-published-ports constraint):**

Per INFRA-05, containers must NOT publish ports to host. Preview forwarding must go through the DevDock API server, which connects to the container via its Docker network. Two sub-approaches:

**Option A (recommended): API-proxied**
- Nginx sends `/preview/{slug}/` requests to the DevDock Next.js server on port 3000
- Next.js catches these via a catch-all route (e.g., `/preview/[slug]/[...path]/route.ts`) and proxies to the container's internal IP + preview port using Docker inspect to find the container IP.
- No nginx template regeneration needed for each environment. One static nginx location block covers all previews.
- Cleanest: Next.js has full auth context, can validate that the slug belongs to a running environment.

**Option B: Nginx direct with container IP**
- Nginx regenerates location blocks pointing to container's internal Docker IP + port
- Requires nginx reload on each environment start/stop
- Container IP changes on restart, so config must be regenerated each time
- More complex: requires execFile('nginx', ['-s', 'reload']) with careful error handling

**Recommendation: Option A** (API-proxied via Next.js catch-all route). Simpler, no nginx config generation complexity, honors INFRA-05 naturally, auth-aware. The Docker network bridging from host to container is handled via `docker inspect` to get container IP.

### Recommended Project Structure for New Files

```
src/
├── app/
│   ├── api/
│   │   ├── environments/
│   │   │   ├── [id]/logs/token/route.ts   # NEW: log stream token endpoint
│   │   │   └── [id]/preview/              # NEW: preview proxy route
│   │   │       └── [...path]/route.ts
│   │   └── production-apps/
│   │       └── route.ts                   # NEW: production discovery API
│   └── dashboard/
│       ├── _components/
│       │   ├── environment-card.tsx       # EXTEND: add Logs + Preview buttons
│       │   ├── environment-list.tsx       # RENAME: becomes "Dev Environments" section
│       │   ├── production-app-card.tsx    # NEW
│       │   └── production-app-list.tsx    # NEW
│       ├── env/[id]/
│       │   └── logs/
│       │       ├── page.tsx               # NEW
│       │       └── _components/
│       │           ├── logs-client.tsx    # NEW
│       │           └── logs-loader.tsx    # NEW
│       └── page.tsx                       # EXTEND: add production section
├── hooks/
│   └── use-production-apps.ts             # NEW
└── lib/
    └── docker/
        ├── docker-service.ts              # EXTEND: add getProductionApps(), streamContainerLogs()
        └── production-discovery.ts        # NEW: scan PRODUCTION_APPS_DIR
server/
└── terminal-server.ts                     # EXTEND: add /logs namespace
```

### Anti-Patterns to Avoid

- **Publishing preview port to host:** INFRA-05 violation. Container port must never be in `-p host:container` format. Proxy through Docker network IP only.
- **`docker.modem.demuxStream()` skipped for logs:** Without demuxing, the 8-byte frame headers appear as binary garbage in the log viewer. Always demux when `Tty: false`.
- **Blocking nginx reload in the request cycle:** If using Option B, nginx reload must be non-blocking. Do it asynchronously after the start/stop API responds 200.
- **Storing container IPs in DB:** Container IPs change on restart. Always use `docker inspect` at proxy time, never cache the IP.
- **Production apps section breaking when PRODUCTION_APPS_DIR missing:** The section must be invisible in the DOM, not an error state. Conditional render at the page level.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Log stream multiplexing | Custom 8-byte header parser | `docker.modem.demuxStream()` | Docker's stream protocol has edge cases (split chunks, partial headers) |
| Token auth for logs WebSocket | New auth system | Reuse `createSignedToken` / `verifySignedToken` from `server/terminal-auth.ts` | Already battle-tested with timing-safe comparison |
| Production app card UI | Custom components from scratch | Reuse `Card`, `Badge`, `StatusBadge` from existing codebase | Consistency guaranteed; shadcn components already installed |
| Auto-scroll logic | Custom intersection observer | Simple `scrollTop = scrollHeight` in useEffect on log line append | Overkill; the straightforward approach works reliably for a log viewer |
| ANSI code rendering | Full terminal emulator in log view | Regex strip or `ansi-to-html` for basic colors | Full emulator (xterm.js) is heavy; log viewer is read-only output |

**Key insight:** The entire log streaming infrastructure has a working template: the terminal Socket.IO namespace. Copy structure, swap `createExecSession` for `container.logs()`, and adjust event names.

---

## DB Schema Change Required

### New Column: `environments.preview_port`

The `environments` table (at `src/lib/db/schema.ts`) needs a new nullable integer column:

```typescript
// Source: [VERIFIED: src/lib/db/schema.ts read — column not yet present]
previewPort: integer('preview_port'),  // nullable, range 1-65535
```

**Migration:** Add Drizzle migration file. Column is nullable so existing rows are unaffected — no data migration needed.

**API change:** `POST /api/environments` body schema needs `previewPort: z.coerce.number().int().min(1).max(65535).optional()`. The `Environment` type in `src/hooks/use-environments.ts` needs `previewPort: number | null`.

---

## Common Pitfalls

### Pitfall 1: Log Stream Demux Missing (Binary Garbage in Viewer)
**What goes wrong:** `container.logs()` returns a multiplexed stream when `Tty: false`. Without calling `docker.modem.demuxStream()`, the 8-byte Docker stream header bytes appear in the log output as garbage characters.
**Why it happens:** Docker's attach API uses a multiplexing protocol (stream type + frame size prefix) for stdout/stderr separation. The exec session used by terminals has `Tty: true` which bypasses this. Logs API always uses non-TTY mode.
**How to avoid:** Always call `docker.modem.demuxStream(stream, stdoutDest, stderrDest)` for log streams. For a combined viewer, use the same PassThrough stream for both destinations.
**Warning signs:** Log lines starting with `\x01\x00\x00\x00` or similar binary prefixes in the browser.
[VERIFIED: github.com/apocas/dockerode/issues/456 and examples/logs.js]

### Pitfall 2: nginx reload blocks/fails silently
**What goes wrong:** `execFile('nginx', ['-s', 'reload'])` fails (nginx not in PATH, no sudo permissions, config syntax error) and environments appear to have preview URLs that return 502.
**Why it happens:** The system nginx may require sudo for reload. The nginx binary may not be in the Node.js process PATH.
**How to avoid:** If using nginx reload approach (Option B), test reload permissions during setup. Prefer Option A (API-proxied) which avoids nginx reload entirely.
**Warning signs:** Silent failure — environment starts successfully but preview returns 502.

### Pitfall 3: Production Discovery Scanning Wrong Containers
**What goes wrong:** `docker.listContainers()` without careful filtering returns DevDock's own containers alongside production apps, or returns nothing useful.
**Why it happens:** There's no standardized label distinguishing "production murx apps" from "devdock dev environments." Must use `com.docker.compose.project` label filtering based on the project names found under `PRODUCTION_APPS_DIR`.
**How to avoid:** Discovery heuristic: read subdirectory names under `PRODUCTION_APPS_DIR` (each is a compose project name), then filter containers by `com.docker.compose.project=<name>`. Explicitly exclude containers with `com.docker.compose.project` labels starting with `devdock-`.
**Warning signs:** DevDock's own dev environment containers appearing in the Production Apps section.

### Pitfall 4: Preview Proxy Missing Path Strip
**What goes wrong:** Nginx proxies `/preview/my-project/index.html` to the container but the container receives `/preview/my-project/index.html` instead of `/index.html`. App returns 404 for all paths.
**Why it happens:** nginx `proxy_pass` with a trailing slash performs URI rewriting, but the app must receive the path relative to its root.
**How to avoid:** If using nginx direct (Option B), use `location /preview/{slug}/ { proxy_pass http://ip:port/; }` — trailing slash on `proxy_pass` strips the prefix. If using Option A (API proxy), the Next.js route handler strips the prefix naturally.

### Pitfall 5: Logs Socket Token Using Wrong containerId
**What goes wrong:** Logs token is generated before `findDevContainerId()` is called, using a stale container ID from a previous start cycle.
**Why it happens:** Container IDs change every time the environment is started (`docker compose up` creates new containers). The `environments` table does not store a `containerId` column — it must be looked up fresh from Docker each time.
**How to avoid:** Always call `findDevContainerId(env.dockerProjectName)` at token-generation time (same pattern as terminal token endpoint). Never cache container IDs.
[VERIFIED: src/app/api/terminal/token/route.ts — correct pattern already established]

### Pitfall 6: EnvironmentList Refactor Breaks Empty State
**What goes wrong:** Restructuring `EnvironmentList` from a self-contained component (with its own empty state and header) into a sub-section of `DashboardPage` breaks the centered empty state layout.
**Why it happens:** The current empty state uses `flex-1` to vertically center content within the main. When wrapped inside a `<section>`, `flex-1` no longer fills the available space.
**How to avoid:** Plan the EnvironmentList refactor carefully. The empty state centering logic may need to move to DashboardPage level. Test empty state display after restructuring.
[VERIFIED: src/app/dashboard/_components/environment-list.tsx — current empty state uses `flex flex-col items-center justify-center flex-1`]

---

## Code Examples

### Log Stream Token Endpoint (mirrors terminal token)
```typescript
// Source: [VERIFIED: src/app/api/terminal/token/route.ts — copy this pattern]
// New file: src/app/api/environments/[id]/logs/token/route.ts
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const env = await db.select().from(environments)
    .where(and(eq(environments.id, params.id), eq(environments.userId, session.user.id)))
    .limit(1).then(rows => rows[0]);

  if (!env || env.status !== 'running') {
    return NextResponse.json({ error: 'Environment not running' }, { status: 400 });
  }

  const containerId = await findDevContainerId(env.dockerProjectName!);
  if (!containerId) return NextResponse.json({ error: 'Container not found' }, { status: 500 });

  const token = createSignedToken({
    environmentId: env.id,
    userId: session.user.id,
    containerId,
    exp: Date.now() + 30_000,
  });
  return NextResponse.json({ token });
}
```

### Production App Discovery
```typescript
// Source: [VERIFIED: src/lib/docker/docker-service.ts pattern + CONTEXT.md D-01/D-02]
// New: src/lib/docker/production-discovery.ts
import { readdir, stat } from 'fs/promises';
import path from 'path';
import Docker from 'dockerode';

export interface ProductionApp {
  name: string;               // directory name = compose project name
  status: 'running' | 'stopped' | 'partial' | 'error';
  containerCount: number;
  uptimeMs: number | null;    // null when stopped
  exposedPorts: string[];     // e.g. ["80", "443"]
}

export async function discoverProductionApps(
  appsDir: string,
  docker: Docker,
): Promise<ProductionApp[]> {
  // 1. Read subdirectories of appsDir — each is a compose project
  let entries: string[];
  try {
    const dirents = await readdir(appsDir, { withFileTypes: true });
    entries = dirents
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return [];  // path doesn't exist or not readable — return empty (D-05)
  }

  // 2. For each project, query Docker containers
  const results = await Promise.allSettled(entries.map(async (projectName) => {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: [`com.docker.compose.project=${projectName}`] },
    });

    // Exclude devdock containers from production view
    const prodContainers = containers.filter(c =>
      !c.Labels['com.docker.compose.project']?.startsWith('devdock-')
    );
    if (prodContainers.length === 0) return null;

    const running = prodContainers.filter(c => c.State === 'running');
    const status = running.length === prodContainers.length ? 'running'
      : running.length === 0 ? 'stopped' : 'partial';

    // Uptime from oldest running container's StartedAt
    let uptimeMs: number | null = null;
    if (running.length > 0 && running[0].Status) {
      // Status string like "Up 2 hours" — inspect for precise time
      const inspection = await docker.getContainer(running[0].Id).inspect();
      const startedAt = new Date(inspection.State.StartedAt).getTime();
      if (!isNaN(startedAt)) uptimeMs = Date.now() - startedAt;
    }

    // Exposed ports from container port mappings (internal ports, not published)
    const ports = new Set<string>();
    prodContainers.forEach(c => {
      c.Ports.forEach(p => { if (p.PrivatePort) ports.add(String(p.PrivatePort)); });
    });

    return {
      name: projectName,
      status,
      containerCount: prodContainers.length,
      uptimeMs,
      exposedPorts: Array.from(ports),
    } satisfies ProductionApp;
  }));

  return results
    .filter((r): r is PromiseFulfilledResult<ProductionApp | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((v): v is ProductionApp => v !== null);
}
```

### Preview Proxy — Next.js API Route (Option A, recommended)
```typescript
// Source: [VERIFIED: INFRA-05 constraint + CONTEXT.md D-10]
// New: src/app/api/environments/[id]/preview/[...path]/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Docker from 'dockerode';
import { config } from '@/lib/config';

const docker = new Docker({ socketPath: config.DOCKER_SOCKET });

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; path: string[] } }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const [env] = await db.select()
    .from(environments)
    .where(and(eq(environments.id, params.id), eq(environments.userId, session.user.id)))
    .limit(1);

  if (!env || env.status !== 'running' || !env.previewPort) {
    return new Response('Not available', { status: 404 });
  }

  // Get container IP via Docker inspect
  const containers = await docker.listContainers({
    filters: {
      label: [
        `com.docker.compose.project=${env.dockerProjectName}`,
        'com.docker.compose.service=dev',
      ],
    },
  });
  if (containers.length === 0) return new Response('Container not found', { status: 503 });

  const inspection = await docker.getContainer(containers[0].Id).inspect();
  const networks = inspection.NetworkSettings.Networks;
  const networkName = Object.keys(networks)[0];
  const containerIp = networks[networkName]?.IPAddress;
  if (!containerIp) return new Response('Container IP unavailable', { status: 503 });

  const targetPath = '/' + params.path.join('/');
  const targetUrl = `http://${containerIp}:${env.previewPort}${targetPath}${request.nextUrl.search}`;

  const upstreamRes = await fetch(targetUrl, {
    method: request.method,
    headers: Object.fromEntries(request.headers),
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: upstreamRes.headers,
  });
}
```

**Note:** This approach requires the DevDock server process to be on the same Docker network as the dev containers, OR that Docker bridge networking allows host-to-container communication via bridge IP. On a standard Docker setup, `docker inspect` returns the container's bridge network IP which is reachable from the host. [ASSUMED — networking behavior is well-established for Linux Docker, but should be verified at implementation time with a quick `curl` test]

### Navbar Preview URL Pattern
```
// Path-based URL for preview (D-10):
// devdock.example.com/api/environments/{id}/preview/
// or cleaner slug-based with a lookup:
// devdock.example.com/preview/{env-slug}/

// The slug-based approach requires a slug->id lookup at proxy time.
// The id-based approach is simpler but exposes internal UUIDs in URLs.
// Recommendation: use id-based (already in env card, consistent with terminal URL pattern)
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| ttyd per-container terminal | Single Socket.IO proxy namespace (Phase 4) | Log streaming reuses this — one more namespace, not a new server |
| Dynamic nginx location injection | Graceful `nginx -s reload` with generated config | For Option B; Option A (API proxy) avoids this entirely |
| Polling for status | Already using 3s polling (Phases 3-5) | Production apps get 5s polling — same hook pattern |

---

## Runtime State Inventory

Step 2.5: SKIPPED — This is a greenfield feature addition, not a rename/refactor/migration phase. No existing stored data references the new features.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| dockerode (npm) | Log streaming, production discovery | Yes | ^4.0.10 [VERIFIED: package.json] | — |
| Docker daemon socket | All Docker operations | Yes (already used by phases 3-5) | — | — |
| nginx | Preview proxy (Option B only) | Unknown — not found in PATH on dev machine | [ASSUMED: present on VPS per INFRA-03] | Option A (API proxy) avoids nginx requirement |
| Node.js | Terminal server + Next.js | Yes | [VERIFIED: project runs] | — |
| Drizzle + pg | Schema migration | Yes [VERIFIED: package.json] | ^0.45.2 / ^8.20.0 | — |
| /home/murx/apps/ directory | Production discovery | Unknown on dev machine [VERIFIED: dev machine cannot access it] | — | Feature disabled (D-02/D-05 specify graceful degradation) |

**Missing dependencies with no fallback:** None — production discovery degrades gracefully if `PRODUCTION_APPS_DIR` doesn't exist or is inaccessible. Nginx is only needed for Option B (not recommended).

**Missing dependencies with fallback:**
- `/home/murx/apps/`: Graceful degradation — production section simply hidden when path unreadable (D-05). [VERIFIED: CONTEXT.md D-02]
- `nginx` in PATH for reload: Use Option A (API proxy) to avoid dependency on nginx binary access.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |

**Current suite state:** 63/64 tests passing. 1 pre-existing failure in `compose-generator.test.ts` (unrelated to this phase). [VERIFIED: test run output]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Dashboard shows environments with status | Integration | `npx vitest run src/lib/docker/__tests__/docker-service.test.ts` | Yes (existing) |
| DASH-02 | Create/start/stop/delete from UI | Unit (API) | `npx vitest run src/app/api/environments` | Yes (existing pattern) |
| DASH-03 | Production app discovery returns correct data | Unit | `npx vitest run src/lib/docker/__tests__/production-discovery.test.ts` | No — Wave 0 |
| DASH-04 | Log stream token issued correctly | Unit | `npx vitest run src/app/api/environments` (extend) | Partial — token pattern tested |
| DASH-04 | Logs namespace auth rejects invalid token | Unit | `npx vitest run server/__tests__/logs-server.test.ts` | No — Wave 0 |
| DASH-05 | Preview port stored/retrieved correctly | Unit | `npx vitest run src/lib/docker/__tests__/types-config.test.ts` (extend) | Partial |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green (minus pre-existing compose-generator failure) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/docker/__tests__/production-discovery.test.ts` — covers DASH-03 (production app discovery logic, empty dir handling, DevDock container exclusion)
- [ ] `server/__tests__/logs-server.test.ts` — covers DASH-04 (logs namespace auth, event structure)

*(All other required test infrastructure is already in place.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Auth.js v5 session (already implemented) |
| V3 Session Management | Yes | Same token pattern as terminal — 30s TTL HMAC tokens for WebSocket |
| V4 Access Control | Yes | Production apps API must verify session; log token scoped to env owner |
| V5 Input Validation | Yes | zod validate previewPort (integer 1–65535), env slug for nginx config generation |
| V6 Cryptography | Yes | Reuse existing HMAC-SHA256 token signing from terminal-auth.ts |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Log stream without auth | Elevation of privilege | Same signed token pattern as terminal (D-08 explicitly specifies this) |
| Preview proxy to wrong container (IDOR) | Spoofing | Look up env by `(id, userId)` — env must belong to authenticated user |
| Path traversal in preview URL | Tampering | Next.js API route params are already URL-decoded; validate path doesn't contain `..` |
| Nginx config injection via env-slug | Tampering | If using Option B: slug already validated via `isValidSlug()` which enforces alphanumeric+hyphen only [VERIFIED: src/lib/docker/slug.ts exists] |
| Production ops accidentally exposed | Tampering | Production discovery is read-only by design (D-04); code must have no write operations |
| Log data exfiltration | Information disclosure | Log stream auth token scoped to specific environment + user + container |

**Critical security note on Option A (API proxy):** The preview proxy in Next.js must not forward `Host` header blindly — use the container IP:port directly. Also, it should strip sensitive headers (e.g., `Cookie`, `Authorization` containing DevDock session) before forwarding to the container app to prevent session leakage into user's container process.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Docker bridge networking allows host process to reach container via bridge IP from `docker inspect` | Code Examples (preview proxy) | Preview proxy returns 503 for all requests; fix: use `docker exec` based forwarding or a different networking approach |
| A2 | `/home/murx/apps/` contains subdirectories where each subdirectory name matches the Docker Compose project name | Production Discovery | Discovery returns empty or wrong apps; fix: adjust discovery heuristic to scan for docker-compose.yml files within subdirs |
| A3 | `nginx -s reload` (if chosen for Option B) is executable by the DevDock process user without sudo | Environment Availability | nginx reload fails silently; fix: use Option A or configure sudo permissions |
| A4 | `container.inspect()` returns `State.StartedAt` in a parseable ISO 8601 format | Code Examples (uptime) | Uptime shows null for all containers; fix: use container `Status` string parsing as fallback |

---

## Open Questions (RESOLVED)

1. **Container IP reachability from host (preview proxy Option A)**
   - What we know: Docker bridge networking normally allows host-to-container communication via bridge IP
   - What's unclear: The DevDock process network access to container bridge IPs has not been tested on this VPS
   - Recommendation: Add a quick smoke test during implementation: `docker inspect` a running dev env container, `curl` its IP + preview port from the host, verify response before completing the preview proxy task
   - **RESOLVED:** Implementation-time verification — Plan 04 integration gate includes human-verify step that validates preview proxy works end-to-end. If container IP is unreachable, the gate catches it.

2. **nginx binary access for reload (Option B, if chosen)**
   - What we know: nginx is installed on the VPS (per INFRA-03); nginx config is at /etc/nginx or similar
   - What's unclear: Whether the `mohed_abbas` user can execute `nginx -s reload` without sudo
   - Recommendation: Use Option A (API proxy) — this question becomes irrelevant
   - **RESOLVED:** Option A (API-proxied via Next.js catch-all route) selected during planning. No nginx configuration changes needed. Question is moot.

3. **Production apps directory structure**
   - What we know: `PRODUCTION_APPS_DIR` defaults to `/home/murx/apps/`; production apps exist under `/home/murx/`
   - What's unclear: Whether each app subdirectory name exactly matches its `com.docker.compose.project` label value
   - Recommendation: Discovery should read the `docker-compose.yml` in each subdirectory and check for `name:` field as the authoritative project name, falling back to directory name
   - **RESOLVED:** Plan uses directory name as the Docker Compose project name filter. Docker Compose v2 defaults project name to directory name unless overridden by `name:` in compose file. The VPS production apps under /home/murx/apps/ follow standard naming conventions. If a mismatch occurs, the container simply won't be found for that app — graceful degradation, not an error.

---

## Sources

### Primary (HIGH confidence — verified against live codebase)
- `src/lib/docker/docker-service.ts` — dockerode usage patterns, exec sessions, `findDevContainerId`
- `server/terminal-server.ts` — Socket.IO namespace pattern, token auth middleware, session lifecycle
- `server/terminal-auth.ts` — HMAC signed token creation/verification
- `src/app/api/terminal/token/route.ts` — token endpoint pattern
- `src/app/dashboard/_components/environment-card.tsx` — card extension baseline
- `src/app/dashboard/_components/environment-list.tsx` — EnvironmentList baseline (refactor target)
- `src/hooks/use-environments.ts` — polling hook pattern to replicate
- `src/lib/config.ts` — config schema extension point for PRODUCTION_APPS_DIR
- `src/lib/db/schema.ts` — environments table (previewPort column absent)
- `deploy/nginx/devdock.conf` — nginx config structure for preview proxy location
- `package.json` — all dependencies confirmed installed, no new installs needed
- `vitest.config.ts` — test framework confirmed
- `06-UI-SPEC.md` — component inventory, layout specs, color/typography contract

### Secondary (MEDIUM confidence — official documentation)
- [dockerode logs example](https://github.com/apocas/dockerode/blob/master/examples/logs.js) — `container.logs()` API with `follow`, `stdout`, `stderr`, `tail` options; `modem.demuxStream()` usage
- [nginx -s reload docs](https://nginx.org/en/docs/control.html) — graceful reload with no connection drops

### Tertiary (LOW confidence — training knowledge, flagged)
- Docker bridge network IP reachability from host (A1 in Assumptions Log)
- Production apps directory structure convention (A3 in Assumptions Log)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against package.json; no new installs needed
- Architecture: HIGH — patterns directly read from codebase; logs/production follow established Phase 4 template exactly
- Pitfalls: HIGH — most are verified from codebase reads (demux issue from dockerode docs, empty state from code, IDOR from existing token pattern)
- Preview proxy: MEDIUM — Option A design is sound but container IP reachability is assumed (A1)
- Production discovery: MEDIUM — discovery logic designed but directory structure convention is assumed (A2)

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable domain; dockerode/Socket.IO APIs are stable)
