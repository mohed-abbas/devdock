# DevDock

## What This Is

A self-hosted remote development platform that runs on a Linux VPS. It provides a web dashboard for managing isolated, on-demand dev environments alongside production app monitoring. Users connect their GitHub, spin up per-project Docker environments with full infrastructure (Postgres, Redis, etc.), and work through web terminals with Claude Code and developer tools pre-configured.

## Core Value

Enable productive remote development on any project from anywhere — laptop, phone, or web browser — so a Claude Code Max subscription isn't wasted when you can't sit at your main machine.

## Requirements

### Validated

- [x] Accessible via HTTPS from any device — Validated in Phase 1: nginx reverse proxy with TLS, WebSocket support
- [x] Per-project isolated infrastructure — Validated in Phase 1: Docker Compose template with per-project networks, no published ports
- [x] Claude Code CLI available inside every dev environment — Validated in Phase 1: base Dockerfile installs Claude Code CLI

### Active

- [ ] Web dashboard with username/password authentication (multi-user)
- [ ] Simple role system: admin (configures system) vs regular user (works on projects)
- [ ] GitHub account connection — browse and select repos to clone
- [ ] On-demand dev environment provisioning per project (Docker Compose)
- [ ] Per-project isolated infrastructure: own Postgres, Redis, and services
- [ ] Dev environments spin up when working, shut down when done
- [ ] Web terminal (e.g., ttyd/xterm.js) into each project's environment
- [ ] Claude Code CLI available inside every dev environment
- [ ] Shared ~/.claude config mounted into environments (GSD, SuperClaude, skills)
- [ ] Production app monitoring — read-only view of apps under /home/murx/apps/
- [ ] Dashboard shows both dev environments and production apps in unified view
- [ ] Project lifecycle: add from GitHub → spin up → work → shut down
- [ ] Accessible via HTTPS from any device

### Out of Scope

- Deploying to production from dev environments — this is a dev platform, not CI/CD
- Mobile-native app — web interface works on mobile browsers
- IDE integration (VS Code remote, JetBrains Gateway) — web terminal is the interface
- Multi-VPS orchestration — single server only
- Automated testing pipelines — Claude Code handles testing within projects
- Project billing or usage tracking per user

## Context

- VPS runs Linux with existing production setup under `/home/murx/`
- Production structure: `/home/murx/apps/` (projects) and `/home/murx/shared/` (nginx, postgres, certbot, redis)
- User has Claude Code Max Plan 5x (~100 EUR/month) and wants to maximize usage across projects
- Development is done entirely by Claude Code — the user decides which project to work on, Claude does the coding
- Current pain point: can't easily jump between multiple projects (office + personal + client) with Claude Code
- The `mohed_abbas` user on the VPS is where this dev platform will live
- Skills/frameworks in use: GSD (Get Shit Done), SuperClaude — must be available in dev environments

## Constraints

- **Infrastructure**: Single VPS — must be resource-conscious with on-demand environments
- **Security**: Dashboard exposed to internet — needs proper auth, HTTPS, and isolation between projects
- **Coexistence**: Must not interfere with existing production setup under /home/murx/
- **Docker**: Per-project isolation via Docker Compose — each project gets its own stack
- **Simplicity**: Keep the stack simple and maintainable by one person

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Per-project Docker Compose for dev isolation | Full infrastructure isolation without VM overhead | — Pending |
| Shared ~/.claude config mounted into containers | Avoids duplicating GSD/SuperClaude setup per project | — Pending |
| Web terminal (not SSH tunnels) as primary interface | Accessible from any device including phone | — Pending |
| On-demand environments (not always-running) | VPS resource constraints — single server | — Pending |
| Multi-user with simple admin/regular roles | Future-proofing for potential collaborators | — Pending |
| GitHub app integration for repo browsing | Better UX than pasting URLs, supports private repos | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-14 after Phase 5 completion — GitHub Integration (OAuth, repo browsing, encrypted token storage, enhanced creation dialog)*
