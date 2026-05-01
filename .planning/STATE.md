---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: "Completed 999.2.2-01-PLAN.md — Phase 999.2 approved (nyquist_compliant: true)"
last_updated: "2026-04-19T14:20:35.847Z"
last_activity: 2026-04-19
progress:
  total_phases: 11
  completed_phases: 9
  total_plans: 35
  completed_plans: 35
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-08)

**Core value:** Enable productive remote development on any project from anywhere so a Claude Code Max subscription isn't wasted
**Current focus:** Phase null — fix-compose-mounts-and-terminal-env

## Current Position

Phase: 999.2.2
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-05-01 - Completed quick task 260501-mqx: Fix terminal Socket.IO CORS + bind host (cascade)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 21
- Average duration: ~4min
- Total execution time: ~24min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | ~12min | ~4min |
| 02 | 3 | ~14min | ~5min |
| 03 | 4 | - | - |
| 05 | 4 | - | - |
| 06 | 6 | - | - |
| 999.2.2 | 1 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01-foundation-infrastructure P01 | 6min | 2 tasks | 16 files |
| Phase 01 P02 | 2min | 2 tasks | 7 files |
| Phase 01 P03 | 4min | 2 tasks | 2 files |
| Phase 02-authentication P01 | 5min | 2 tasks | 10 files |
| Phase 02-authentication P02 | 3min | 2 tasks | 5 files |
| Phase 02-authentication P03 | 6min | 2 tasks | 7 files |
| Phase 03-environment-lifecycle P03 | 14min | 2 tasks | 13 files |
| Phase 03-environment-lifecycle P04 | 12min | 2 tasks | 1 files |
| Phase 999.2.2 P01 | 24min | 3 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Stack: Next.js 15 + PostgreSQL 16 + Drizzle ORM + dockerode + xterm.js + Auth.js v5
- Infrastructure: Use existing nginx (not Caddy), PostgreSQL (not SQLite)
- Security: Docker socket never mounted into user containers
- [Phase 01-foundation-infrastructure]: Pinned zod to v3.25.76 (NOT v4) for Auth.js/Drizzle ecosystem compatibility
- [Phase 01-foundation-infrastructure]: DATABASE_URL read directly from process.env in db/index.ts to avoid circular deps with drizzle-kit
- [Phase 01-foundation-infrastructure]: Inter font as default sans-serif per shadcn/ui conventions and UI-SPEC
- [Phase 01-foundation-infrastructure]: Non-root dev user with configurable UID/GID in Dockerfile for host volume permission matching
- [Phase 01-foundation-infrastructure]: No published ports on any Compose service -- internal network only (INFRA-05)
- [Phase 01-foundation-infrastructure]: Progressive Docker cleanup strategy: dangling -> containers -> build cache -> aggressive system prune at 80% disk threshold
- [Phase 01]: drizzle.config.ts loads .env.local before .env fallback (Next.js convention for non-Next processes)
- [Phase 01]: Health check API returns generic status on error, never exposes error.message or stack traces (T-03-01)
- [Phase 02]: Auth.js v5 edge-safe split pattern: auth.config.ts (middleware) + auth.ts (full Credentials provider with bcrypt/DB)
- [Phase 02]: NEXTAUTH_SECRET renamed to AUTH_SECRET per Auth.js v5 convention
- [Phase 02]: In-memory rate limiter (5 attempts / 30s cooldown) -- resets on server restart, acceptable for single-user tool
- [Phase 02]: LogoutButton uses form action pattern for progressive enhancement
- [Phase 02]: SessionProvider added to root layout proactively for future client components
- [Phase 03-environment-lifecycle]: Title attribute for error tooltip on StatusBadge -- simplest cross-platform approach
- [Phase 03-environment-lifecycle]: Dashboard _components directory pattern for page-specific client components
- [Phase 03-environment-lifecycle]: Externalize dockerode/ssh2 via serverExternalPackages for Next.js build (native addons cannot be bundled)
- [Phase 03-environment-lifecycle]: Raise fs.inotify.max_user_watches on VPS so next dev can boot
- [Phase 06-dashboard-monitoring]: API-proxied preview route (no nginx config regeneration needed)
- [Phase 06-dashboard-monitoring]: Preview proxy returns 404 (not 403) for unauthorized environments to avoid information disclosure
- [Phase 06-dashboard-monitoring]: Reuse terminal server Socket.IO instance for /logs namespace (same HMAC auth pattern)
- [Phase 06-dashboard-monitoring]: Docker log demux via docker.modem.demuxStream() to prevent binary garbage
- [Phase 06-dashboard-monitoring]: Exclude data/ from tsconfig to prevent dev environment workspaces from breaking builds
- [Phase 999.2.2]: Terminal service DATABASE_URL wired via single compose env line mirroring app service (GAP-5 closed; D-05)
- [Phase 999.2.2]: .env.example absolute-host-path policy: blank DEVDOCK_DATA_DIR + comment blocks for three bind-mount vars (GAP-4 closed; D-02)
- [Phase 999.2.2]: Cascade deviations auto-fixed in docker-compose.yml (Rule 3): absolute tsx path command + GITHUB_* empty-string passthrough removal; zod .optional() requires undefined not empty string

### Roadmap Evolution

- Phase 999.2.1 inserted after Phase 999.2 on 2026-04-19: gap-closure for entrypoint POSTGRES_PORT support + Dockerfile builder placeholder env vars (URGENT — surfaced by Plan 10's E2E gate)
- Phase 999.2.2 inserted after Phase 999.2.1 on 2026-04-19: continuation gap-closure — compose mount-path policy (GAP-4) + terminal service DATABASE_URL wiring (GAP-5). Surfaced after 999.2.1 unblocked the earlier stages of Plan 10's gate. Scope: make `stack-smoke × 2` green end-to-end, flip remaining VALIDATION.md rows, set `nyquist_compliant: true`.

### Pending Todos

None yet.

### Blockers/Concerns

- Open question: VPS RAM/disk capacity (affects concurrent environment cap in Phase 7)
- Open question: Exact nginx config structure under /home/murx/shared/nginx
- Open question: Whether mohed_abbas is in the docker group

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260426-vk1 | Fix GitHub OAuth state cookie not surviving callback on http://localhost | 2026-04-26 | 1ace7d6 | [260426-vk1-fix-github-oauth-state-cookie-not-surviv](./quick/260426-vk1-fix-github-oauth-state-cookie-not-surviv/) |
| 260501-gx3 | Harden GitHub OAuth callback redirects to use AUTH_URL as canonical host | 2026-05-01 | 333befb | [260501-gx3-harden-github-oauth-callback-redirects-t](./quick/260501-gx3-harden-github-oauth-callback-redirects-t/) |
| 260501-ia1 | Fix Turbopack 500: cannot resolve shadcn/tailwind.css import in src/app/globals.css | 2026-05-01 | af6d8fb | [260501-ia1-fix-turbopack-500-cannot-resolve-shadcn-](./quick/260501-ia1-fix-turbopack-500-cannot-resolve-shadcn-/) |
| 260501-ihv | Fix auth host-mismatch ghost dashboard: canonicalize requests to AUTH_URL host at Caddy edge | 2026-05-01 | 0641e0a | [260501-ihv-fix-auth-host-mismatch-ghost-dashboard-c](./quick/260501-ihv-fix-auth-host-mismatch-ghost-dashboard-c/) |
| 260501-mqx | Fix terminal Socket.IO CORS by switching to same-origin connection; cascade-fixed terminal-server bind from 127.0.0.1 → 0.0.0.0 | 2026-05-01 | 93e2a08 | [260501-mqx-fix-terminal-socket-io-cors-by-switching](./quick/260501-mqx-fix-terminal-socket-io-cors-by-switching/) |

## Session Continuity

Last session: 2026-04-19T14:14:36.109Z
Stopped at: Completed 999.2.2-01-PLAN.md — Phase 999.2 approved (nyquist_compliant: true)
Resume file: None
