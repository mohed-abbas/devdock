# Roadmap: DevDock

## Overview

DevDock delivers a self-hosted remote development platform in seven phases, progressing from infrastructure foundation through authentication, environment lifecycle, web terminal, GitHub integration, dashboard, and resilience hardening. Each phase delivers a complete, verifiable capability — starting with a working scaffold behind HTTPS, building up to fully isolated Docker dev environments with Claude Code, and finishing with resource governance for safe single-VPS operation.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Infrastructure** - Project scaffolding, PostgreSQL schema, nginx/HTTPS, base Docker image, security boundaries
- [ ] **Phase 2: Authentication** - Username/password login, secure sessions, logout, CSRF protection
- [ ] **Phase 3: Environment Lifecycle** - Docker Compose environment CRUD, isolation, persistent storage, real-time status
- [ ] **Phase 4: Web Terminal & Claude Code** - Browser terminal via xterm.js/WebSocket, Claude Code CLI, shared config mount
- [ ] **Phase 5: GitHub Integration** - OAuth connection, repo browsing, clone-on-create, encrypted token storage
- [ ] **Phase 6: Dashboard & Monitoring** - Unified environment/production view, logs, preview URLs, environment controls
- [ ] **Phase 7: Resilience & Resource Management** - Memory/CPU limits, idle auto-stop, concurrent environment cap

## Phase Details

### Phase 1: Foundation & Infrastructure
**Goal**: A deployable application skeleton exists behind HTTPS with database, base Docker image, and security boundaries — ready for features to build on
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. Next.js application starts and responds to HTTP requests behind nginx with valid HTTPS
  2. PostgreSQL database is connected with initial schema (users, environments tables)
  3. Base dev container image builds successfully with common tools (git, node, python) and can be started
  4. Docker socket is accessible only to the API server process — not mountable into user containers
  5. Per-project containers use internal Docker networks with no ports published to the host
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Next.js 15 scaffold, Drizzle schema, DB client, shadcn/ui, root layout
- [x] 01-02-PLAN.md — Docker base image, Compose templates, daemon config, nginx, systemd
- [ ] 01-03-PLAN.md — Health check API, schema push, end-to-end verification

### Phase 2: Authentication
**Goal**: Users can securely access their accounts with persistent sessions protected against common web attacks
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. User can log in with username and password and see a protected page
  2. Session persists across browser refresh and new tabs without re-login
  3. User can log out from any page and is redirected to the login screen
  4. Requests are protected with HTTP-only cookies and CSRF tokens — direct API calls without valid CSRF are rejected
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Environment Lifecycle
**Goal**: Users can create, start, stop, and delete isolated Docker dev environments with persistent storage and real-time status feedback
**Depends on**: Phase 2
**Requirements**: ENV-01, ENV-02, ENV-03, ENV-04, ENV-05, ENV-06, ENV-07
**Success Criteria** (what must be TRUE):
  1. User can create a new dev environment that provisions a dedicated Docker Compose stack with its own network
  2. User can start a stopped environment and stop a running one — volumes persist across stop/start cycles
  3. User can delete an environment, removing its containers, network, and volumes
  4. Environment status (running/stopped/error/starting) updates in real-time without manual page refresh
  5. Each environment can include sidecar services (Postgres, Redis) defined in its Compose file
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Web Terminal & Claude Code
**Goal**: Users can open a browser-based terminal into any running environment with Claude Code and shared developer tools ready to use
**Depends on**: Phase 3
**Requirements**: TERM-01, TERM-02, TERM-03, TERM-04, TERM-05
**Success Criteria** (what must be TRUE):
  1. User can open a web terminal connected to a running environment from the dashboard
  2. Terminal supports resize, standard key bindings, and clipboard operations
  3. Terminal connection is proxied through the authenticated API — unauthenticated WebSocket connections are rejected
  4. Claude Code CLI is functional inside the environment (user can run `claude` and get a response)
  5. Shared ~/.claude config (GSD, SuperClaude, skills) is available read-only inside the environment
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: GitHub Integration
**Goal**: Users can connect their GitHub account and create dev environments directly from their repositories, including private ones
**Depends on**: Phase 2, Phase 3
**Requirements**: AUTH-05, GH-01, GH-02, GH-03, GH-04, GH-05
**Success Criteria** (what must be TRUE):
  1. User can connect their GitHub account via OAuth from a settings or dashboard page
  2. User can browse their accessible repositories (including private repos) from within DevDock
  3. User can select a repo when creating an environment — the repo is cloned into the new environment automatically
  4. GitHub OAuth tokens are stored encrypted at rest in the database — not in plaintext
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Dashboard & Monitoring
**Goal**: Users have a unified web interface showing all dev environments and production apps with full lifecycle controls, logs, and preview access
**Depends on**: Phase 3, Phase 4, Phase 5
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Dashboard displays all dev environments with visual status indicators (running/stopped/error)
  2. User can create, start, stop, and delete environments directly from the dashboard UI
  3. Dashboard shows production apps from /home/murx/apps/ as read-only entries alongside dev environments
  4. User can view live-streamed container logs in the web UI for any running environment
  5. User can access web apps running inside containers via preview URLs (port forwarding through the platform)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

### Phase 7: Resilience & Resource Management
**Goal**: The platform safely manages VPS resources by enforcing per-environment limits, stopping idle environments, and capping concurrency to prevent system-wide failures
**Depends on**: Phase 3
**Requirements**: ENV-08, ENV-09, ENV-10
**Success Criteria** (what must be TRUE):
  1. Each environment has configurable memory and CPU limits that Docker enforces — a runaway process in one environment cannot starve the host
  2. Idle environments automatically stop after a configurable timeout period
  3. System refuses to start a new environment when the concurrent running environment cap is reached, with a clear error message
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Infrastructure | 0/3 | Planned | - |
| 2. Authentication | 0/2 | Not started | - |
| 3. Environment Lifecycle | 0/3 | Not started | - |
| 4. Web Terminal & Claude Code | 0/3 | Not started | - |
| 5. GitHub Integration | 0/3 | Not started | - |
| 6. Dashboard & Monitoring | 0/3 | Not started | - |
| 7. Resilience & Resource Management | 0/2 | Not started | - |
