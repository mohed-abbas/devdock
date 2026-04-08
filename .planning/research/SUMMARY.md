# Project Research Summary — DevDock

**Project:** DevDock
**Domain:** Self-hosted remote development platform (single-VPS, Claude Code-centric)
**Researched:** 2026-04-08
**Confidence:** MEDIUM

## Executive Summary

DevDock is a personal/small-team remote development platform running on a single VPS that provides browser-accessible dev environments via Docker Compose, with Claude Code pre-installed in every environment. The architecture is a monolithic Next.js API server that directly controls the Docker daemon, generates per-project Compose stacks, and serves the web dashboard — all from one process. The critical path is: auth → environment lifecycle → web terminal → Claude Code integration.

## Recommended Stack

- **Next.js 15 (App Router):** Full-stack framework — dashboard UI + REST API + WebSocket in one deployable
- **TypeScript 5.6:** Type safety for Docker and GitHub API shapes
- **PostgreSQL 16:** Relational state + LISTEN/NOTIFY for real-time status push — already running on VPS
- **Drizzle ORM 0.39:** Lightweight, SQL-transparent ORM
- **Auth.js v5 (@auth/nextjs):** Session management, CSRF, JWT, route protection
- **dockerode 4:** Docker Engine API client for container lifecycle, logs, stats, exec
- **Docker Compose CLI v2:** Per-project stack orchestration
- **xterm.js 5.5 + Socket.IO 4.8:** Browser terminal with auto-reconnect
- **@octokit/rest 21:** GitHub REST API client
- **Tailwind CSS 4 + shadcn/ui:** UI components
- **systemd:** Process management
- **Nginx (existing):** TLS + routing via added server block

**Do not use:** Kubernetes, Prisma, Lucia Auth, Redis (for platform state), GraphQL, tRPC, Caddy, PM2.

## Table Stakes Features

| Feature | Why |
|---------|-----|
| Web authentication | Gate everything behind login |
| One-click environment spin-up | Core promise — Docker Compose behind a button |
| Web terminal (xterm.js) | Primary interface for Claude Code work |
| Start/stop controls + status | Resource management on single VPS |
| Per-project isolation | Separate Docker networks per project |
| Persistent storage | Named Docker volumes survive stop/start |
| HTTPS | Internet-exposed service requires TLS |
| Claude Code pre-installed | Core differentiator — no competitor does this |
| Shared ~/.claude config | GSD/SuperClaude everywhere without per-project setup |

## Key Differentiators

- **Claude Code + GSD/SuperClaude in every environment** — unique to DevDock
- **Unified dev + production dashboard** — see what you're building alongside what's shipped
- **Auto-shutdown on inactivity** — essential for single-VPS resource management
- **Port forwarding / preview URLs** — access web apps in containers from browser

## Architecture Overview

Monolithic Node.js process with 6 modules:
1. **Nginx (existing)** — TLS, subdomain routing
2. **API Server** — HTTP + WebSocket, all business logic, Next.js frontend
3. **Auth Module** — sessions, bcrypt, admin/user roles
4. **Docker Environment Manager** — Compose template generation, lifecycle, status
5. **Web Terminal Bridge** — WebSocket proxy: browser → docker exec → container bash
6. **GitHub Integration** — encrypted token storage, repo listing, git clone

Each project gets: dedicated Docker network, named volumes, generated `docker-compose.yml`, optional sidecar services (Postgres, Redis).

## Top 5 Pitfalls

1. **Docker socket exposure** — Never mount socket into user containers. Orchestrator-only. Phase 1 decision.
2. **Unauthenticated terminal** — Never expose exec ports. Proxy all terminals through authenticated API server.
3. **OOM killer kills production** — `mem_limit` on every container. Cap concurrent environments. Add swap.
4. **Credential leakage via shared mounts** — Mount tools read-only. Per-user credential volumes.
5. **Nginx collision with production** — Add server block in separate include file. Never touch production blocks.

## Build Order

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| 1 | Foundation & Infrastructure | Scaffolding, PostgreSQL schema, Docker daemon config, nginx server block, base Dockerfile, UID matching |
| 2 | Authentication | Login/logout, sessions, admin/user roles, protected API skeleton |
| 3 | Docker Lifecycle | Environment CRUD, Compose generation, start/stop/destroy, status tracking, resource limits |
| 4 | Web Terminal + Claude Code | xterm.js + Socket.IO, docker exec bridge, Claude Code in base image, ~/.claude mount |
| 5 | Dashboard + Prod Monitoring | Project list UI, status indicators, logs viewer, read-only production app view |
| 6 | GitHub Integration | Token storage (encrypted), repo browsing, clone on environment creation |
| 7 | Resilience & Polish | Auto-shutdown, LRU eviction, per-project services, port forwarding |

## Open Questions

- Auth.js v5: Is it fully stable? Has API changed since beta?
- VPS resources: How much RAM/disk? (Determines concurrent environment limits)
- Nginx config: What's the structure under `/home/murx/shared/nginx`?
- Docker socket: Is `mohed_abbas` in the `docker` group?
- GitHub App vs OAuth App: Final decision needed before Phase 6

---
*Research completed: 2026-04-08*
*Ready for roadmap: yes*
