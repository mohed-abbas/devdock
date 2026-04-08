# Architecture Patterns

**Domain:** Self-hosted remote development platform
**Researched:** 2026-04-08
**Overall confidence:** MEDIUM (training data, informed by Coder/Gitpod/DevPod patterns, no live verification)

## Recommended Architecture

DevDock follows a **monolithic API server + per-project Docker Compose stacks** pattern. This is simpler than the agent-based architecture used by Coder (which deploys a provisioner agent into each workspace) because DevDock targets a single VPS with direct Docker socket access.

```
                         Internet
                            |
                      [Nginx Reverse Proxy]  <-- existing /home/murx/shared/nginx
                       /         |         \
                [DevDock        [Prod       [Prod
                 Web App]        App 1]      App 2]
                   |
            [DevDock API Server]
              /     |      \
        [Auth]  [Docker   [GitHub
                 Manager]  Integration]
                   |
         +---------+---------+
         |         |         |
    [Project A  [Project B  [Project C
     Compose     Compose     Compose
     Stack]      Stack]      Stack]
         |         |         |
    [Terminal  [Terminal  [Terminal
     Proxy]    Proxy]     Proxy]
```

### Core Components

There are six distinct components. Each has a clear boundary and a single responsibility.

#### 1. Reverse Proxy (Nginx)

**Responsibility:** TLS termination, routing, and coexistence enforcement.

The existing Nginx under `/home/murx/shared/nginx` already handles production traffic. DevDock adds its own server blocks to this Nginx instance, routing `devdock.yourdomain.com` to the DevDock API server. This is the coexistence boundary — DevDock never touches production Nginx configs for existing apps; it only adds its own.

**Communicates with:** DevDock API Server (upstream), Web Terminal WebSocket connections (upgrade), production apps (unchanged existing config).

**Why Nginx and not Traefik/Caddy:** The VPS already runs Nginx for production. Adding a second reverse proxy creates port conflicts and operational complexity. Extending the existing Nginx is the path of least resistance.

#### 2. DevDock API Server (Core)

**Responsibility:** The central brain. Handles all business logic: authentication, authorization, project/environment CRUD, GitHub integration coordination, Docker Compose lifecycle management, and serving the web dashboard.

This is a single Node.js process that exposes:
- REST API for dashboard operations (list projects, start/stop environments, user management)
- WebSocket endpoint for real-time environment status updates
- WebSocket proxy for terminal connections (forwarding to per-container terminal processes)

**Communicates with:** Database (PostgreSQL), Docker daemon (via socket), GitHub API, Nginx (upstream target), web terminal processes in containers.

**Why monolith, not microservices:** Single developer, single server, under 10 concurrent users expected. A monolith is debuggable, deployable, and maintainable. Split only if a clear bottleneck emerges (it will not at this scale).

#### 3. Authentication and Authorization Module

**Responsibility:** User login, session management, role enforcement (admin vs regular user).

This is a module within the API server, not a separate service. It uses:
- Session-based auth with secure HTTP-only cookies
- Password hashing with bcrypt or argon2
- Role check middleware on every API route
- CSRF protection on mutation endpoints

**Communicates with:** Database (user records, sessions), API routes (middleware).

#### 4. Docker Environment Manager

**Responsibility:** The most complex component. Manages the full lifecycle of per-project Docker Compose stacks.

Operations:
- **Provision:** Generate a `docker-compose.yml` from a project template, clone the GitHub repo into a project directory, run `docker compose up -d`
- **Start/Stop:** `docker compose start` / `docker compose stop` (not `down` — preserves volumes and state)
- **Destroy:** `docker compose down -v` (full cleanup)
- **Status:** Query container states, resource usage
- **Health:** Periodic checks for zombie containers, stuck states

Each project gets its own isolated Compose stack with:
- A dev container (the main workspace: code, Claude Code CLI, shell)
- Optional service containers (Postgres, Redis, etc.) based on project needs
- A dedicated Docker network per project (isolation between projects)
- Named volumes for persistent data (survives stop/start)
- Bind mount of `~/.claude` config (read-only, shared across all projects)

**Communicates with:** Docker daemon (via `/var/run/docker.sock`), filesystem (project directories), API server (status reports).

#### 5. Web Terminal Bridge

**Responsibility:** Provide interactive shell access to dev containers via the browser.

Architecture pattern: The API server acts as a WebSocket proxy. When a user opens a terminal:

1. Browser opens a WebSocket to `wss://devdock.example.com/api/terminals/{project-id}`
2. API server authenticates the WebSocket connection (session cookie)
3. API server uses `docker exec` to spawn a shell process (bash/zsh) inside the target container, attaching to its stdin/stdout/stderr
4. API server bridges the WebSocket and the exec stream bidirectionally
5. xterm.js in the browser renders the terminal

**Why this pattern over ttyd-per-container:** Running ttyd inside each container means each container exposes a port, needs its own auth, and requires dynamic Nginx config. Instead, the API server acts as a multiplexing proxy — one WebSocket endpoint, one auth layer, dynamic routing to any container. This is how Coder and code-server handle it.

**Communicates with:** Browser (WebSocket), Docker daemon (exec API), Auth module (session validation).

#### 6. GitHub Integration Service

**Responsibility:** Connect to GitHub, list repositories, clone repos into dev environments.

This is a module within the API server that:
- Stores a GitHub Personal Access Token (PAT) or GitHub App credentials per user
- Lists accessible repositories via GitHub API
- Clones repositories into project workspace directories

**Communicates with:** GitHub API (HTTPS), Database (token storage, encrypted), Docker Environment Manager (triggers clone into workspace volume).

### Component Boundary Summary

| Component | Responsibility | Communicates With | Deployment |
|-----------|---------------|-------------------|------------|
| Nginx Reverse Proxy | TLS, routing, coexistence | API Server, terminal WebSockets | Existing container/process |
| DevDock API Server | Business logic, REST/WS API, dashboard | All other components | Single process/container |
| Auth Module | Login, sessions, roles | Database, API routes | Module within API server |
| Docker Env Manager | Compose lifecycle, provisioning | Docker daemon, filesystem | Module within API server |
| Web Terminal Bridge | Browser-to-container shell | Docker exec API, browser WS | Module within API server |
| GitHub Integration | Repo listing, cloning | GitHub API, database | Module within API server |

## Data Flow

### Flow 1: User Creates a New Dev Environment

```
Browser                API Server              Docker Daemon         GitHub
  |                       |                        |                    |
  |-- POST /api/projects -|                        |                    |
  |   {repo, services}    |                        |                    |
  |                       |-- Validate auth ------>|                    |
  |                       |-- Clone repo ----------|-----> git clone -->|
  |                       |                        |                    |
  |                       |-- Generate compose.yml |                    |
  |                       |-- docker compose up -->|                    |
  |                       |                        |-- Pull images      |
  |                       |                        |-- Create network   |
  |                       |                        |-- Start containers |
  |                       |<-- Container IDs ------|                    |
  |                       |-- Save to DB           |                    |
  |<-- 201 Created -------|                        |                    |
  |                       |                        |                    |
  |<== WS: status updates |                        |                    |
```

### Flow 2: User Opens a Web Terminal

```
Browser (xterm.js)     API Server              Docker Daemon       Container
  |                       |                        |                   |
  |== WS Connect ========>|                        |                   |
  |   (session cookie)    |                        |                   |
  |                       |-- Validate session     |                   |
  |                       |-- Lookup container ID  |                   |
  |                       |-- POST /exec (create)--|                   |
  |                       |                        |-- Spawn /bin/bash |-->
  |                       |<-- Exec ID ------------|                   |
  |                       |-- POST /exec/start ----|                   |
  |                       |<===== Stream =========>|<====== I/O =====>|
  |<======= Bridge ======>|                        |                   |
  |   (bidirectional)     |                        |                   |
```

### Flow 3: Production App Monitoring (Read-Only)

```
Browser                API Server              Docker Daemon       /home/murx/
  |                       |                        |                   |
  |-- GET /api/prod-apps -|                        |                   |
  |                       |-- Read compose files --|----------------> |
  |                       |   from /home/murx/apps |                   |
  |                       |-- docker ps/stats ---->|                   |
  |                       |<-- Container states ---|                   |
  |<-- App list + status -|                        |                   |
```

**Critical boundary:** Production monitoring is strictly read-only. The API server reads Docker container states and compose files but NEVER executes start/stop/restart on production containers. This is enforced at the code level with a distinct "production monitor" module that has no write capabilities.

## Data Storage

### Database: PostgreSQL

DevDock uses its own PostgreSQL database, separate from production databases. Since the VPS already runs PostgreSQL for production, the operational overhead is minimal — just an additional database in the existing cluster.

**Advantages over SQLite for this use case:**
- `LISTEN/NOTIFY` for real-time environment status push without polling
- Better concurrent write handling for multi-user scenarios
- JSONB for flexible project configuration storage
- Familiar tooling (`psql`, backups already handled)

**Tables:**
- `users` — id, username, password_hash, role, created_at
- `sessions` — id, user_id, token, expires_at
- `projects` — id, user_id, name, repo_url, status, compose_path, config (JSONB), created_at
- `github_tokens` — id, user_id, encrypted_token, created_at
- `project_services` — id, project_id, service_name, container_id, port_mappings

**Isolation from production:** DevDock creates its own database (`devdock`) with its own user/role. It does NOT share tables or schemas with production app databases.

### Filesystem Layout

```
/home/mohed_abbas/
  devdock/                          # DevDock installation root
    server/                         # API server code
    dashboard/                      # Frontend build output
    data/
      projects/                     # Per-project workspaces
        {project-uuid}/
          docker-compose.yml        # Generated compose file
          workspace/                # Cloned repo + working files
          .env                      # Project-specific env vars
    templates/
      base-compose.yml              # Template for new projects
      dev-container/
        Dockerfile                  # Base dev container image
    config/
      devdock.yml                   # Server configuration
```

## Docker Network Architecture

```
Docker Networks:
  devdock-internal          # API server <-> database (if containerized)
  project-{uuid}-net        # Per-project isolated network
    - {uuid}-dev            # Dev container
    - {uuid}-postgres       # Project's own PostgreSQL (if needed)
    - {uuid}-redis          # Project's own Redis (if needed)

  murx-production-net       # Existing production network (DO NOT TOUCH)
```

Each project gets its own Docker network. Containers within a project can communicate (dev container reaches its own Postgres), but Project A cannot reach Project B's containers.

**The DevDock API server itself should NOT be containerized initially.** Running it as a native Node.js process with direct Docker socket access is simpler. Containerize later if needed.

## Patterns to Follow

### Pattern 1: Template-Based Compose Generation

Generate `docker-compose.yml` files from templates rather than hand-crafting them per project.

```yaml
# templates/base-compose.yml (simplified)
services:
  dev:
    build:
      context: ./dev-container
    volumes:
      - ./workspace:/workspace
      - /home/mohed_abbas/.claude:/home/dev/.claude:ro
    working_dir: /workspace
    networks:
      - project-net

networks:
  project-net:
    driver: bridge
```

### Pattern 2: Graceful Degradation for Resource Pressure

When the VPS runs low on resources, stop idle environments automatically rather than letting the system thrash.

```
Monitor loop (every 60s):
  1. Check system resources (memory, disk, CPU)
  2. If pressure detected:
     a. List all running dev environments
     b. Sort by last-activity timestamp
     c. Stop least-recently-used environments until pressure relieved
  3. Notify user via dashboard that environment was auto-stopped
```

### Pattern 3: Event-Driven Status Updates

Use PostgreSQL `LISTEN/NOTIFY` combined with Docker events stream (`docker events`) to push real-time container lifecycle events to connected dashboard clients via WebSocket. This eliminates polling and gives instant status updates.

### Pattern 4: Read-Only Production Boundary

Production monitoring code is architecturally separate from dev environment management code, with no write capabilities. A bug in the dev environment manager must never be able to stop a production container.

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Instead |
|-------------|---------|---------|
| Agent-in-Container | Unnecessary complexity for single-VPS | Direct Docker API management from API server |
| Dynamic Nginx Configuration | Race conditions, config corruption, takes down all sites | Single Nginx upstream to API server, internal routing |
| Shared Tables with Production DB | Migration risk, coupling | Separate `devdock` database with own user/role |
| ttyd Per Container | Port management nightmare, per-container auth needed | Single WebSocket terminal proxy in API server |

## Coexistence Strategy with /home/murx/

**Principles:**
1. DevDock lives entirely under `/home/mohed_abbas/` — never writes to `/home/murx/`
2. DevDock reads from `/home/murx/apps/` for production monitoring but never modifies
3. DevDock adds Nginx server blocks for its own subdomain; never modifies existing production server blocks
4. DevDock containers use distinct Docker networks from production containers
5. DevDock uses distinct port ranges from production services
6. The DevDock API server runs as `mohed_abbas` user, not as root or as `murx`

## Suggested Build Order

### Layer 1: Foundation (no dependencies)
1. **Project scaffolding** — directory structure, package.json, basic config
2. **PostgreSQL database** — schema, migrations, connection module, separate `devdock` database
3. **Base dev container Dockerfile** — the image all dev environments will use

### Layer 2: Core Server (depends on Layer 1)
4. **API server skeleton** — HTTP server, routing, middleware pipeline
5. **Authentication** — user registration (admin-bootstrapped), login, sessions, role middleware

### Layer 3: Docker Management (depends on Layer 2)
6. **Docker Compose lifecycle** — generate compose files from templates, start/stop/destroy
7. **Environment status tracking** — query container states, persist to database, WebSocket status events

### Layer 4: Terminal Access (depends on Layer 3)
8. **Web terminal proxy** — WebSocket endpoint, Docker exec bridging, xterm.js frontend

### Layer 5: Dashboard and UX (depends on Layers 2-4)
9. **Web dashboard** — project list, create/start/stop controls, terminal launcher, status views
10. **Production monitoring** — read-only view of /home/murx/ apps and their container states

### Layer 6: GitHub Integration (depends on Layer 3)
11. **GitHub connection** — PAT storage, repo listing, clone into project workspace

### Layer 7: Polish and Resilience
12. **Resource monitoring and auto-stop** — idle detection, pressure-based cleanup
13. **HTTPS setup** — certbot integration for DevDock subdomain
14. **Mobile responsiveness** — dashboard works on phone browsers

### Dependency Graph

```
Layer 1: [Scaffold] [Database] [Dockerfile]
              \          |          /
Layer 2:     [API Server + Auth]
                    |
Layer 3:     [Docker Lifecycle + Status]
                /        \
Layer 4:  [Terminal]    [GitHub Integration]  (parallel)
                \        /
Layer 5:     [Dashboard + Prod Monitor]
                    |
Layer 7:     [Resource Mgmt, HTTPS, Mobile]
```

## Scalability Considerations

| Concern | At 1-2 users | At 5-10 users | Limit on single VPS |
|---------|-------------|---------------|---------------------|
| Concurrent environments | 3-5 running | 2-3 per user, auto-stop idle | ~10-15 depending on VPS RAM |
| Terminal connections | Direct WebSocket proxy | Same, add connection pooling | ~50 concurrent (RAM limited) |
| Database | PostgreSQL, no issues | PostgreSQL, still fine | PostgreSQL handles this easily |
| Docker images | Pull on demand | Pre-pull common images | Disk space is the constraint |
| API server | Single process | Single process, still fine | Add worker threads if CPU-bound |

**The bottleneck will always be RAM on a single VPS.** Each dev environment with Postgres + Redis + dev container consumes 500MB-1GB. The auto-stop-idle pattern is essential, not optional.
