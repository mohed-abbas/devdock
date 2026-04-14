# Phase 6: Dashboard & Monitoring - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users have a unified web interface showing all dev environments and production apps with full lifecycle controls, live-streamed logs, and preview URL access. This phase delivers: production app discovery and read-only display, container log streaming UI, preview URL port forwarding via nginx, and dashboard layout polish with two-section design. No resource limits (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Production Apps View
- **D-01:** Production apps discovered by scanning Docker containers/compose projects running under the configurable production apps directory. Shows real-time status from Docker API. No manual config needed.
- **D-02:** `PRODUCTION_APPS_DIR` env var in config.ts (default: `/home/murx/apps/`). If not set or path doesn't exist, production section is disabled entirely. Makes DevDock reusable on other setups.
- **D-03:** Each production app card shows: container status (running/stopped), uptime duration, and exposed ports. Enough to monitor at a glance.
- **D-04:** Production app cards are strictly read-only. No start/stop/delete buttons. View-only monitoring to prevent accidental interference with live production apps.
- **D-05:** When no production apps are found, the "Production Apps" section is hidden entirely. Dashboard shows only dev environments. Production monitoring is opt-in by having apps.

### Container Logs UI
- **D-06:** Dedicated logs page at `/dashboard/env/[id]/logs`. Full-screen scrolling logs with small header (back button, environment name, status indicator). Similar layout to the terminal page.
- **D-07:** Logs streamed from the main container only. Sidecar logs (Postgres, Redis) are not shown — they're infrastructure noise for most users.
- **D-08:** Log streaming transported via Socket.IO — reuse the existing terminal Socket.IO server (Phase 4). Add a 'logs' namespace. Same auth pattern (short-lived token), no new infrastructure.
- **D-09:** "Logs" button added to environment cards (alongside Terminal button). Only shown when environment is running.

### Preview URLs / Port Forwarding
- **D-10:** Path-based proxy via nginx. Access web apps at `devdock.example.com/preview/{env-slug}/`. No wildcard DNS or additional TLS certs needed. Works with existing single-domain setup.
- **D-11:** User specifies preview port at creation time (optional field in creation dialog, default: 3000). Stored in DB. Simple, predictable — user knows what port their app runs on.
- **D-12:** "Preview" button on environment card (with external link icon), next to Terminal button. Opens in a new tab. Only shown when environment is running and has a preview port configured.
- **D-13:** Nginx proxy rules created/updated dynamically when environments start/stop. Approach is Claude's discretion (template generation + reload, or dynamic upstream config).

### Dashboard Layout
- **D-14:** Two sections on one page: "Dev Environments" at top with create button, "Production Apps" below. Same page, clear visual separation with section headers.
- **D-15:** Environment cards enhanced with: Preview button (when port configured), Logs button (when running). Terminal button stays. Compact additions to the existing card footer.
- **D-16:** Production app cards reuse the same Card component but with a "Production" label/badge and no action buttons. Consistent look, clear distinction via badge color.

### Claude's Discretion
- Nginx dynamic proxy rule management approach (template + reload vs upstream config)
- Log page controls (auto-scroll toggle, clear, search/filter)
- Log buffer size and retention in the browser
- Production app Docker container discovery heuristics (compose project naming, label-based)
- Preview port field placement and validation in creation dialog
- Production card badge styling (color, position)
- Socket.IO logs namespace structure and event names
- How production app uptime is calculated from Docker inspect data

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Stack
- `.planning/research/ARCHITECTURE.md` -- Component boundaries, data flow, coexistence strategy with /home/murx/
- `.planning/research/STACK.md` -- Technology choices (dockerode, Socket.IO, xterm.js, nginx)

### Security
- `.planning/research/PITFALLS.md` -- Docker socket access restrictions (INFRA-04), no published ports (INFRA-05)

### Requirements
- `.planning/REQUIREMENTS.md` -- DASH-01 through DASH-05 are this phase's scope

### Schema & Config
- `src/lib/db/schema.ts` -- Environments table (status, slug, dockerProjectName, repoUrl, branch)
- `src/lib/config.ts` -- Existing env var validation via zod (PRODUCTION_APPS_DIR will be added)

### Docker
- `src/lib/docker/docker-service.ts` -- Existing Docker operations (compose up/down, dockerode instance, container inspection)
- `docker/templates/base-compose.yml` -- Compose template

### Terminal Server (for Socket.IO reuse)
- `src/lib/terminal/types.ts` -- Terminal type definitions
- Socket.IO server setup from Phase 4 (standalone terminal server with token auth)

### Existing Dashboard Components
- `src/app/dashboard/page.tsx` -- Current dashboard page (EnvironmentList only)
- `src/app/dashboard/_components/environment-card.tsx` -- Card with status, start/stop/delete, terminal button
- `src/app/dashboard/_components/environment-list.tsx` -- Card grid with loading/empty states
- `src/app/dashboard/_components/status-badge.tsx` -- Status indicator component
- `src/app/dashboard/_components/create-environment-dialog.tsx` -- Creation dialog (preview port field will be added)
- `src/hooks/use-environments.ts` -- Polling hook pattern for environment status

### Prior Phase Context
- `.planning/phases/03-environment-lifecycle/03-CONTEXT.md` -- Docker lifecycle, polling for status, compose generation, data directory layout
- `.planning/phases/04-web-terminal-claude-code/04-CONTEXT.md` -- Socket.IO transport, token auth, terminal page layout, standalone terminal server
- `.planning/phases/05-github-integration/05-CONTEXT.md` -- Settings page, creation dialog enhancements, OAuth patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/dashboard/_components/environment-card.tsx` -- Card component with start/stop/delete/terminal buttons. Will be extended with Logs and Preview buttons.
- `src/app/dashboard/_components/environment-list.tsx` -- Card grid with responsive columns (1/2/3). Will become the "Dev Environments" section.
- `src/app/dashboard/_components/status-badge.tsx` -- Status indicator reusable for both dev and production cards.
- `src/hooks/use-environments.ts` -- Polling hook pattern. Can inform production apps polling hook.
- `src/lib/docker/docker-service.ts` -- dockerode instance for container inspection, stats, log streaming.
- `src/components/ui/card.tsx`, `badge.tsx`, `button.tsx`, `tabs.tsx`, `skeleton.tsx` -- shadcn/ui components available.
- Socket.IO terminal server (Phase 4) -- Reuse for log streaming namespace.

### Established Patterns
- Dark mode by default, Inter font, Tailwind CSS + shadcn/ui
- Dashboard `_components/` directory for page-specific client components
- Polling-based status updates (3-5s interval via useEnvironments hook)
- Dedicated pages for full-screen features (terminal at `/dashboard/env/[id]/terminal`)
- Docker operations via `execFile` for CLI, dockerode for inspection
- Auth middleware protecting `/dashboard/*` and `/api/*` routes
- Short-lived token auth for Socket.IO connections

### Integration Points
- `src/app/dashboard/page.tsx` -- Restructure to show two sections (Dev Environments + Production Apps)
- `src/app/dashboard/_components/environment-card.tsx` -- Add Logs and Preview buttons
- `src/app/dashboard/_components/create-environment-dialog.tsx` -- Add optional preview port field
- `src/app/dashboard/env/[id]/logs/` -- New route for dedicated logs page
- `src/lib/config.ts` -- Add PRODUCTION_APPS_DIR env var
- Socket.IO terminal server -- Add logs namespace alongside terminal namespace
- Nginx config -- Add dynamic preview proxy rules per environment

</code_context>

<specifics>
## Specific Ideas

- Production section should be fully modular -- if no production apps exist (or PRODUCTION_APPS_DIR is not configured), the section simply doesn't render. DevDock works purely as a dev environment manager.
- Logs page layout should mirror the terminal page (full-screen, minimal header) for consistency.
- Preview URL uses path-based proxying to avoid wildcard DNS complexity on a single-domain VPS setup.
- Sidecar containers (Postgres, Redis) are optional infrastructure from Phase 3 -- their logs are not surfaced in the logs UI.

</specifics>

<deferred>
## Deferred Ideas

- **Additional sidecar types** -- MongoDB, MySQL, Elasticsearch, etc. beyond Postgres/Redis. Would be a backlog item for expanding environment templates.
- **Production app log viewing** -- Currently production cards are strictly read-only. A future phase could add read-only log viewing for production apps.
- **Resource usage on production cards** -- CPU/memory metrics. Decided against for now (requires Docker stats polling), but could be added later.

</deferred>

---

*Phase: 06-dashboard-monitoring*
*Context gathered: 2026-04-14*
