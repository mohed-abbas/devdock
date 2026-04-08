# Common Pitfalls

**Domain:** Self-hosted remote development platform
**Researched:** 2026-04-08
**Confidence:** MEDIUM (training data only; however these are well-established infrastructure patterns with stable best practices)

## Critical Pitfalls (causes breaches, data loss, or rewrites)

### Pitfall 1: Docker Socket Exposure Gives Root on Host

**What goes wrong:** Mounting `/var/run/docker.sock` into a dev container gives that container full root access to the host. A user in any dev environment can create privileged containers, read any file on the host, or take over production infrastructure under `/home/murx/`.

**Warning signs:** Docker socket in any user-facing container's volume mounts. Management API accessible from user container networks.

**Prevention:** Keep Docker socket access ONLY in the orchestrator service. User containers never touch it. The orchestrator (backend API) talks to Docker Engine; user containers communicate only through the terminal proxy. Place user containers on isolated Docker networks that cannot reach the orchestrator. Consider `--userns-remap` to map container root to unprivileged host user.

**Phase:** Phase 1 (core architecture). Foundational decision — cannot be retrofitted.

---

### Pitfall 2: Web Terminal as Unauthenticated Backdoor

**What goes wrong:** ttyd or xterm.js backend listens on a port. If that port is reachable from the internet (even non-standard), it bypasses all dashboard authentication. WebSocket endpoints without session validation are equally dangerous.

**Warning signs:** ttyd processes listening on `0.0.0.0` instead of `127.0.0.1`. WebSocket endpoints accessible without session tokens. Terminal URLs guessable or sequential.

**Prevention:** NEVER expose ttyd/terminal ports directly. Bind to `127.0.0.1` only and proxy through authenticated backend. Use the dashboard backend as a WebSocket proxy: client connects to backend (with valid session), backend connects to container terminal. Use cryptographically random, short-lived terminal session IDs. Implement idle disconnect timeouts.

**Phase:** Phase 2 (terminal integration). Must be designed as proxied-through-auth from the start.

---

### Pitfall 3: Shared Docker Network Lets Containers Attack Each Other

**What goes wrong:** All dev environments on the same Docker network. Container A reaches Container B's Postgres, Redis, and internal services.

**Prevention:** Each project gets its own isolated Docker network via its own Compose file. Use unique network names: `devdock-{project_id}-network`. Orchestrator connects via `docker exec` or per-project network attachment, NOT a shared management network. Never use `network_mode: host`.

**Phase:** Phase 1 (container management architecture).

---

### Pitfall 4: OOM Killer Takes Down Production and Platform

**What goes wrong:** A dev environment consumes all RAM. Linux OOM killer activates and non-deterministically kills processes — potentially production apps, shared Postgres, or DevDock itself.

**Prevention:** Set explicit `mem_limit` on EVERY dev container. Reserve memory budget (e.g., 8GB VPS: 2GB host/production, 1GB DevDock, 5GB dev budget). Limit concurrent running environments at application level. Add swap (2x RAM) as safety buffer. Set `oom_score_adj` on critical host processes. Monitor per-container memory in dashboard.

**Phase:** Phase 1 for limits; Phase 3 for visibility.

---

### Pitfall 5: Mounted ~/.claude Config Leaks Credentials Across Users

**What goes wrong:** Shared `~/.claude` config (potentially containing session tokens) mounted read-write into all containers. Multi-user: User B accesses User A's Claude credentials. Any project can corrupt shared config.

**Prevention:** Separate concerns: mount GSD/SuperClaude configs as READ-ONLY shared volumes. Mount Claude credentials as PER-USER volumes. Never mount actual host `~/.claude` directly — copy/template non-sensitive parts. Design mount structure to support per-user isolation from the start.

**Phase:** Phase 1 for mount design; critical when multi-user arrives.

---

### Pitfall 6: GitHub OAuth Token Stored Plaintext

**What goes wrong:** OAuth tokens stored unencrypted in database. Breach anywhere exposes tokens with access to ALL private repos.

**Prevention:** Encrypt tokens at rest. Request MINIMUM scopes. Prefer GitHub App (installation tokens scoped to selected repos) over OAuth App. Never log tokens. Store tokens in platform database only, NEVER pass into containers as env vars — clone repos at orchestrator level. Implement token rotation.

**Phase:** Phase 2 (GitHub integration).

---

## Moderate Pitfalls (causes rework, poor UX, operational pain)

### Pitfall 7: Docker Compose Orchestration Becomes Unmanageable

**What goes wrong:** Dynamic Compose file generation leads to sprawl, orphaned containers, zombie networks, inconsistent state.

**Prevention:** Use Docker Compose as template definition but manage lifecycle through Docker Engine API (dockerode) or Compose CLI with `--project-name` isolation. Track state in database, not in compose files. Implement periodic cleanup routine. Name everything consistently: `devdock-{project_id}-{service}`.

**Phase:** Phase 1.

---

### Pitfall 8: Port Collision Hell

**What goes wrong:** Multiple environments each need Postgres 5432, Redis 6379, etc. Published ports collide. Production services under `/home/murx/shared/` also use these ports.

**Prevention:** Do NOT publish ports for per-project services. They only need to be reachable within their project Docker network. Web terminal connects INTO the container network. Only platform services need host port bindings. If preview URLs needed, use reverse proxy with subdomain routing, not published ports.

**Phase:** Phase 1.

---

### Pitfall 9: Volume Mount Permission Mismatches

**What goes wrong:** Container root (UID 0) owns files on mounted volumes. Host user `mohed_abbas` (likely UID 1000) can't read/write them. Git shows all files modified.

**Prevention:** Create non-root user inside containers with SAME UID/GID as host user. Use Docker `user:` directive in compose. Detect host UID at environment creation, bake into container. Prefer named Docker volumes over bind mounts where possible. If bind mounts needed, fix ownership in entrypoint.

**Phase:** Phase 1 (Dockerfile design).

---

### Pitfall 10: Session Management Doesn't Scale to WebSockets

**What goes wrong:** Cookie-based HTTP sessions work for dashboard but WebSocket connections for terminal don't carry cookies correctly or session store doesn't handle concurrent WS connections.

**Prevention:** Use token-based auth (JWT) for WebSocket connections. Validate token during WebSocket upgrade handshake. Implement terminal session keep-alive independent of HTTP session expiry. Handle token refresh gracefully — prompt re-auth rather than killing active terminal session.

**Phase:** Phase 2 (auth + terminal).

---

### Pitfall 11: Coexistence Collision with Production Nginx

**What goes wrong:** Production nginx and DevDock both need port 80/443. Modifying production nginx config for DevDock breaks production apps. Two nginx instances conflict.

**Prevention:** Use EXISTING production nginx as entry point. Add DevDock server block that proxies to DevDock backend on a local port. Never modify production nginx config programmatically from DevDock. Use dedicated subdomain (e.g., `dev.yourdomain.com`). Keep DevDock nginx config in separate include file. Test with `nginx -t` before reload.

**Phase:** Phase 1 (infrastructure setup).

---

### Pitfall 12: Disk Space Exhaustion from Docker

**What goes wrong:** Docker images, build caches, container logs, orphaned volumes silently fill disk. Production databases can't write. Docker daemon refuses to create containers.

**Prevention:** Set Docker log rotation in `/etc/docker/daemon.json`: `max-size: 10m, max-file: 3`. Run `docker system prune` on cron (weekly). Use multi-stage builds, share base images. Monitor disk in dashboard. Clean up stopped containers and dangling images during environment shutdown lifecycle.

**Phase:** Phase 1 for daemon config; Phase 3 for dashboard monitoring.

---

## Minor Pitfalls (friction, bugs, poor DX)

### Pitfall 13: Environment Startup Time Kills UX

**Prevention:** Pre-build base dev image with common tools. Use Docker volume caching for `node_modules`, `.venv`. Implement "warm" state: stop containers, keep volumes (restart in seconds vs minutes). Distinguish "create" (first time, slow) from "resume" (fast). Show startup progress in dashboard.

**Phase:** Phase 2.

---

### Pitfall 14: GitHub OAuth Scope Creep

**Prevention:** Use GitHub App instead of OAuth App — fine-grained permissions, repo-level installation. If OAuth, start with minimal scopes and request incrementally. Clearly explain permissions to users.

**Phase:** Phase 2.

---

### Pitfall 15: No Graceful Shutdown for Terminal Sessions

**Prevention:** Warn before shutdown. Send SIGTERM before SIGKILL with grace period. Prevent shutdown while sessions active (or require confirmation). Use tmux inside containers for session persistence.

**Phase:** Phase 2.

---

### Pitfall 16: HTTPS/TLS Certificate Conflicts

**Prevention:** Use existing certbot setup. Add DevDock subdomain to existing cert or request separate cert. Do NOT run second certbot. Test renewal after changes: `certbot renew --dry-run`.

**Phase:** Phase 1.

---

### Pitfall 17: Role System Over-Engineered Too Early

**Prevention:** Phase 1: single admin, env-var configured. Phase 2: username/password login with `is_admin` boolean. Only build granular permissions if you actually get 3+ users with different needs. Use proven auth library, don't roll custom.

**Phase:** All phases — keep it simple at each stage.

---

## Phase-Specific Warning Summary

| Phase Topic | Likely Pitfalls | Key Mitigations |
|-------------|----------------|-----------------|
| Infrastructure setup | #11 Nginx collision, #16 TLS conflicts | Use existing nginx, add server block |
| Container management | #1 Socket exposure, #3 Network isolation, #4 OOM, #8 Port collisions | Orchestrator-only socket, per-project networks, mem_limit, no published ports |
| Auth system | #17 Over-engineering, #10 WS session mismatch | Simple boolean roles, token-based auth for WS |
| GitHub integration | #14 Scope creep, #6 Token storage | GitHub App over OAuth App, encrypt tokens |
| Terminal integration | #2 Unauthenticated backdoor, #15 No graceful shutdown | Proxy through auth backend, shutdown warnings |
| Environment lifecycle | #13 Slow startup, #12 Disk exhaustion | Pre-built images, volume caching, log rotation |
| Config management | #5 Credential leakage, #9 UID mismatches | Per-user credential mounts, UID-matched users |

---

## Prevention Priorities (Ordered)

**Before writing ANY code:**
1. Decide nginx integration strategy — use existing production nginx, add server block for DevDock subdomain
2. Design container network isolation model — per-project networks, orchestrator-only socket access
3. Set Docker daemon defaults — log rotation (`max-size: 10m, max-file: 3`), default resource constraints
4. Plan auth with WebSocket support — token-based from the start, not cookie-only

**During MVP development:**
5. Set `mem_limit` on every container; cap concurrent running environments (2-3 max)
6. Keep terminal endpoints behind authenticated WebSocket proxy — never expose ttyd ports
7. Use GitHub App for repo access, not OAuth App — fine-grained permissions, repo-level scoping
8. Match container UIDs to host user (pass UID/GID as build args)
9. Never publish per-project service ports to host — internal Docker network only

**Before multi-user:**
10. Separate shared config (GSD/SuperClaude tools, read-only) from credentials (Claude tokens, per-user)
11. Encrypt stored tokens at rest
12. Implement per-user resource quotas
