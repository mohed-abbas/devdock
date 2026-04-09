# Phase 3: Environment Lifecycle - Research

**Researched:** 2026-04-10
**Domain:** Docker Compose lifecycle management via Node.js, Next.js API routes, real-time polling UI
**Confidence:** HIGH

## Summary

Phase 3 implements the core Docker environment lifecycle: create, start, stop, and delete isolated Docker Compose stacks, each with their own network and persistent volumes. The phase also delivers a real-time status dashboard that polls an API endpoint every 3-5 seconds, and a creation modal where users name an environment, optionally provide a Git URL, and select sidecar services (Postgres, Redis).

The existing codebase already has the `environments` table schema in Drizzle, the `base-compose.yml` template with variable placeholders and commented sidecar sections, the config module with `DOCKER_SOCKET` and `DEVDOCK_DATA_DIR`, and dockerode installed as a dependency. The primary implementation work is: (1) a Docker lifecycle service module that shells out to `docker compose` CLI for stack operations and uses dockerode for container inspection, (2) Next.js API routes for CRUD + lifecycle, (3) a creation form in a shadcn/ui Dialog, and (4) a polling-based dashboard that renders environment cards with status badges.

**Critical blocker:** The user `mohed_abbas` is NOT in the docker group and Docker is installed via snap. The Docker socket at `/var/run/docker.sock` is owned by `root:root` with permissions `srw-rw----`. The Node.js process will get "permission denied" when trying to access Docker. This must be resolved before any Docker operations work.

**Primary recommendation:** Use `child_process.execFile` (NOT `exec`) with `util.promisify` for Docker Compose CLI operations, and dockerode (already installed) for container inspection/stats. Implement a thin `DockerService` module that wraps both. For the UI polling, use a simple `setInterval` + `fetch` in a custom React hook -- no new library needed (SWR is optional but not required given the simple polling pattern per D-05).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** User provides a name and optionally a Git repo URL when creating an environment. If URL is provided, the repo is cloned into the workspace. If not, workspace starts empty. Phase 5 later adds GitHub browse-and-select on top.
- **D-02:** User can select sidecar services (PostgreSQL, Redis) via checkboxes at creation time. Checked sidecars are included in the generated Compose file.
- **D-03:** Creation UX is a modal dialog (shadcn/ui Sheet or Dialog) triggered from a "New Environment" button on the dashboard. No dedicated page.
- **D-04:** After creation, the environment auto-starts immediately (`docker compose up`). User sees it transition from 'starting' to 'running'.
- **D-05:** Dashboard polls an API endpoint every 3-5 seconds to get environment statuses. No WebSocket or SSE infrastructure in this phase -- Phase 4 adds WebSockets for terminal.
- **D-06:** Status granularity uses the existing enum only: stopped/starting/running/stopping/error. No per-step progress details.
- **D-07:** Error state shown as a red status badge on the environment card. Hover/click reveals a short error message. Error details stored in a DB column.
- **D-08:** Compose files generated via string substitution on `docker/templates/base-compose.yml`. Replace `{{PROJECT_SLUG}}`, `{{BASE_IMAGE}}`, etc. For sidecars, uncomment the relevant sections. Write result to project's data directory.
- **D-09:** No Compose file editing in the UI for Phase 3.
- **D-10:** Docker lifecycle operations (start/stop/delete) use `docker compose` CLI via `child_process`. dockerode reserved for container inspection and stats.
- **D-11:** Flat structure: `DEVDOCK_DATA_DIR/{env-slug}/docker-compose.yml` and `DEVDOCK_DATA_DIR/{env-slug}/workspace/`. Each environment is one directory.
- **D-12:** Full cleanup on delete: removes containers, network, volumes, AND the data directory. Confirmation dialog before proceeding.

### Claude's Discretion
- Exact polling interval (3-5 second range)
- Docker Compose project naming convention (e.g., `devdock-{slug}`)
- Error message extraction from Docker output
- Slug generation from environment name
- API route structure for environment CRUD
- Form validation approach (client-side vs server-side)
- How repo cloning is handled (git clone in the container vs on host before start)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENV-01 | User can create a new dev environment from a GitHub repo | Docker Compose generation from template, git clone on host, API route + creation modal |
| ENV-02 | Each environment gets its own isolated Docker network | Template already defines `devdock-{{PROJECT_SLUG}}-net` per-project network |
| ENV-03 | Each environment gets persistent storage via named Docker volumes | Named volumes in Compose template for sidecars + bind mount for workspace |
| ENV-04 | User can start a stopped environment | `docker compose -p {name} start` via execFile |
| ENV-05 | User can stop a running environment (preserves volumes) | `docker compose -p {name} stop` via execFile (not `down`) |
| ENV-06 | User can delete an environment and its resources | `docker compose -p {name} down -v` + filesystem cleanup |
| ENV-07 | Environment status is visible in real-time | Polling API at 3s interval + dockerode container inspection |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 15 App Router + TypeScript + PostgreSQL 16 + Drizzle ORM + dockerode + zod
- **Docker management:** dockerode for inspection, Docker Compose CLI for lifecycle (per D-10)
- **UI:** Tailwind CSS + shadcn/ui + Lucide React icons
- **Auth:** Auth.js v5 JWT sessions, middleware protects `/dashboard/*` and `/api/*`
- **Database:** PostgreSQL with Drizzle ORM, schema-as-code
- **Validation:** zod for runtime validation of API inputs
- **No tRPC, no GraphQL, no Redis for platform state**
- **Security:** Docker socket NEVER mounted into user containers (INFRA-04), no published ports (INFRA-05)

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| dockerode | 4.0.10 | Docker Engine API client -- container inspection, stats | [VERIFIED: npm registry + package.json] |
| drizzle-orm | 0.45.2 | Type-safe database queries for environments table | [VERIFIED: package.json] |
| zod | 3.25.76 | API input validation (pinned, NOT v4) | [VERIFIED: package.json, Phase 01 decision] |
| yaml | 2.8.3 | YAML parsing for compose template processing | [VERIFIED: package.json] |
| nanoid | 5.1.7 | Short unique IDs | [VERIFIED: package.json] |
| next | 15.5.15 | Framework -- API routes for CRUD endpoints | [VERIFIED: package.json] |
| lucide-react | 1.8.0 | Icons for status badges, buttons | [VERIFIED: package.json] |

### Supporting (Need to Install)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | -- | -- | All dependencies already installed |

**No new npm packages needed.** All required libraries (dockerode, yaml, nanoid, zod) are already in package.json. The `child_process` and `util` modules are Node.js built-ins. The `fs/promises` module is a Node.js built-in. For polling on the client side, a simple `setInterval` + `fetch` pattern is sufficient per D-05. [VERIFIED: package.json]

### shadcn/ui Components (Need to Add)

Components not yet installed that are needed for this phase:

```bash
npx shadcn@latest add dialog
npx shadcn@latest add checkbox
npx shadcn@latest add badge
npx shadcn@latest add select
npx shadcn@latest add alert-dialog
npx shadcn@latest add separator
npx shadcn@latest add skeleton
```

Currently installed: button, card, input, label [VERIFIED: `src/components/ui/` listing]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| child_process.execFile | docker-compose npm (PDMLab) | Adds a dependency for what's 10 lines of code. The npm package is a thin wrapper around the CLI anyway. Stick with execFile. |
| setInterval polling | SWR with refreshInterval | SWR adds caching and dedup, but D-05 explicitly says simple polling. setInterval is more transparent. |
| String template substitution | Handlebars/EJS | Over-engineering for 5-6 variable replacements. String replace is fine. |
| slugify npm package | Custom slug function | A 5-line regex-based slug function is sufficient for environment names. No need for a dependency. |

## Architecture Patterns

### Recommended Project Structure

```
src/
  lib/
    docker/
      docker-service.ts      # Core Docker lifecycle operations
      compose-generator.ts   # Template processing + sidecar uncommenting
      types.ts               # Docker-related TypeScript types
  app/
    api/
      environments/
        route.ts             # GET (list all), POST (create)
        [id]/
          route.ts           # GET (single), DELETE
          start/
            route.ts         # POST -- start environment
          stop/
            route.ts         # POST -- stop environment
    dashboard/
      page.tsx               # Server component: initial load
      _components/
        environment-list.tsx        # Client component: polls for updates
        environment-card.tsx        # Single environment card with status badge
        create-environment-dialog.tsx  # Modal form for creation
        delete-environment-dialog.tsx  # Confirmation dialog
        status-badge.tsx             # Colored badge per status
```

### Pattern 1: Docker Service Module

**What:** A single `DockerService` class/module that wraps both `docker compose` CLI (via `execFile`) and dockerode API calls. All Docker operations go through this module -- API routes never call `child_process` or dockerode directly.

**When to use:** Every lifecycle operation (create, start, stop, delete, status check).

**Example:**

```typescript
// Source: Node.js child_process docs + dockerode npm
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import Docker from 'dockerode';
import { config } from '@/lib/config';

const execFile = promisify(execFileCb);
const docker = new Docker({ socketPath: config.DOCKER_SOCKET });

// Use execFile (NOT exec) -- prevents shell injection [CITED: nodejs.org/api/child_process.html]
async function composeUp(projectName: string, composePath: string): Promise<void> {
  await execFile('docker', [
    'compose',
    '-p', projectName,
    '-f', composePath,
    'up', '-d',
    '--wait',  // waits for health checks
  ]);
}

async function composeStop(projectName: string, composePath: string): Promise<void> {
  await execFile('docker', [
    'compose',
    '-p', projectName,
    '-f', composePath,
    'stop',
  ]);
}

async function composeDown(projectName: string, composePath: string): Promise<void> {
  await execFile('docker', [
    'compose',
    '-p', projectName,
    '-f', composePath,
    'down', '-v',  // remove volumes too
  ]);
}

// dockerode for inspection (D-10)
async function getContainerStatus(projectName: string): Promise<string> {
  const containers = await docker.listContainers({
    all: true,
    filters: { label: [`com.docker.compose.project=${projectName}`] },
  });
  // ... derive status from container states
}
```

[VERIFIED: execFile API from nodejs.org/api/child_process.html] [VERIFIED: dockerode listContainers filter from github.com/apocas/dockerode]

### Pattern 2: Compose Template Generation

**What:** Read `docker/templates/base-compose.yml`, perform string replacements, conditionally uncomment sidecar sections, write to `DEVDOCK_DATA_DIR/{slug}/docker-compose.yml`.

**When to use:** Environment creation.

**Example:**

```typescript
// Source: Existing base-compose.yml template analysis
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

interface ComposeOptions {
  projectSlug: string;
  projectName: string;
  baseImage: string;
  hostUid: number;
  hostGid: number;
  enablePostgres: boolean;
  enableRedis: boolean;
}

async function generateComposeFile(options: ComposeOptions): Promise<string> {
  const templatePath = path.join(process.cwd(), 'docker/templates/base-compose.yml');
  let template = await readFile(templatePath, 'utf-8');

  // Variable substitution
  template = template
    .replace(/\{\{PROJECT_SLUG\}\}/g, options.projectSlug)
    .replace(/\{\{PROJECT_NAME\}\}/g, options.projectName)
    .replace(/\{\{BASE_IMAGE\}\}/g, options.baseImage)
    .replace(/\{\{HOST_UID\}\}/g, String(options.hostUid))
    .replace(/\{\{HOST_GID\}\}/g, String(options.hostGid));

  // Uncomment sidecar sections
  if (options.enablePostgres) {
    template = uncommentSection(template, 'postgres');
  }
  if (options.enableRedis) {
    template = uncommentSection(template, 'redis');
  }

  // Write to data directory
  const envDir = path.join(config.DEVDOCK_DATA_DIR, options.projectSlug);
  await mkdir(path.join(envDir, 'workspace'), { recursive: true });
  const composePath = path.join(envDir, 'docker-compose.yml');
  await writeFile(composePath, template, 'utf-8');

  return composePath;
}
```

### Pattern 3: Polling Hook for Real-Time Status

**What:** A client-side React hook that fetches environment statuses every N seconds and updates UI state. Per D-05, no WebSocket/SSE.

**When to use:** Dashboard environment list.

**Example:**

```typescript
// Client component hook
'use client';
import { useState, useEffect, useCallback } from 'react';

interface Environment {
  id: string;
  name: string;
  slug: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  errorMessage?: string;
  // ... other fields
}

function useEnvironments(pollInterval = 3000) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnvironments = useCallback(async () => {
    try {
      const res = await fetch('/api/environments');
      if (res.ok) {
        const data = await res.json();
        setEnvironments(data);
      }
    } catch {
      // Silently handle -- next poll will retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments();
    const intervalId = setInterval(fetchEnvironments, pollInterval);
    return () => clearInterval(intervalId);
  }, [fetchEnvironments, pollInterval]);

  return { environments, loading, refetch: fetchEnvironments };
}
```

[ASSUMED: 3000ms interval -- within the 3-5s range per D-05 discretion]

### Pattern 4: API Route with Auth + Zod Validation

**What:** Next.js App Router route handlers that validate input with zod, check auth session, and delegate to the Docker service.

**When to use:** All environment API endpoints.

**Example:**

```typescript
// src/app/api/environments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  repoUrl: z.string().url().optional().or(z.literal('')),
  enablePostgres: z.boolean().default(false),
  enableRedis: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // ... create environment logic
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const envs = await db.select().from(environments)
    .where(eq(environments.userId, session.user.id));
  return NextResponse.json(envs);
}
```

[VERIFIED: Next.js App Router route handler pattern from nextjs.org/docs]

### Anti-Patterns to Avoid

- **Shell injection via `exec()`:** NEVER use `child_process.exec()` with string interpolation. Always use `execFile()` with argument arrays. [CITED: nodejs.org/api/child_process.html]
- **Polling from server components:** Server components render once. Polling must happen in client components with `'use client'` directive.
- **Direct Docker calls in API routes:** Always go through the DockerService module. This centralizes error handling and makes testing possible.
- **Storing Docker state only in the database:** The database tracks desired state; Docker is the source of truth for actual state. The status API should reconcile both.
- **Publishing container ports:** Per INFRA-05, no ports are published. Services communicate within their project network.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compose file generation | YAML AST manipulation | String replacement on template | Template already has the structure; just replace variables and uncomment sections. YAML AST parsing is overkill. |
| Slug generation | Complex slug library | Simple regex: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')` | Environment names are user-provided, simple, and short. |
| Docker container inspection | Raw Docker REST API calls | dockerode `listContainers` + `inspect` | dockerode handles streaming, multiplexing, and error cases. Already installed. |
| Environment status polling | Custom WebSocket infrastructure | Simple `setInterval` + `fetch` | D-05 explicitly says polling, not WebSocket. Phase 4 introduces WebSocket. |
| Form state management | Redux/Zustand for form | React `useState` or `useActionState` | Creation form has 4 fields. No state management library needed. |

**Key insight:** This phase is primarily a CRUD layer over Docker Compose CLI commands. The complexity is in error handling and state reconciliation, not in the Docker operations themselves.

## Common Pitfalls

### Pitfall 1: Docker Socket Permission Denied

**What goes wrong:** The Node.js process (running as `mohed_abbas`) cannot access `/var/run/docker.sock` because the user is not in the `docker` group. Docker is installed via snap, and the socket is owned by `root:root` with `srw-rw----` permissions.

**Why it happens:** Snap Docker does not automatically create a `docker` group. The standard fix (`sudo usermod -aG docker mohed_abbas`) may not work with snap Docker without additional configuration.

**How to avoid:** Before any Docker operations work, one of these must happen:
1. Add `mohed_abbas` to the `docker` group and configure snap Docker to use it
2. Use `sudo` for Docker operations (not recommended -- security risk)
3. Change socket permissions (not recommended -- security risk)

**Warning signs:** "permission denied while trying to connect to the Docker daemon socket" errors from both `docker` CLI and dockerode.

[VERIFIED: Tested `docker ps` and got permission denied on this VPS]

### Pitfall 2: Race Condition Between DB State and Docker State

**What goes wrong:** Database says environment is "running" but Docker says containers are stopped (or vice versa). Happens when Docker operations fail silently, containers crash, or the Node.js process restarts mid-operation.

**Why it happens:** Two sources of truth: the database (desired/last-known state) and Docker (actual state). They can diverge.

**How to avoid:** The status GET endpoint should always reconcile: query Docker for actual container states AND check the database. If they disagree, Docker wins (it's the source of truth). Update the DB to match reality on every status poll.

**Warning signs:** Status badges showing "running" but environment is unresponsive.

### Pitfall 3: Compose Template Uncommenting Is Fragile

**What goes wrong:** The sidecar sections in `base-compose.yml` are YAML comments. Naive string replacement (remove `#` prefix) breaks indentation or uncomments the wrong lines. The `volumes:` section at the bottom also needs uncommenting when sidecars are enabled.

**Why it happens:** YAML is indentation-sensitive. Comment removal must preserve exact indentation.

**How to avoid:** Use clearly delimited marker comments in the template (e.g., `# BEGIN:postgres` / `# END:postgres`) and strip only the `# ` prefix (note the space) from lines within those markers. Test with all combinations: no sidecars, postgres only, redis only, both.

**Warning signs:** `docker compose config` fails to validate the generated file.

### Pitfall 4: Long-Running Docker Operations Block API Response

**What goes wrong:** `docker compose up` can take 30+ seconds if images need to be pulled. The API request times out, the user sees an error, but the operation continues in the background.

**Why it happens:** `execFile` awaits the command completion. HTTP requests have timeouts.

**How to avoid:** Return 202 (Accepted) immediately after inserting the environment record with status `starting`. Run the `docker compose up` in the background (fire and forget with error handling). When it completes, update the DB status to `running` or `error`. The polling UI picks up the change.

**Warning signs:** Create button hangs, browser shows timeout.

### Pitfall 5: Orphaned Docker Resources on Partial Failure

**What goes wrong:** Environment creation starts, containers partially come up, then an error occurs. The DB record gets cleaned up but Docker containers and networks remain.

**Why it happens:** No cleanup logic for partial failures. `docker compose down -v` is only called on explicit delete.

**How to avoid:** On creation failure, always attempt `docker compose down -v` as cleanup. On startup, reconcile DB records with actual Docker state: if an environment exists in the DB but has no Docker resources, mark it as `error` or clean it up.

### Pitfall 6: Data Directory Path Resolution

**What goes wrong:** `DEVDOCK_DATA_DIR` defaults to `./data` (relative). Depending on how Next.js is started, `process.cwd()` may differ between `next dev` and `next start`, causing files to be written to unexpected locations.

**Why it happens:** Relative paths resolve against the working directory at runtime.

**How to avoid:** Resolve `DEVDOCK_DATA_DIR` to an absolute path at config load time. Use `path.resolve()` on the value. In production, always set an absolute path.

## Code Examples

### Drizzle Insert + Select for Environments

```typescript
// Source: Drizzle ORM docs (orm.drizzle.team/docs/insert, /docs/select)
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// Insert new environment
const [newEnv] = await db.insert(environments).values({
  userId: session.user.id,
  name: 'My Project',
  slug: 'my-project',
  status: 'starting',
  dockerProjectName: 'devdock-my-project',
  networkName: 'devdock-my-project-net',
  composeConfig: { enablePostgres: true, enableRedis: false },
}).returning();

// List user's environments
const userEnvs = await db.select().from(environments)
  .where(eq(environments.userId, session.user.id))
  .orderBy(desc(environments.createdAt));

// Update status
await db.update(environments)
  .set({ status: 'running', lastActivityAt: new Date() })
  .where(eq(environments.id, envId));

// Delete
await db.delete(environments)
  .where(eq(environments.id, envId));
```

[VERIFIED: Drizzle ORM query patterns from orm.drizzle.team docs]

### dockerode Container Inspection

```typescript
// Source: github.com/apocas/dockerode README
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// List containers for a compose project
const containers = await docker.listContainers({
  all: true,
  filters: {
    label: ['com.docker.compose.project=devdock-my-project'],
  },
});

// Get status from container state
for (const containerInfo of containers) {
  const container = docker.getContainer(containerInfo.Id);
  const inspection = await container.inspect();
  console.log(inspection.State.Status); // 'running', 'exited', etc.
}
```

[VERIFIED: dockerode API from github.com/apocas/dockerode]

### shadcn/ui Dialog with Form

```typescript
// Pattern for creation modal (D-03)
'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';

function CreateEnvironmentDialog() {
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // ... submit to API
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New Environment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Environment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div>
            <Label htmlFor="repoUrl">Git Repository URL (optional)</Label>
            <Input id="repoUrl" name="repoUrl" placeholder="https://github.com/..." />
          </div>
          <div className="space-y-2">
            <Label>Sidecar Services</Label>
            <div className="flex items-center space-x-2">
              <Checkbox id="postgres" name="enablePostgres" />
              <Label htmlFor="postgres">PostgreSQL</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="redis" name="enableRedis" />
              <Label htmlFor="redis">Redis</Label>
            </div>
          </div>
          <Button type="submit">Create & Start</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

[CITED: ui.shadcn.com/docs/components/radix/dialog] [ASSUMED: exact component API -- verify after installing]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| docker-compose (Python, v1) | docker compose (Go, v2) | 2023+ | CLI command is `docker compose` (space), not `docker-compose` (hyphen) |
| dockerode callbacks | dockerode promises | v3+ | All methods return Promises, use with async/await |
| Next.js Pages Router API routes | App Router route handlers | Next.js 13+ | Use `export async function GET/POST` in `route.ts`, not `export default function handler` |
| shadcn-ui CLI (`shadcn-ui`) | shadcn CLI (`shadcn`) | 2024 | Install command is `npx shadcn@latest add`, not `npx shadcn-ui@latest add` |

**Deprecated/outdated:**
- `docker-compose` (v1, Python): Use `docker compose` (v2, Go) -- the Docker CLI plugin [VERIFIED: Docker v28.4.0 installed with Compose v2.39.1]
- `getServerSideProps` / `getStaticProps`: Use server components or route handlers in App Router

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 3000ms polling interval is adequate for real-time feel | Architecture Patterns | Minor UX degradation -- adjustable within 3-5s range |
| A2 | `com.docker.compose.project` label is set by Docker Compose v2 | Code Examples | Container filtering won't work -- would need alternative query |
| A3 | shadcn/ui Dialog component API matches the code example | Code Examples | Minor -- adapt to actual API after `npx shadcn add dialog` |
| A4 | `docker compose up --wait` flag exists in v2.39.1 | Architecture Patterns | Would need to poll container health separately |
| A5 | Git clone on host (before compose up) is simpler than cloning inside container | Claude's Discretion | If wrong, workspace volume mount timing becomes complex |

## Open Questions

1. **Docker socket access for mohed_abbas**
   - What we know: User is NOT in docker group. Docker installed via snap. Socket is `root:root srw-rw----`.
   - What's unclear: Whether snap Docker supports the standard `docker` group, or if a different approach is needed.
   - Recommendation: This is a **prerequisite blocker**. Plan should include a Wave 0 task to resolve Docker socket access before any lifecycle operations.

2. **Base image already built?**
   - What we know: `docker/base/Dockerfile` exists. The template references `devdock-base:latest`.
   - What's unclear: Whether the base image has been built on this VPS yet.
   - Recommendation: Plan should include building the base image as an early task if not already done.

3. **DEVDOCK_DATA_DIR as relative path**
   - What we know: `.env.local` sets `DEVDOCK_DATA_DIR=./data` (relative).
   - What's unclear: Whether this resolves correctly in both `next dev` and `next start`.
   - Recommendation: Resolve to absolute path in config.ts, or change `.env.local` to use absolute path.

4. **Drizzle migration state**
   - What we know: Schema is defined in `schema.ts`. No `drizzle/` migration directory exists.
   - What's unclear: Whether migrations have been applied to the PostgreSQL database or if `drizzle-kit push` was used instead.
   - Recommendation: Verify database state. The environments table schema must exist before CRUD operations work.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine | Container lifecycle | Partial (installed, socket access denied) | 28.4.0 | Must resolve permissions |
| Docker Compose | Stack orchestration | Partial (same socket issue) | v2.39.1 | Same -- fix socket access |
| Git | Repo cloning | Yes | 2.43.0 | -- |
| Node.js | Runtime | Yes | v24.13.0 | -- |
| PostgreSQL | Database | Yes (implied by working auth) | ^16 | -- |

**Missing dependencies with no fallback:**
- Docker socket access for user `mohed_abbas` -- blocks ALL Docker operations. Must be resolved.

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 (dev dependency installed) |
| Config file | None -- needs vitest.config.ts (Wave 0) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENV-01 | Create environment (DB + compose generation + start) | unit + integration | `npx vitest run tests/environments/create.test.ts -t "create"` | No -- Wave 0 |
| ENV-02 | Isolated Docker network per environment | unit | `npx vitest run tests/environments/compose-generator.test.ts -t "network"` | No -- Wave 0 |
| ENV-03 | Persistent storage via volumes | unit | `npx vitest run tests/environments/compose-generator.test.ts -t "volume"` | No -- Wave 0 |
| ENV-04 | Start stopped environment | unit | `npx vitest run tests/environments/docker-service.test.ts -t "start"` | No -- Wave 0 |
| ENV-05 | Stop running environment | unit | `npx vitest run tests/environments/docker-service.test.ts -t "stop"` | No -- Wave 0 |
| ENV-06 | Delete environment + cleanup | unit | `npx vitest run tests/environments/docker-service.test.ts -t "delete"` | No -- Wave 0 |
| ENV-07 | Status polling returns correct state | unit | `npx vitest run tests/environments/status.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- framework configuration with path aliases
- [ ] `tests/environments/compose-generator.test.ts` -- covers ENV-01, ENV-02, ENV-03
- [ ] `tests/environments/docker-service.test.ts` -- covers ENV-04, ENV-05, ENV-06 (mocked Docker calls)
- [ ] `tests/environments/status.test.ts` -- covers ENV-07
- [ ] `tests/helpers/` -- shared test fixtures for environment data

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (inherited) | Auth.js v5 middleware on all /api/* routes -- already implemented |
| V3 Session Management | Yes (inherited) | JWT sessions with 7-day expiry -- already implemented |
| V4 Access Control | Yes | Verify `userId` matches session user on all environment operations |
| V5 Input Validation | Yes | zod schemas on all API route inputs (name, repoUrl, etc.) |
| V6 Cryptography | No | No secrets handled in this phase |

### Known Threat Patterns for Docker Lifecycle

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shell injection via environment name | Tampering | Use `execFile` (not `exec`), validate slug with strict regex `[a-z0-9-]` |
| IDOR -- user deletes another user's environment | Spoofing | WHERE clause includes `userId = session.user.id` on all queries |
| Resource exhaustion -- too many environments | Denial of Service | Check `DEVDOCK_MAX_CONCURRENT_ENVS` before creation |
| Path traversal via slug | Tampering | Validate slug contains only `[a-z0-9-]`, resolve paths and verify they're within `DEVDOCK_DATA_DIR` |
| Docker socket abuse from API | Elevation of Privilege | Socket access is server-side only; never exposed to user containers (INFRA-04) |

## Sources

### Primary (HIGH confidence)
- package.json -- verified all installed dependency versions
- `src/lib/db/schema.ts` -- environments table schema verified
- `src/lib/config.ts` -- configuration schema verified
- `docker/templates/base-compose.yml` -- template structure verified
- `.env.local` -- environment configuration verified
- VPS environment probed: Docker 28.4.0, Compose v2.39.1, Git 2.43.0, Node v24.13.0
- Docker socket permissions tested: `root:root srw-rw----`, mohed_abbas not in docker group

### Secondary (MEDIUM confidence)
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) -- execFile security guidance
- [dockerode GitHub](https://github.com/apocas/dockerode) -- API patterns for listContainers, inspect
- [Docker Compose CLI docs](https://docs.docker.com/reference/cli/docker/compose/) -- up/down/stop/start commands
- [Drizzle ORM docs](https://orm.drizzle.team/) -- insert/select/update/delete patterns
- [shadcn/ui docs](https://ui.shadcn.com/docs/components/radix/dialog) -- Dialog component API
- [Next.js App Router docs](https://nextjs.org/docs/app/api-reference) -- Route Handler patterns

### Tertiary (LOW confidence)
- Docker Compose `--wait` flag availability in v2.39.1 [ASSUMED -- verify with `docker compose up --help`]
- `com.docker.compose.project` label behavior [ASSUMED -- standard Docker Compose behavior]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified in package.json, no new dependencies needed
- Architecture: HIGH -- patterns derived from locked decisions (D-01 through D-12) and existing codebase
- Pitfalls: HIGH -- Docker socket issue verified by testing on VPS; race conditions are well-known Docker patterns
- Security: HIGH -- follows established patterns (execFile over exec, userId scoping, zod validation)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable infrastructure, unlikely to change)
