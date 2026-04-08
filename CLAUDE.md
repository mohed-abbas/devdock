<!-- GSD:project-start source:PROJECT.md -->
## Project

**DevDock**

A self-hosted remote development platform that runs on a Linux VPS. It provides a web dashboard for managing isolated, on-demand dev environments alongside production app monitoring. Users connect their GitHub, spin up per-project Docker environments with full infrastructure (Postgres, Redis, etc.), and work through web terminals with Claude Code and developer tools pre-configured.

**Core Value:** Enable productive remote development on any project from anywhere — laptop, phone, or web browser — so a Claude Code Max subscription isn't wasted when you can't sit at your main machine.

### Constraints

- **Infrastructure**: Single VPS — must be resource-conscious with on-demand environments
- **Security**: Dashboard exposed to internet — needs proper auth, HTTPS, and isolation between projects
- **Coexistence**: Must not interfere with existing production setup under /home/murx/
- **Docker**: Per-project isolation via Docker Compose — each project gets its own stack
- **Simplicity**: Keep the stack simple and maintainable by one person
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Meta-Framework: Next.js (App Router)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | ^15 | Full-stack framework (UI + API routes + SSR) | Single deployable for dashboard + API. App Router provides server components for fast dashboard loads, API routes for Docker/GitHub orchestration, middleware for auth. Eliminates need for separate backend. | MEDIUM |
| TypeScript | ^5.6 | Type safety | Docker APIs and GitHub APIs have complex shapes. TypeScript catches integration bugs at compile time. | HIGH |
| React | ^19 | UI library (bundled with Next.js) | Comes with Next.js. Server Components reduce client bundle size for the dashboard which matters on mobile. | MEDIUM |
- **vs. Express + separate React SPA:** Doubles the operational surface. Two processes to manage, CORS config, separate builds. For a single-person maintainer, unified is better.
- **vs. Remix:** Remix is strong but its data loading patterns (loaders/actions) are optimized for forms and navigation. DevDock is more of a real-time dashboard (container states, terminal streams) than a form-heavy app.
- **vs. SvelteKit:** Viable alternative but smaller ecosystem for auth libraries, Docker tooling. Next.js has the deepest ecosystem for server-side integrations.
- **vs. Go/Rust backend + SPA:** Over-engineering for a self-hosted tool. Node.js has first-class Docker SDK support and the team (one person) already works in the JS/TS ecosystem.
### Database: PostgreSQL + Drizzle ORM
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PostgreSQL | ^16 (system) | Relational database | The VPS already runs PostgreSQL for production. Adding a `devdock` database to the existing cluster is zero additional ops. PostgreSQL provides `LISTEN/NOTIFY` for real-time status push, JSONB for flexible project config, and robust concurrent write handling for multi-user. | HIGH |
| Drizzle ORM | ^0.39 | Type-safe database access | Lightweight, SQL-close ORM. No heavy migration framework. Schema-as-code with TypeScript types auto-generated. Significantly lighter than Prisma. | MEDIUM |
| pg (node-postgres) | ^8.13 | PostgreSQL driver for Node.js | Battle-tested driver. Connection pooling built-in. Required by Drizzle for PostgreSQL. | HIGH |
- Already running on the VPS — zero additional infrastructure to manage.
- `LISTEN/NOTIFY` enables real-time environment status updates without polling.
- JSONB columns for flexible project configuration storage.
- Better concurrent write handling for multi-user scenarios.
- Familiar tooling (`psql`, pg_dump, existing backup scripts).
- Prisma bundles a Rust query engine binary (~15MB). For a lightweight self-hosted tool, that's unnecessary.
- Drizzle generates SQL you can read. When debugging environment issues at 2am, transparent SQL matters.
- Drizzle's PostgreSQL support is first-class and mature.
### Authentication: Auth.js (NextAuth v5)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Auth.js (@auth/nextjs) | ^5 | Authentication framework | Handles session management, CSRF protection, JWT/session tokens. Built for Next.js App Router. Supports credential-based login AND OAuth providers (GitHub). | MEDIUM |
| bcrypt (or argon2) | ^5 / ^0.40 | Password hashing | For the username/password auth flow. bcrypt is battle-tested. argon2 is newer and recommended by OWASP but either works. | HIGH |
- Credentials provider for username/password login (admin creates users).
- GitHub OAuth provider for connecting GitHub accounts (NOT for login -- for repo access).
- Session strategy: JWT (no session table needed, keeps SQLite simpler).
- Middleware-based route protection on all `/dashboard/*` and `/api/*` routes.
- Lucia was deprecated in early 2025. The author recommended Auth.js or rolling your own.
### Docker Management: dockerode
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| dockerode | ^4 | Docker Engine API client for Node.js | Programmatic control of Docker containers, images, networks, volumes. The most mature Node.js Docker client. | HIGH |
| docker-compose (CLI) | v2 (system) | Multi-container orchestration per project | Each dev environment is a Docker Compose project. dockerode manages individual containers; `docker compose` CLI handles the YAML-defined stacks. | HIGH |
- Each project gets a `docker-compose.yml` generated from a template.
- `docker compose -p devdock-{project-slug} up -d` to start, `down` to stop.
- dockerode used for: listing running containers, streaming logs, getting stats (CPU/memory), exec into containers (for terminal), health checks.
- Docker socket mounted at `/var/run/docker.sock` -- Next.js process needs access.
### Web Terminal: xterm.js + Socket.IO (via Docker exec)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @xterm/xterm | ^5.5 | Terminal emulator in the browser | Industry standard web terminal. Used by VS Code, Theia, Coder, Gitpod. Full VT100/xterm compatibility. | MEDIUM |
| @xterm/addon-fit | ^0.10 | Auto-resize terminal to container | Essential addon -- handles window resize events. | MEDIUM |
| @xterm/addon-web-links | ^0.11 | Clickable URLs in terminal | Nice UX improvement, minimal cost. | LOW |
| @xterm/addon-attach | ^0.11 | Attach to WebSocket stream | Connects xterm.js to a WebSocket that streams Docker exec I/O. | MEDIUM |
| Socket.IO | ^4.8 | WebSocket transport for terminal I/O | Handles WebSocket connection with auto-reconnect, fallback to long-polling, and namespaces. More robust than raw `ws`. | MEDIUM |
- ttyd is a standalone binary for "expose one shell over the web" but bad for "programmatically manage multiple terminal sessions per user per project."
- xterm.js is a library you embed. Full control over lifecycle, auth, routing, and multi-session management.
- Auto-reconnection (critical for mobile/flaky connections).
- Namespace support (clean separation of terminal sessions).
- Fallback to long-polling when WebSocket is blocked.
### GitHub Integration: Octokit + GitHub OAuth
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @octokit/rest | ^21 | GitHub REST API client | Browse repos, list branches, get repo metadata. Official GitHub SDK. | MEDIUM |
| @octokit/auth-oauth-app | ^8 | OAuth flow for GitHub | Handles OAuth token exchange for repo access. Works with Auth.js GitHub provider. | MEDIUM |
- Use **OAuth App** (not GitHub App). GitHub Apps are for organizations distributing integrations. OAuth App is simpler: user authorizes, you get a token, you use the token to clone. No webhook infrastructure, no installation flow, no app manifests.
### UI Components: Tailwind CSS + shadcn/ui
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | ^4 | Utility-first CSS framework | Fast styling, consistent design, no CSS-in-JS runtime. v4 has CSS-first configuration. | MEDIUM |
| shadcn/ui | latest (not versioned) | Component library (copy-paste, not dependency) | Pre-built accessible components. Not an npm dependency -- components live in your codebase, fully customizable. Perfect for dashboards. | MEDIUM |
| Lucide React | ^0.460 | Icon library | Clean, consistent icons. Used by shadcn/ui by default. | LOW |
- Not a dependency -- copied into your project. No version conflicts, no breaking updates.
- Built on Radix UI primitives (accessibility handled).
- Data table, command palette, and sheet components directly useful for environment management.
### Reverse Proxy: Caddy
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Caddy | ^2.9 | HTTPS reverse proxy | Automatic HTTPS via Let's Encrypt/ZeroSSL. Zero-config TLS. Simpler than nginx for single-purpose reverse proxy. Handles WebSocket proxying natively. | MEDIUM |
### Process Management: systemd
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| systemd | (system) | Process manager for DevDock | The VPS runs Linux. systemd is already there. One service file to auto-start DevDock on boot, handle restarts, log to journald. | HIGH |
### Supporting Libraries
| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| zod | ^3.24 | Runtime validation | Validate API inputs, environment configs, form data. | HIGH |
| zustand | ^5 | Client-side state management | Terminal sessions state, environment status polling. | MEDIUM |
| date-fns | ^4 | Date formatting | "Environment running for 2h 30m", "Last used 3 days ago". | LOW |
| nanoid | ^5 | ID generation | Short unique IDs for environments, terminal sessions. | HIGH |
| yaml | ^2.6 | YAML parsing/generation | Reading and generating docker-compose.yml files per project. | MEDIUM |
| node-cron | ^3.0 | Scheduled tasks | Auto-shutdown idle environments, cleanup orphaned containers. | MEDIUM |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js | Express + React SPA | Two processes, CORS management, doubled ops burden |
| Framework | Next.js | SvelteKit | Smaller ecosystem for auth/Docker integration libraries |
| Framework | Next.js | Hono + HTMX | Insufficient for rich terminal UI and real-time dashboard |
| Database | PostgreSQL | SQLite | Misses LISTEN/NOTIFY, JSONB, concurrent writes; PostgreSQL already running on VPS |
| ORM | Drizzle | Prisma | Heavy query engine binary, unnecessary complexity |
| Auth | Auth.js v5 | Lucia | Deprecated early 2025 |
| Auth | Auth.js v5 | Custom JWT | Security risk; session management is hard to get right |
| Terminal | xterm.js | ttyd | Can't programmatically manage multi-session terminals |
| Terminal transport | Socket.IO | raw ws | No auto-reconnect, no fallback, no namespaces |
| Docker client | dockerode | Docker REST API | Streaming/multiplexing is hard to handle raw |
| CSS | Tailwind + shadcn | Material UI | Huge bundle, opinionated aesthetic |
| Proxy | Caddy | nginx | Manual cert management; but may need nginx if port conflicts |
| Process mgr | systemd | PM2 | Unnecessary layer when systemd exists |
## Do NOT Use
| Technology | Why Not |
|------------|---------|
| Kubernetes / k3s | Massive operational overhead for single-VPS. Docker Compose is the right abstraction. |
| Prisma | Query engine binary adds weight and complexity. Drizzle is lighter and more transparent. |
| Lucia Auth | Deprecated. Author recommends Auth.js. |
| MongoDB | The data is relational (users have projects, projects have environments). SQL is correct. |
| GraphQL | The API surface is small (< 20 endpoints). REST is simpler and sufficient. |
| Redis (for platform) | Not needed for platform state. Sessions are JWT. Dev environments get their own Redis via Docker Compose. |
| Electron / Tauri | This is a web-first platform accessible from any device. Desktop wrappers are out of scope. |
| Terraform / Pulumi | Single VPS, no infra provisioning needed. Shell scripts and Docker Compose suffice. |
| tRPC | Adds complexity. Next.js API routes + zod validation is sufficient for this API surface. |
## Installation
# Core framework
# Database
# Authentication
# Docker management
# Web terminal
# GitHub integration
# UI
# Utilities
## Key Risks to Verify at Implementation
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
