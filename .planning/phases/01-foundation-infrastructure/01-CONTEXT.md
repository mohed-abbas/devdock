# Phase 1: Foundation & Infrastructure - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a deployable Next.js application skeleton with PostgreSQL database, nginx reverse proxy integration, base Docker dev container image, and security boundaries. It is the foundation all subsequent phases build on. No user-facing features beyond "the app responds behind HTTPS."

</domain>

<decisions>
## Implementation Decisions

### Nginx Integration
- **D-01:** DevDock uses its own subdomain: `devdock.yourdomain.com` (actual domain TBD at deployment)
- **D-02:** Nginx config is a separate include file in sites-enabled/ (e.g., `devdock.conf`) — completely isolated from production nginx configs. Never modify existing production server blocks.
- **D-03:** TLS via existing certbot setup — add subdomain to existing cert or request a separate one

### Base Dev Container Image
- **D-04:** Base image is Ubuntu 24.04 — full-featured, familiar, all tools available
- **D-05:** Pre-installed tools: Node.js + npm, Python 3, Git + SSH, common CLIs (curl, wget, vim, jq, build-essential)
- **D-06:** Per-project Dockerfiles are supported — each project can customize its own image on top of the base or use a completely custom one
- **D-07:** Claude Code CLI must be pre-installed in the base image

### Database Layout

### Claude's Discretion
- **D-08:** Database setup: Claude decides between new database in existing cluster vs separate instance, optimizing for 8GB RAM VPS constraints. Recommendation: new `devdock` database in existing PostgreSQL cluster with dedicated `devdock` role (saves ~100MB RAM vs separate instance)
- **D-09:** Migration tool: Claude decides — Drizzle Kit is the natural choice given Drizzle ORM in the stack

### Project Location & Deployment
- **D-10:** Development happens locally first (current directory: `/home/mohed_abbas/murx/perso/claudecodevps/`). Deployment to VPS happens after development is complete.
- **D-11:** On VPS, DevDock will run under a new `murx-dev` user (separate from production `murx` user)
- **D-12:** Process management: Claude decides — systemd recommended based on architecture research (native Node.js process, not containerized)

### Build Cache Management
- **D-13:** Threshold-based cache cleanup — auto-prune when disk usage exceeds 80%. Adaptive to actual usage on 100GB NVMe.
- **D-14:** Per-project images allowed — each project can have its own Dockerfile. Shared base image is available but not mandatory.
- **D-15:** Docker daemon config must include log rotation (`max-size: 10m, max-file: 3`) from day one

### VPS Constraints (Critical Context)
- **D-16:** VPS specs: 2 vCPU, 8GB RAM, 100GB NVMe, 8TB bandwidth
- **D-17:** With 8GB RAM: budget ~2GB for host/production, ~512MB for DevDock app, ~5.5GB for dev environments. Max 2-3 concurrent running environments.
- **D-18:** Docker resource limits (mem_limit) are mandatory on every container — deferred to Phase 7 for enforcement but architecture must support it from Phase 1

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, build order, coexistence strategy with /home/murx/
- `.planning/research/STACK.md` — Technology choices with rationale (Next.js, PostgreSQL, Drizzle, dockerode, etc.)

### Security
- `.planning/research/PITFALLS.md` — Critical pitfalls 1-5 (Docker socket, terminal auth, OOM, credential leakage, nginx collision) — all relevant to Phase 1 foundations

### Requirements
- `.planning/REQUIREMENTS.md` — INFRA-01 through INFRA-05 and DASH-06 are this phase's scope

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — this phase establishes the patterns

### Integration Points
- Existing nginx at `/home/murx/shared/nginx` — DevDock adds a server block (on VPS deployment)
- Existing PostgreSQL — DevDock creates a `devdock` database (on VPS deployment)
- Docker daemon at `/var/run/docker.sock` — DevDock API server needs access

</code_context>

<specifics>
## Specific Ideas

- User wants `murx-dev` as the dedicated VPS user for DevDock (separate from production `murx` user)
- Development is local-first — the codebase must be deployable but doesn't need VPS-specific config during development
- Docker build cache is a concern given 100GB NVMe — threshold-based cleanup is the chosen strategy

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-04-08*
