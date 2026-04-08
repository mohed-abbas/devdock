# Feature Landscape

**Domain:** Self-hosted remote development platform (personal/small-team)
**Researched:** 2026-04-08
**Confidence:** MEDIUM (based on training data for Gitpod, Coder, DevPod, Coolify; no live verification available)

## Competitive Landscape Context

The feature map below is derived from analyzing four key players in this space:

- **Gitpod** — Cloud-native CDE (Cloud Development Environment). Automated, ephemeral workspaces with deep Git integration. Originally open-source self-hosted, pivoted to SaaS-first. Heavy on devcontainer/Dockerfile config.
- **Coder** — Self-hosted remote dev platform for enterprises. Template-based workspaces on Terraform. Supports any IDE (VS Code, JetBrains, web terminal). Strong access control and audit trails.
- **DevPod** — Open-source, client-side dev environment manager. Provider-agnostic (Docker, Kubernetes, cloud VMs). Devcontainer spec compliant. Lightweight, no server component.
- **Coolify** — Self-hosted PaaS (more deployment than dev). Docker/Docker Compose based. Web dashboard for app management. Relevant for the monitoring/dashboard UX patterns, not dev environments.

DevDock sits in a unique niche: personal/small-team, single-VPS, Claude Code-centric. This means many enterprise features are anti-features, while some personal-workflow features become table stakes.

---

## Table Stakes

Features users expect from any remote dev platform. Missing any of these makes the product feel broken or incomplete.

| # | Feature | Why Expected | Complexity | Notes |
|---|---------|--------------|------------|-------|
| T1 | **Web-based authentication** | Internet-exposed dashboard needs login. Every platform has this. | Low | Username/password minimum. Session tokens with expiry. |
| T2 | **GitHub repo browsing and cloning** | Every CDE connects to a Git provider. Manual URL pasting feels broken. | Medium | OAuth or GitHub App for private repos. List repos, select, clone. |
| T3 | **One-click environment spin-up** | Core promise of any dev platform. Gitpod's entire UX is "click to open." | Medium | Docker Compose orchestration behind a single button. |
| T4 | **Web terminal access** | Primary interface for working in the environment. Gitpod, Coder all provide this. | Medium | xterm.js or ttyd. Must feel responsive. WebSocket-based. |
| T5 | **Environment start/stop controls** | Resource management is fundamental on single-VPS. Coder and Gitpod both have this. | Low | Start, stop, restart buttons. Status indicators. |
| T6 | **Per-project isolation** | Running multiple projects without interference is the entire point. All platforms do this. | Medium | Separate Docker Compose stacks with isolated networks. |
| T7 | **Environment status visibility** | Users need to know what's running, what's stopped, resource usage. Every dashboard shows this. | Low | Running/stopped/error states. Basic health indicators. |
| T8 | **HTTPS access** | Internet-exposed service without HTTPS is unacceptable in 2026. | Low | Reverse proxy (nginx/Caddy) with TLS. Already exists on VPS. |
| T9 | **Persistent workspace storage** | Losing work when environment stops is a dealbreaker. All platforms persist. | Low | Docker volumes that survive container restarts. |
| T10 | **Pre-configured dev tools in containers** | The whole point is a ready-to-code environment. Gitpod prebuilds, Coder templates. | Medium | Git, Node, Python, common CLIs baked into base images. |
| T11 | **Environment lifecycle management** | Add project, configure, start, work, stop, delete. Full lifecycle. | Medium | CRUD operations on environments with proper cleanup on delete. |
| T12 | **Per-project services (DB, cache)** | Realistic dev needs databases. Gitpod/Coder handle this via config. | Medium | Docker Compose sidecar services: Postgres, Redis per project. |

---

## Differentiators

Features that set DevDock apart. Not expected in the basic category but create clear value for the target user.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | **Claude Code pre-installed and configured** | No other platform does this. Core value prop: every environment is Claude-ready. | Low | Mount shared config, pre-install CLI in base image. |
| D2 | **Shared ~/.claude config mounting** | GSD, SuperClaude, skills available everywhere without per-project setup. | Low | Volume mount from host. Single source of truth. |
| D3 | **Production app monitoring alongside dev** | Unified view of "what I'm building" and "what I've shipped." Coolify-inspired but dev-focused. | Medium | Read-only view of /home/murx/apps/ containers, logs, status. |
| D4 | **Unified dashboard (dev + production)** | Context switching killer. See everything in one place. Neither Gitpod nor Coder do this. | Medium | Single pane: dev environments on top, production apps below. |
| D5 | **Auto-shutdown on inactivity** | VPS resource savings. Gitpod does this (30min timeout). Critical for single-server. | Medium | Activity detection (terminal input, API calls). Configurable timeout. |
| D6 | **Quick-resume from stopped state** | Fast startup of previously configured environments. Docker caches help. | Low-Med | Keep containers stopped (not removed). Resume in seconds. |
| D7 | **Environment resource limits** | Prevent one project from starving others. Coder does this for enterprise. | Low | Docker Compose resource constraints (memory, CPU limits). |
| D8 | **Port forwarding / preview URLs** | Access web apps running in containers from browser. Gitpod and Coder both do this well. | Medium | Reverse proxy routes subdomain/path to container port. Auto-detect common ports. |
| D9 | **Environment templates** | "Node+Postgres", "Python+Redis" presets. Coder's template system is their core abstraction. | Medium | Pre-built Docker Compose templates for common stacks. User can customize. |
| D10 | **Simple file browser/editor** | Quick config edits without terminal. Not a full IDE, just convenience. | Medium | Web-based file tree + code editor (Monaco/CodeMirror) for quick edits. |
| D11 | **Container logs viewer** | Debug build failures and runtime issues without terminal. | Low | Stream Docker logs to web UI. Filter by service. |
| D12 | **GitHub webhook for auto-provision** | Push to branch, environment auto-creates. Gitpod's "prefix URL" pattern. | High | Webhook receiver, branch-based environment creation. |
| D13 | **Dotfiles/config sync** | Personal dev config (shell aliases, git config) available in every environment. | Low | Mount or copy dotfiles repo into containers. |
| D14 | **Mobile-friendly terminal** | Work from phone — core value prop says "from anywhere." Not well-solved by competitors. | Medium | Responsive terminal layout, touch-friendly controls, virtual keyboard helpers. |

---

## Anti-Features

Features to deliberately NOT build. Building these adds complexity without value for the target user.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|--------------|-----------|-------------------|
| A1 | **Full IDE in browser (VS Code Server, code-server)** | Massive complexity. Maintenance burden. The interface is Claude Code in a terminal, not a traditional IDE. | Web terminal + optional simple file editor for quick edits. |
| A2 | **Kubernetes orchestration** | Single VPS. K8s overhead is absurd for personal use. Coder supports this for enterprise; DevDock does not need it. | Docker Compose is the right abstraction for single-server. |
| A3 | **Multi-cloud provider support** | DevPod's whole selling point. DevDock is single-VPS by design. | Hardcode the local Docker runtime. No provider abstraction layer. |
| A4 | **Team collaboration features (shared workspaces, pair programming)** | Enterprise features. Personal/small-team does not need real-time sharing. | Each user gets their own environments. Keep it simple. |
| A5 | **CI/CD pipeline integration** | Out of scope per PROJECT.md. Dev platform, not deployment platform. | Claude Code runs tests inside environments. GitHub Actions handles CI. |
| A6 | **Devcontainer spec compliance** | Complex spec (features, lifecycle hooks, mounts). Overkill for personal tool. Adds implementation burden for compatibility nobody asked for. | Custom Docker Compose templates — simpler, more flexible for this use case. |
| A7 | **Workspace snapshots/cloning** | Enterprise feature for reproducibility. Personal dev does not need to snapshot and share workspace state. | Git handles code state. Docker volumes handle data. |
| A8 | **Usage metering and billing** | Out of scope per PROJECT.md. No need to track resource usage per user for a personal tool. | Simple resource limits per container are sufficient. |
| A9 | **Plugin/extension marketplace** | Huge maintenance burden. One-person project cannot sustain an ecosystem. | Ship good defaults. Let users customize via dotfiles and Docker images. |
| A10 | **Automated prebuilds** | Gitpod's prebuild system is complex infrastructure. Not justified for personal-scale usage. | Manual "rebuild environment" button is sufficient. Docker layer caching provides speed. |
| A11 | **RBAC / fine-grained permissions** | Enterprise need. Admin vs regular user covers the small-team case completely. | Two roles: admin (configure system, manage users) and user (manage own environments). |
| A12 | **Audit logging** | Enterprise compliance requirement. Not needed for personal/small-team. | Standard application logs are sufficient. |
| A13 | **SSO / SAML / OIDC authentication** | Enterprise auth. Username/password (possibly with TOTP 2FA later) is right for personal. | Simple credential-based auth. Add GitHub OAuth as a convenience, not SSO. |

---

## Feature Dependencies

```
T1 (Auth) ──────────────────────┐
                                v
T2 (GitHub) ──> T3 (Spin-up) ──> T4 (Terminal) ──> D1 (Claude Code)
                    |                                     |
                    v                                     v
                T6 (Isolation) ──> T12 (Services)    D2 (Shared config)
                    |
                    v
                T5 (Start/Stop) ──> D5 (Auto-shutdown)
                    |
                    v
                T7 (Status) ──> D3 (Production monitoring)
                                     |
                                     v
                                D4 (Unified dashboard)

T8 (HTTPS) ──> D8 (Port forwarding / preview URLs)

T9 (Persistence) ── independent, needed by T3

T10 (Dev tools) ──> D1 (Claude Code) ── Claude needs git, node, etc.

D9 (Templates) ── depends on T3 + T6 + T12 being stable

D10 (File browser) ── independent, enhances T4

D11 (Logs viewer) ── depends on T6 (needs running containers)

D14 (Mobile terminal) ── depends on T4 (extends terminal)
```

**Critical path:** Auth -> GitHub -> Spin-up -> Terminal -> Claude Code integration

---

## MVP Recommendation

### Must ship (Phase 1 - Core Loop)

1. **T1** - Web authentication
2. **T3** - Environment spin-up
3. **T4** - Web terminal
4. **T5** - Start/stop controls
5. **T6** - Per-project isolation
6. **T7** - Environment status visibility
7. **T8** - HTTPS access
8. **T9** - Persistent storage
9. **D1** - Claude Code pre-installed
10. **D2** - Shared ~/.claude config

### Phase 2 - GitHub Integration and Services

11. **T2** - GitHub repo browsing and cloning
12. **T10** - Pre-configured dev tools
13. **T12** - Per-project services (Postgres, Redis)
14. **T11** - Full lifecycle management

### Phase 3 - Polish and Monitoring

15. **D3** - Production app monitoring
16. **D4** - Unified dashboard
17. **D5** - Auto-shutdown on inactivity
18. **D7** - Resource limits per environment
19. **D8** - Port forwarding / preview URLs
20. **D11** - Container logs viewer

### Defer indefinitely

- **D9** (Templates)
- **D10** (File browser)
- **D12** (GitHub webhooks)
- **D13** (Dotfiles sync)
- **D14** (Mobile terminal)

---

## Complexity Budget

| Complexity | Count | Features |
|------------|-------|----------|
| **Low** | 8 | T1, T5, T7, T9, D1, D2, D7, D11 |
| **Medium** | 12 | T2, T3, T4, T6, T10, T11, T12, D3, D4, D5, D8, D9, D10, D14 |
| **High** | 1 | D12 |

---

## Sources and Confidence

| Platform | Knowledge Source | Confidence |
|----------|-----------------|------------|
| Gitpod | Training data (docs, architecture, pricing model, feature set through early 2025) | MEDIUM |
| Coder | Training data (docs, template system, enterprise features through early 2025) | MEDIUM |
| DevPod | Training data (docs, devcontainer approach, provider model through early 2025) | MEDIUM |
| Coolify | Training data (docs, deployment model, dashboard patterns through early 2025) | MEDIUM |
| Docker Compose patterns | Training data + well-established technology | HIGH |
| Web terminal (xterm.js/ttyd) | Training data + well-established technology | HIGH |
