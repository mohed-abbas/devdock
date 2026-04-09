# Phase 3: Environment Lifecycle - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create, start, stop, and delete isolated Docker dev environments with persistent storage and real-time status feedback. Each environment gets its own Docker Compose stack with an isolated network. No web terminal (Phase 4), no GitHub browse-and-select (Phase 5), no dashboard UI polish (Phase 6), no resource limits enforcement (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Creation flow
- **D-01:** User provides a name and optionally a Git repo URL when creating an environment. If URL is provided, the repo is cloned into the workspace. If not, workspace starts empty. Phase 5 later adds GitHub browse-and-select on top.
- **D-02:** User can select sidecar services (PostgreSQL, Redis) via checkboxes at creation time. Checked sidecars are included in the generated Compose file.
- **D-03:** Creation UX is a modal dialog (shadcn/ui Sheet or Dialog) triggered from a "New Environment" button on the dashboard. No dedicated page.
- **D-04:** After creation, the environment auto-starts immediately (`docker compose up`). User sees it transition from 'starting' to 'running'.

### Real-time status
- **D-05:** Dashboard polls an API endpoint every 3-5 seconds to get environment statuses. No WebSocket or SSE infrastructure in this phase — Phase 4 adds WebSockets for terminal.
- **D-06:** Status granularity uses the existing enum only: stopped/starting/running/stopping/error. No per-step progress details (e.g., "Pulling image...").
- **D-07:** Error state shown as a red status badge on the environment card. Hover/click reveals a short error message (e.g., "Container exited with code 1"). Error details stored in a DB column.

### Compose generation
- **D-08:** Compose files generated via string substitution on `docker/templates/base-compose.yml`. Replace `{{PROJECT_SLUG}}`, `{{BASE_IMAGE}}`, etc. For sidecars, uncomment the relevant sections. Write result to project's data directory.
- **D-09:** No Compose file editing in the UI for Phase 3. Power users can edit via terminal in Phase 4.
- **D-10:** Docker lifecycle operations (start/stop/delete) use `docker compose` CLI via `child_process`. dockerode reserved for container inspection and stats. Same commands you'd run manually — debuggable.

### Data directory layout
- **D-11:** Flat structure: `DEVDOCK_DATA_DIR/{env-slug}/docker-compose.yml` and `DEVDOCK_DATA_DIR/{env-slug}/workspace/` (for cloned repo). Each environment is one directory.
- **D-12:** Full cleanup on delete: removes containers, network, volumes, AND the data directory (compose file + workspace). User sees a confirmation dialog ("Are you sure you want to delete {name}?") before proceeding.

### Claude's Discretion
- Exact polling interval (3-5 second range)
- Docker Compose project naming convention (e.g., `devdock-{slug}`)
- Error message extraction from Docker output
- Slug generation from environment name
- API route structure for environment CRUD
- Form validation approach (client-side vs server-side)
- How repo cloning is handled (git clone in the container vs on host before start)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Stack
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, coexistence strategy with /home/murx/
- `.planning/research/STACK.md` — Technology choices (dockerode, Docker Compose, Next.js API routes)

### Security
- `.planning/research/PITFALLS.md` — Docker socket access restrictions (INFRA-04), no published ports (INFRA-05), OOM prevention

### Requirements
- `.planning/REQUIREMENTS.md` — ENV-01 through ENV-07 are this phase's scope

### Schema
- `src/lib/db/schema.ts` — `environments` table with status enum, slug, composeConfig JSONB, dockerProjectName, networkName fields already defined

### Config
- `src/lib/config.ts` — `DOCKER_SOCKET`, `DEVDOCK_DATA_DIR`, `DEVDOCK_MAX_CONCURRENT_ENVS` already validated via zod

### Docker Templates
- `docker/templates/base-compose.yml` — Template with `{{PROJECT_SLUG}}`, `{{BASE_IMAGE}}`, `{{HOST_UID}}`, `{{HOST_GID}}` variables and commented-out sidecar sections

### Prior Phase Context
- `.planning/phases/01-foundation-infrastructure/01-CONTEXT.md` — VPS specs (8GB RAM, 100GB NVMe), base image decisions, Docker daemon config, threshold-based cache cleanup
- `.planning/phases/02-authentication/02-CONTEXT.md` — Auth.js v5 patterns, middleware route protection, session handling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/db/schema.ts` — `environments` table fully defined with all needed fields (status, slug, composeConfig, dockerProjectName, networkName, memoryLimit, cpuLimit, lastActivityAt)
- `src/lib/config.ts` — Docker socket path, data dir, max concurrent envs already configured
- `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `label.tsx` — shadcn/ui components for environment creation form
- `docker/templates/base-compose.yml` — Ready-to-use Compose template with variable placeholders and commented sidecar sections
- `src/lib/db/index.ts` — Database connection client ready for environment queries
- `src/middleware.ts` — Auth middleware already protects `/dashboard/*` and `/api/*` routes

### Established Patterns
- Dark mode by default, Inter font, Tailwind CSS + shadcn/ui
- Drizzle ORM for database access
- Zod for runtime validation
- Auth.js v5 JWT sessions with middleware-based route protection
- API routes under `src/app/api/`
- Server actions pattern (used in auth — `src/lib/auth/actions.ts`)

### Integration Points
- `src/app/dashboard/page.tsx` — Current placeholder, will be replaced with environment list
- `src/app/dashboard/layout.tsx` — Dashboard layout with header/logout, wraps all dashboard pages
- `src/app/api/` — New environment CRUD routes go here
- Docker socket at `/var/run/docker.sock` — API server accesses for lifecycle operations

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-environment-lifecycle*
*Context gathered: 2026-04-10*
