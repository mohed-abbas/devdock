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

- [ ] **ENV-01**: User can create a new dev environment from a GitHub repo
- [ ] **ENV-02**: Each environment gets its own isolated Docker network
- [ ] **ENV-03**: Each environment gets persistent storage via named Docker volumes
- [ ] **ENV-04**: User can start a stopped environment
- [ ] **ENV-05**: User can stop a running environment (preserves volumes)
- [ ] **ENV-06**: User can delete an environment and its resources
- [ ] **ENV-07**: Environment status is visible in real-time (running/stopped/error/starting)
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
- [ ] **DASH-06**: Dashboard is accessible via HTTPS from any device

### Infrastructure

- [ ] **INFRA-01**: Each environment can include sidecar services (Postgres, Redis) via Compose
- [ ] **INFRA-02**: Base dev container image includes common tools (git, node, python, etc.)
- [ ] **INFRA-03**: DevDock runs behind existing nginx with its own server block
- [ ] **INFRA-04**: Docker socket access is restricted to the API server only (never in user containers)
- [ ] **INFRA-05**: Per-project services do not publish ports to host (internal network only)

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
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| AUTH-05 | — | Pending |
| ENV-01 | — | Pending |
| ENV-02 | — | Pending |
| ENV-03 | — | Pending |
| ENV-04 | — | Pending |
| ENV-05 | — | Pending |
| ENV-06 | — | Pending |
| ENV-07 | — | Pending |
| ENV-08 | — | Pending |
| ENV-09 | — | Pending |
| ENV-10 | — | Pending |
| TERM-01 | — | Pending |
| TERM-02 | — | Pending |
| TERM-03 | — | Pending |
| TERM-04 | — | Pending |
| TERM-05 | — | Pending |
| GH-01 | — | Pending |
| GH-02 | — | Pending |
| GH-03 | — | Pending |
| GH-04 | — | Pending |
| GH-05 | — | Pending |
| DASH-01 | — | Pending |
| DASH-02 | — | Pending |
| DASH-03 | — | Pending |
| DASH-04 | — | Pending |
| DASH-05 | — | Pending |
| DASH-06 | — | Pending |
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |
| INFRA-03 | — | Pending |
| INFRA-04 | — | Pending |
| INFRA-05 | — | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 0
- Unmapped: 31

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after initial definition*
