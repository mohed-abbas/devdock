# Requirements: DevDock

**Defined:** 2026-04-08
**Core Value:** Enable productive remote development on any project from anywhere so a Claude Code Max subscription isn't wasted

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can log in with username and password
- [ ] **AUTH-02**: Sessions are secured with HTTP-only cookies and CSRF protection
- [ ] **AUTH-03**: User can log out from any page
- [ ] **AUTH-04**: User session persists across browser refresh
- [ ] **AUTH-05**: User can connect their GitHub account via OAuth for repo access

### Environment Lifecycle

- [x] **ENV-01**: User can create a new dev environment from a GitHub repo
- [x] **ENV-02**: Each environment gets its own isolated Docker network
- [x] **ENV-03**: Each environment gets persistent storage via named Docker volumes
- [x] **ENV-04**: User can start a stopped environment
- [x] **ENV-05**: User can stop a running environment (preserves volumes)
- [x] **ENV-06**: User can delete an environment and its resources
- [x] **ENV-07**: Environment status is visible in real-time (running/stopped/error/starting)
- [ ] **ENV-08**: Each environment has configurable memory and CPU limits
- [ ] **ENV-09**: Idle environments auto-stop after configurable timeout
- [ ] **ENV-10**: System caps concurrent running environments to prevent OOM

### Web Terminal

- [ ] **TERM-01**: User can open a web terminal into any running environment
- [ ] **TERM-02**: Terminal uses xterm.js with WebSocket proxy through authenticated API
- [ ] **TERM-03**: Terminal supports window resize and standard key bindings
- [ ] **TERM-04**: Claude Code CLI is pre-installed and functional in every environment
- [ ] **TERM-05**: Shared ~/.claude config (GSD, SuperClaude, skills) is mounted read-only

### GitHub Integration

- [ ] **GH-01**: User can connect their GitHub account via OAuth
- [ ] **GH-02**: User can browse their accessible repositories from the dashboard
- [ ] **GH-03**: User can select a repo to clone when creating an environment
- [ ] **GH-04**: GitHub OAuth tokens are stored encrypted at rest
- [ ] **GH-05**: Private repositories are accessible with proper OAuth scopes

### Dashboard

- [ ] **DASH-01**: Dashboard shows all dev environments with status indicators
- [ ] **DASH-02**: User can create/start/stop/delete environments from the dashboard
- [ ] **DASH-03**: Dashboard shows production apps from /home/murx/apps/ (read-only)
- [ ] **DASH-04**: User can view container logs streamed in the web UI
- [ ] **DASH-05**: User can access web apps in containers via preview URLs (port forwarding)
- [x] **DASH-06**: Dashboard is accessible via HTTPS from any device

### Infrastructure

- [x] **INFRA-01**: Each environment can include sidecar services (Postgres, Redis) via Compose
- [x] **INFRA-02**: Base dev container image includes common tools (git, node, python, etc.)
- [x] **INFRA-03**: DevDock runs behind existing nginx with its own server block
- [x] **INFRA-04**: Docker socket access is restricted to the API server only (never in user containers)
- [x] **INFRA-05**: Per-project services do not publish ports to host (internal network only)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Multi-User

- **USER-01**: Admin can create and manage user accounts
- **USER-02**: Admin vs regular user role enforcement on all API routes
- **USER-03**: Users can only see and manage their own environments
- **USER-04**: Per-user resource quotas (max environments, max memory)

### Polish

- **POLISH-01**: Environment templates/presets (Node+Postgres, Python+Redis, etc.)
- **POLISH-02**: Quick-resume: fast restart of stopped environments (< 5 seconds)
- **POLISH-03**: Mobile-optimized terminal layout with touch-friendly controls
- **POLISH-04**: Simple file browser for quick config edits without terminal

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full IDE in browser (VS Code Server) | Claude Code in terminal is the interface; IDE adds massive complexity |
| Kubernetes orchestration | Single VPS — Docker Compose is the right abstraction |
| CI/CD pipeline integration | Dev platform, not deployment platform; GitHub Actions handles CI |
| Devcontainer spec compliance | Custom Compose templates are simpler for this use case |
| SSO / SAML / OIDC authentication | Username/password sufficient; enterprise auth is overkill |
| Multi-VPS orchestration | Single server by design |
| Workspace snapshots/cloning | Git handles code state; Docker volumes handle data |
| Plugin/extension marketplace | One-person project cannot sustain an ecosystem |
| Real-time collaboration | Each user gets their own environments |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 5 | Pending |
| ENV-01 | Phase 3 | Complete |
| ENV-02 | Phase 3 | Complete |
| ENV-03 | Phase 3 | Complete |
| ENV-04 | Phase 3 | Complete |
| ENV-05 | Phase 3 | Complete |
| ENV-06 | Phase 3 | Complete |
| ENV-07 | Phase 3 | Complete |
| ENV-08 | Phase 7 | Pending |
| ENV-09 | Phase 7 | Pending |
| ENV-10 | Phase 7 | Pending |
| TERM-01 | Phase 4 | Pending |
| TERM-02 | Phase 4 | Pending |
| TERM-03 | Phase 4 | Pending |
| TERM-04 | Phase 4 | Pending |
| TERM-05 | Phase 4 | Pending |
| GH-01 | Phase 5 | Pending |
| GH-02 | Phase 5 | Pending |
| GH-03 | Phase 5 | Pending |
| GH-04 | Phase 5 | Pending |
| GH-05 | Phase 5 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |
| DASH-03 | Phase 6 | Pending |
| DASH-04 | Phase 6 | Pending |
| DASH-05 | Phase 6 | Pending |
| DASH-06 | Phase 1 | Complete |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after roadmap creation*
