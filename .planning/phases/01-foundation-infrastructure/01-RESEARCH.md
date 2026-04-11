# Phase 1: Foundation & Infrastructure - Research

**Researched:** 2026-04-09
**Domain:** Next.js scaffolding, PostgreSQL + Drizzle ORM, Docker base image, nginx reverse proxy, security boundaries
**Confidence:** HIGH

## Summary

Phase 1 establishes the deployable skeleton: a Next.js 15 App Router application with PostgreSQL database (Drizzle ORM), a base Ubuntu 24.04 dev container image, nginx reverse proxy configuration, and Docker network isolation. Development happens locally first (D-10); VPS deployment comes later.

The core challenge is getting the right foundation decisions locked: project structure that scales to 7 phases, database schema that supports future environment lifecycle, Docker image that pre-installs Claude Code CLI, and security boundaries (socket isolation, internal networks) that are architectural and cannot be retrofitted.

**Primary recommendation:** Use `create-next-app@15` (pinned to v15, NOT v16) to scaffold the project with TypeScript, Tailwind CSS v4, and App Router. Add Drizzle ORM with `drizzle-kit` migrations from day one. Build the base dev container as a multi-stage Dockerfile from `ubuntu:24.04`. Configure `output: 'standalone'` in `next.config.ts` for self-hosting readiness.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** DevDock uses its own subdomain: `devdock.yourdomain.com` (actual domain TBD at deployment)
- **D-02:** Nginx config is a separate include file in sites-enabled/ (e.g., `devdock.conf`) -- completely isolated from production nginx configs. Never modify existing production server blocks.
- **D-03:** TLS via existing certbot setup -- add subdomain to existing cert or request a separate one
- **D-04:** Base image is Ubuntu 24.04 -- full-featured, familiar, all tools available
- **D-05:** Pre-installed tools: Node.js + npm, Python 3, Git + SSH, common CLIs (curl, wget, vim, jq, build-essential)
- **D-06:** Per-project Dockerfiles are supported -- each project can customize its own image on top of the base or use a completely custom one
- **D-07:** Claude Code CLI must be pre-installed in the base image
- **D-10:** Development happens locally first (current directory: `/home/mohed_abbas/murx/perso/claudecodevps/`). Deployment to VPS happens after development is complete.
- **D-11:** On VPS, DevDock will run under a new `murx-dev` user (separate from production `murx` user)
- **D-13:** Threshold-based cache cleanup -- auto-prune when disk usage exceeds 80%. Adaptive to actual usage on 100GB NVMe.
- **D-14:** Per-project images allowed -- each project can have its own Dockerfile. Shared base image is available but not mandatory.
- **D-15:** Docker daemon config must include log rotation (`max-size: 10m, max-file: 3`) from day one
- **D-16:** VPS specs: 2 vCPU, 8GB RAM, 100GB NVMe, 8TB bandwidth
- **D-17:** With 8GB RAM: budget ~2GB for host/production, ~512MB for DevDock app, ~5.5GB for dev environments. Max 2-3 concurrent running environments.
- **D-18:** Docker resource limits (mem_limit) are mandatory on every container -- deferred to Phase 7 for enforcement but architecture must support it from Phase 1

### Claude's Discretion
- **D-08:** Database setup: Claude decides between new database in existing cluster vs separate instance. Recommendation: new `devdock` database in existing PostgreSQL cluster with dedicated `devdock` role (saves ~100MB RAM vs separate instance)
- **D-09:** Migration tool: Claude decides -- Drizzle Kit is the natural choice given Drizzle ORM in the stack
- **D-12:** Process management: Claude decides -- systemd recommended based on architecture research

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Each environment can include sidecar services (Postgres, Redis) via Compose | Docker Compose template pattern with per-project networks; `docker-compose.yml` generation from templates |
| INFRA-02 | Base dev container image includes common tools (git, node, python, etc.) | Ubuntu 24.04 Dockerfile with multi-stage build; Claude Code CLI via `curl -fsSL https://claude.ai/install.sh` |
| INFRA-03 | DevDock runs behind existing nginx with its own server block | Nginx `devdock.conf` in sites-enabled/; proxy_pass to localhost:3000; WebSocket upgrade headers |
| INFRA-04 | Docker socket access is restricted to the API server only (never in user containers) | Socket access via docker group membership on API server process; never mount socket into compose stacks |
| INFRA-05 | Per-project services do not publish ports to host (internal network only) | Docker Compose `internal: true` networks; no `ports:` directives on sidecar services |
| DASH-06 | Dashboard is accessible via HTTPS from any device | nginx TLS termination + reverse proxy to Next.js; `output: 'standalone'` for production |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack locked:** Next.js ^15 (App Router), TypeScript ^5.6, React ^19, PostgreSQL ^16, Drizzle ORM, dockerode ^4, Tailwind CSS ^4, shadcn/ui
- **Forbidden:** Kubernetes/k3s, Prisma, Lucia Auth, MongoDB, GraphQL, Redis (for platform), tRPC, Electron/Tauri, Terraform/Pulumi
- **Auth:** Auth.js (next-auth v5 beta) with Credentials provider + GitHub OAuth
- **Process management:** systemd (not PM2)
- **Proxy:** Use existing nginx (not Caddy) -- overrides STACK.md Caddy recommendation
- **Security:** Docker socket never mounted into user containers
- **GSD Workflow:** All code changes must go through GSD commands

## Standard Stack

### Core (Phase 1 only)

| Library | Version | Purpose | Why Standard | Verified |
|---------|---------|---------|--------------|----------|
| Next.js | 15.5.15 | Full-stack framework (App Router + API routes) | Locked in CLAUDE.md. v15 is latest LTS-equivalent; v16 exists but is new. Pin to v15 for stability. | [VERIFIED: npm registry 2026-04-09] |
| TypeScript | ^5.6 | Type safety | Locked in CLAUDE.md. Current latest is 6.0.2 but ^5.6 is what Next.js 15 ships with. | [VERIFIED: npm registry] |
| React | ^19.2 | UI library (bundled with Next.js 15) | Comes with Next.js 15. | [VERIFIED: npm registry, 19.2.5] |
| Drizzle ORM | 0.45.2 | Type-safe PostgreSQL access | Latest stable. CLAUDE.md says ^0.39 but latest is 0.45.2 -- use latest. | [VERIFIED: npm registry 2026-04-09] |
| drizzle-kit | 0.31.10 | Schema migrations CLI | Companion to drizzle-orm for generate/migrate/push. | [VERIFIED: npm registry 2026-04-09] |
| pg (node-postgres) | 8.20.0 | PostgreSQL driver | Required by Drizzle for PostgreSQL dialect. | [VERIFIED: npm registry 2026-04-09] |
| @types/pg | 8.20.0 | TypeScript types for pg | Dev dependency. | [VERIFIED: npm registry 2026-04-09] |
| dockerode | 4.0.10 | Docker Engine API client | Locked in CLAUDE.md. For container management from API server. | [VERIFIED: npm registry 2026-04-09] |
| @types/dockerode | 4.0.1 | TypeScript types for dockerode | Dev dependency. | [VERIFIED: npm registry 2026-04-09] |
| zod | 3.25.76 | Runtime validation | CLAUDE.md says ^3.24. Use 3.x (NOT 4.x) -- zod v4 is a major rewrite with breaking API changes and Auth.js/Drizzle ecosystem has not adopted it yet. | [VERIFIED: npm registry 2026-04-09] |
| Tailwind CSS | 4.2.2 | Utility-first CSS | Locked in CLAUDE.md. v4 uses CSS-first configuration (@theme, @import). | [VERIFIED: npm registry 2026-04-09] |
| shadcn/ui (CLI) | 4.2.0 | Component scaffolding | Not an npm dependency -- components are copied into project. CLI version 4.2.0. | [VERIFIED: npm registry 2026-04-09] |
| Lucide React | 1.8.0 | Icon library | Used by shadcn/ui by default. | [VERIFIED: npm registry 2026-04-09] |
| nanoid | 5.1.7 | Short unique ID generation | For environment IDs, session IDs. | [VERIFIED: npm registry 2026-04-09] |
| yaml | 2.8.3 | YAML parsing/generation | For docker-compose.yml generation. | [VERIFIED: npm registry 2026-04-09] |

### Deferred to Later Phases (NOT installed in Phase 1)

| Library | Version | Phase | Purpose |
|---------|---------|-------|---------|
| next-auth (Auth.js v5) | 5.0.0-beta.30 | Phase 2 | Authentication -- still in beta, install when implementing auth |
| @auth/drizzle-adapter | 1.11.1 | Phase 2 | Drizzle adapter for Auth.js sessions/accounts |
| bcryptjs | 3.0.3 | Phase 2 | Password hashing (pure JS, no native compilation needed) |
| Socket.IO | ^4.8 | Phase 4 | WebSocket transport for terminal |
| @xterm/xterm | ^5.5 | Phase 4 | Web terminal |
| @octokit/rest | ^21 | Phase 5 | GitHub API client |
| zustand | ^5 | Phase 6 | Client-side state management |

### Version Decision: Next.js 15 vs 16

Use **Next.js 15.5.15** (not 16.x). Rationale:
- CLAUDE.md specifies `^15` [VERIFIED: CLAUDE.md]
- Next.js 16 (released recently) has breaking changes: fully removed synchronous Request API access, renamed middleware.ts to proxy.ts [CITED: nextjs.org/docs/app/guides/upgrading/version-16]
- next-auth@5 beta explicitly supports `^15.0.0` in peer dependencies [VERIFIED: npm registry]
- Phase 1 is about stability, not bleeding edge
- Use `npx create-next-app@15` to pin scaffolding to v15 [VERIFIED: create-next-app@15 exists at 15.5.15]

### Version Decision: Zod 3.x vs 4.x

Use **zod 3.25.76** (not 4.x). Rationale:
- CLAUDE.md specifies `^3.24` [VERIFIED: CLAUDE.md]
- Zod v4 is a major rewrite with breaking API changes [VERIFIED: npm registry, v4.3.6 exists as separate major]
- Auth.js ecosystem expects zod v3 [ASSUMED]
- Drizzle-zod integration is built for v3 [ASSUMED]

### Discretion Decision: D-08 Database Setup

**Recommendation:** New `devdock` database in existing PostgreSQL cluster with dedicated `devdock` role.
- Saves ~100MB RAM vs separate PostgreSQL instance [CITED: CONTEXT.md D-08]
- On 8GB VPS with ~512MB DevDock budget, every MB matters [VERIFIED: CONTEXT.md D-17]
- Standard pattern: `CREATE DATABASE devdock; CREATE ROLE devdock_app WITH LOGIN PASSWORD '...'; GRANT ALL ON DATABASE devdock TO devdock_app;`
- For local development: use a local PostgreSQL instance or Docker container running PostgreSQL

### Discretion Decision: D-09 Migration Tool

**Recommendation:** Drizzle Kit (`drizzle-kit`).
- Native companion to Drizzle ORM -- same schema definitions drive both runtime queries and migrations [CITED: orm.drizzle.team/docs/migrations]
- `drizzle-kit generate` creates SQL migration files; `drizzle-kit migrate` applies them [VERIFIED: Drizzle official docs]
- `drizzle-kit push` for rapid local development (no migration files) [VERIFIED: Drizzle official docs]
- Migration state tracked in `__drizzle_migrations` table [VERIFIED: Drizzle official docs]

### Discretion Decision: D-12 Process Management

**Recommendation:** systemd on VPS.
- Already specified in CLAUDE.md as recommended [VERIFIED: CLAUDE.md]
- Single service file: `devdock.service` under `/etc/systemd/system/`
- Handles auto-restart, boot startup, journald logging
- For local development: `npm run dev` (Next.js dev server) -- no process manager needed

**Installation (Phase 1 packages only):**
```bash
# Scaffold Next.js project
npx create-next-app@15 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm

# Database
npm install drizzle-orm pg
npm install -D drizzle-kit @types/pg

# Docker management
npm install dockerode
npm install -D @types/dockerode

# Utilities (Phase 1 subset)
npm install zod nanoid yaml

# Initialize shadcn/ui
npx shadcn@latest init

# Add initial shadcn components
npx shadcn@latest add button card
```

## Architecture Patterns

### Recommended Project Structure

```
devdock/                              # Project root (= /home/mohed_abbas/murx/perso/claudecodevps/)
  src/
    app/                              # Next.js App Router
      layout.tsx                      # Root layout
      page.tsx                        # Landing/redirect to dashboard
      api/                            # API routes
        health/
          route.ts                    # Health check endpoint
    lib/
      db/
        index.ts                      # Drizzle client instance
        schema.ts                     # All table definitions
        migrate.ts                    # Migration runner
      docker/
        client.ts                     # dockerode singleton
        compose.ts                    # Compose file generation from templates
        networks.ts                   # Network management helpers
      config.ts                       # App configuration (env vars)
    components/
      ui/                             # shadcn/ui components (auto-generated)
  drizzle/                            # Migration files (generated by drizzle-kit)
    meta/
    0000_*.sql
  docker/
    base/
      Dockerfile                      # Base dev container image (INFRA-02)
      entrypoint.sh                   # Container entrypoint script
    templates/
      base-compose.yml                # Template for new project environments
    daemon.json                       # Docker daemon config (log rotation)
  deploy/
    nginx/
      devdock.conf                    # Nginx server block template (INFRA-03)
    systemd/
      devdock.service                 # systemd unit file
  drizzle.config.ts                   # Drizzle Kit configuration
  next.config.ts                      # Next.js configuration
  .env.local                          # Local development env vars (gitignored)
  .env.example                        # Template for required env vars
```

### Pattern 1: Standalone Output for Self-Hosting

**What:** Configure Next.js to produce a standalone build that includes only necessary dependencies.
**When to use:** Always for self-hosted deployments (this project).
**Example:**
```typescript
// next.config.ts
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```
[CITED: nextjs.org/docs/app/api-reference/config/next-config-js/output]

### Pattern 2: Drizzle Schema-as-Code with snake_case Mapping

**What:** Define database schema in TypeScript with automatic camelCase-to-snake_case column mapping.
**When to use:** All table definitions.
**Example:**
```typescript
// src/lib/db/schema.ts
// Source: https://orm.drizzle.team/docs/sql-schema-declaration
import {
  pgTable, pgEnum, text, varchar, timestamp,
  uuid, boolean, jsonb, integer, uniqueIndex
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const environments = pgTable('environments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  repoUrl: text('repo_url'),
  status: varchar('status', { length: 50 }).default('stopped').notNull(),
  composeConfig: jsonb('compose_config'),
  dockerProjectName: varchar('docker_project_name', { length: 255 }),
  networkName: varchar('network_name', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('env_slug_user_idx').on(table.slug, table.userId),
]);
```
[CITED: orm.drizzle.team/docs/sql-schema-declaration]

### Pattern 3: Drizzle Client Initialization

**What:** Single database connection instance shared across the application.
**Example:**
```typescript
// src/lib/db/index.ts
// Source: https://orm.drizzle.team/docs/get-started/postgresql-new
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle({ client: pool, schema });
```
[CITED: orm.drizzle.team/docs/get-started/postgresql-new]

### Pattern 4: Docker Compose Template Generation

**What:** Generate per-project docker-compose.yml from a template, injecting project-specific values.
**When to use:** When creating new environments (Phase 3), but template structure must be defined in Phase 1.
**Example:**
```yaml
# docker/templates/base-compose.yml
services:
  dev:
    image: devdock-base:latest
    volumes:
      - ./workspace:/workspace
    working_dir: /workspace
    networks:
      - project-net
    # No ports published to host (INFRA-05)
    # mem_limit added in Phase 7 (D-18)

networks:
  project-net:
    driver: bridge
    internal: false  # Needs internet for npm install, git, etc.
    # But no ports published means no inbound from host
```

### Pattern 5: Nginx Reverse Proxy for Next.js with WebSocket Support

**What:** Nginx server block that proxies to Next.js standalone server with WebSocket upgrade support.
**Example:**
```nginx
# deploy/nginx/devdock.conf
# Source: Next.js self-hosting docs + standard nginx WebSocket proxy
server {
    listen 80;
    server_name devdock.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name devdock.yourdomain.com;

    # TLS certs managed by certbot (D-03)
    ssl_certificate /etc/letsencrypt/live/devdock.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/devdock.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for streaming (SSR streaming, WebSocket)
        proxy_buffering off;
        proxy_cache off;
    }
}
```
[ASSUMED: standard nginx reverse proxy pattern, matches Next.js self-hosting recommendations]

### Anti-Patterns to Avoid

- **Publishing sidecar ports to host:** Never add `ports:` to per-project Postgres/Redis services. They communicate over internal Docker networks only. (Pitfall #8)
- **Mounting Docker socket into user containers:** NEVER. Only the API server process talks to Docker daemon. (Pitfall #1)
- **Shared Docker network for all projects:** Each project gets its own network `devdock-{slug}-net`. (Pitfall #3)
- **Using `docker compose down` for stop:** Use `docker compose stop` to preserve volumes. `down` is for destroy. (Architecture doc)
- **Modifying production nginx configs:** DevDock only adds its own `devdock.conf` to sites-enabled/. Never touch existing configs. (D-02, Pitfall #11)
- **Running DevDock as root:** Run as `murx-dev` user on VPS. Docker access via docker group membership. (D-11)
- **`chmod 666 /var/run/docker.sock`:** Never. Use docker group membership for socket access. [CITED: docs.docker.com/engine/security/protect-access/]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database migrations | Custom SQL scripts | drizzle-kit generate/migrate | Tracks migration state, generates from schema diff, rollback support |
| YAML generation | String concatenation | `yaml` npm package (v2.8.3) | Handles escaping, multi-line strings, complex nested structures |
| Unique IDs | Math.random or UUID v4 strings | `nanoid` (v5.1.7) | Short, URL-safe, configurable alphabet, collision-resistant |
| Project scaffolding | Manual file creation | `create-next-app@15` | Correct tsconfig, tailwind, eslint, app router setup |
| UI components | Custom form inputs, dialogs | shadcn/ui components | Accessible, tested, consistent. Copy into project with `npx shadcn@latest add` |
| Docker Compose parsing | Regex on YAML | `yaml` package + TypeScript types | YAML is complex (anchors, multi-doc, flow/block styles) |
| Password hashing | Custom crypto | bcryptjs (Phase 2) | Timing-attack safe, salt included, rounds configurable |

**Key insight:** Phase 1 establishes patterns. If you hand-roll YAML generation or migration tooling now, every subsequent phase inherits that technical debt.

## Common Pitfalls

### Pitfall 1: create-next-app@latest Installs v16

**What goes wrong:** Running `npx create-next-app@latest` installs Next.js 16 (the current latest). CLAUDE.md specifies ^15. Next.js 16 has breaking changes (async-only Request APIs, middleware.ts renamed to proxy.ts) and next-auth v5 beta has not been tested against it extensively.
**Why it happens:** npm's `@latest` tag points to the newest major version.
**How to avoid:** Use `npx create-next-app@15` explicitly. This installs create-next-app 15.5.15 which scaffolds a Next.js 15 project.
**Warning signs:** `package.json` shows `"next": "^16"` or `"next": "16.x"`.
[VERIFIED: npm registry shows create-next-app@latest is 16.2.3, create-next-app@15 is 15.5.15]

### Pitfall 2: Docker Socket Access Without docker Group

**What goes wrong:** The DevDock API server process cannot access `/var/run/docker.sock` because the running user is not in the `docker` group.
**Why it happens:** Docker socket is owned by `root:docker` with 660 permissions. Non-docker-group users get "permission denied."
**How to avoid:** On VPS: `sudo usermod -aG docker murx-dev`. For local development: ensure the development user is in the docker group. For Phase 1, the Dockerfile and compose templates are created but don't require runtime Docker access -- that's Phase 3.
**Warning signs:** `Error: connect EACCES /var/run/docker.sock` at runtime.
[CITED: docs.docker.com/engine/security/protect-access/]

### Pitfall 3: Drizzle ORM Version Mismatch with drizzle-kit

**What goes wrong:** Drizzle ORM and drizzle-kit have tightly coupled versioning. Mismatched versions cause silent schema drift or migration generation failures.
**Why it happens:** Installing them at different times can result in different major versions.
**How to avoid:** Always install both together: `npm install drizzle-orm && npm install -D drizzle-kit`. Check that `drizzle-kit` version is compatible with `drizzle-orm` version. Current compatible pair: drizzle-orm@0.45.2 + drizzle-kit@0.31.10.
**Warning signs:** `drizzle-kit generate` produces empty migrations when schema has changed, or throws type errors.
[VERIFIED: npm registry, both packages current as of 2026-04-09]

### Pitfall 4: Forgetting output: 'standalone' in next.config.ts

**What goes wrong:** Production build creates a full `node_modules` tree instead of a self-contained bundle. Deployment size balloons from ~50MB to 500MB+. The `server.js` standalone entry point doesn't exist.
**Why it happens:** `output: 'standalone'` is not the default. Easy to forget until deployment.
**How to avoid:** Add `output: 'standalone'` to `next.config.ts` in Phase 1, even though deployment is later. Verify with `npm run build` that `.next/standalone/` is created.
**Warning signs:** `.next/standalone/` directory missing after build.
[CITED: nextjs.org/docs, self-hosting guide]

### Pitfall 5: Claude Code CLI Installation Method in Docker

**What goes wrong:** Using the deprecated `npm install -g @anthropic-ai/claude-code` in Dockerfile, which may break or produce outdated versions. Or using the shell installer which assumes interactive terminal.
**Why it happens:** Multiple installation methods exist; the npm method is deprecated but still found in tutorials.
**How to avoid:** Use the official installer script in non-interactive mode: `curl -fsSL https://claude.ai/install.sh | bash`. The installer detects non-interactive environments. Alternatively, the npm package still works at v2.1.97 despite deprecation notice -- test both approaches in CI.
**Warning signs:** `claude` command not found in container, or version significantly behind.
[CITED: code.claude.com/docs/en/setup, npm registry @anthropic-ai/claude-code@2.1.97]

### Pitfall 6: Per-Project Docker Networks Need Internet Access

**What goes wrong:** Setting `internal: true` on the per-project Docker network blocks ALL external access. Containers cannot run `npm install`, `git clone`, `pip install`, or reach any external service.
**Why it happens:** Confusion between "no published ports to host" (INFRA-05) and "no internet access."
**How to avoid:** INFRA-05 requires no ports published to the host -- not network isolation from the internet. Use standard bridge networks without `internal: true`. The security boundary is: no `ports:` directive on sidecar services, so nothing is reachable from the host. The dev container needs outbound internet access for package managers and git.
**Warning signs:** `npm install` fails with ETIMEDOUT inside dev containers.
[VERIFIED: Docker docs on networking, INFRA-05 requirement text]

## Code Examples

### Example 1: drizzle.config.ts

```typescript
// drizzle.config.ts
// Source: https://orm.drizzle.team/docs/get-started/postgresql-new
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Example 2: Base Dev Container Dockerfile

```dockerfile
# docker/base/Dockerfile
# Base development container for DevDock environments
FROM ubuntu:24.04

ARG HOST_UID=1000
ARG HOST_GID=1000
ARG NODE_MAJOR=22

ENV DEBIAN_FRONTEND=noninteractive

# System packages (D-05)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ssh \
    curl \
    wget \
    vim \
    jq \
    build-essential \
    ca-certificates \
    gnupg \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Node.js via NodeSource (D-05)
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user matching host UID/GID (Pitfall #9 prevention)
RUN groupadd -g ${HOST_GID} dev \
    && useradd -m -u ${HOST_UID} -g dev -s /bin/bash dev

# Claude Code CLI (D-07)
# Using official installer -- runs as root, installs system-wide
RUN curl -fsSL https://claude.ai/install.sh | bash

USER dev
WORKDIR /workspace

# Default entrypoint keeps container running for docker exec
ENTRYPOINT ["sleep", "infinity"]
```

### Example 3: Environment Variables Template

```bash
# .env.example
# Database
DATABASE_URL=postgresql://devdock_app:password@localhost:5432/devdock

# Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# Docker
DOCKER_SOCKET=/var/run/docker.sock

# DevDock
DEVDOCK_DATA_DIR=./data
DEVDOCK_MAX_CONCURRENT_ENVS=3
```

### Example 4: Docker Daemon Configuration

```json
// docker/daemon.json
// Apply to /etc/docker/daemon.json on VPS (D-15)
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### Example 5: Health Check API Route

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Verify database connection
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
```

### Example 6: systemd Service File

```ini
# deploy/systemd/devdock.service
[Unit]
Description=DevDock Development Platform
After=network.target postgresql.service docker.service
Requires=docker.service

[Service]
Type=simple
User=murx-dev
Group=murx-dev
WorkingDirectory=/home/murx-dev/devdock
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=on-failure
RestartSec=5
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
Environment=NODE_ENV=production

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/home/murx-dev/devdock/data

[Install]
WantedBy=multi-user.target
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next.config.js` (CommonJS) | `next.config.ts` (TypeScript) | Next.js 15 | Type-safe configuration with autocomplete |
| `tailwind.config.js` + `postcss.config.js` | CSS-first config with `@import "tailwindcss"` | Tailwind v4 (2025) | No JS config files needed; use `@theme` directive in CSS |
| `sharp` manual install for images | Auto-detected by Next.js 15 | Next.js 15 | No need to install sharp separately |
| Drizzle `pgTable` with explicit column names | Same, but with `casing: 'snake_case'` option | drizzle-orm 0.40+ | Can auto-map camelCase TS to snake_case SQL |
| Claude Code via `npm install -g @anthropic-ai/claude-code` | `curl -fsSL https://claude.ai/install.sh \| bash` | 2025 | npm method deprecated; installer preferred |
| `create-next-app` defaults to Pages Router | App Router is default | Next.js 13.4+ | `--app` flag still accepted but is now the default |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Auth.js ecosystem expects zod v3 (not v4) | Standard Stack, Zod version decision | If Auth.js works with zod v4, we could use newer version -- low risk since v3 is explicitly in CLAUDE.md |
| A2 | drizzle-zod integration is built for zod v3 | Standard Stack, Zod version decision | Same as A1 -- low risk |
| A3 | Claude Code installer (`install.sh`) works in non-interactive Dockerfile `RUN` | Code Examples, Dockerfile | If it requires interactive input, must fall back to npm install method -- test during implementation |
| A4 | Nginx WebSocket proxy config with `proxy_buffering off` is sufficient for Next.js streaming SSR | Architecture Patterns, nginx config | If streaming breaks, may need additional `X-Accel-Buffering: no` header -- test during deployment |

## Open Questions (RESOLVED)

1. **PostgreSQL for local development**
   - What we know: VPS has PostgreSQL already. Local dev machine does not have `psql` installed.
   - What's unclear: Should local dev use a Docker-based PostgreSQL or install PostgreSQL natively?
   - RESOLVED: Use `docker-compose.dev.yml` with a PostgreSQL 16 container for local development. Implemented in Plan 01-01 Task 1 Step 7. This avoids polluting the dev machine and matches the containerized production pattern.

2. **Docker daemon access on local machine**
   - What we know: Docker 28.4.0 is installed, but `docker ps` exits with code 1 and user `mohed_abbas` is not in the docker group.
   - What's unclear: Is the Docker daemon running? Can the user be added to docker group?
   - RESOLVED: Phase 1 only creates Dockerfiles and templates -- it does not require runtime Docker access. Docker access needed starting Phase 3. Plan 01-02 creates static files only; Plan 01-03 requires Docker for PostgreSQL and schema push (user intervention if Docker unavailable).

3. **Exact nginx include path on VPS**
   - What we know: Existing nginx at `/home/murx/shared/nginx`. Decision D-02 says sites-enabled/.
   - What's unclear: Exact directory structure. Is it `/etc/nginx/sites-enabled/` or a custom path?
   - RESOLVED: Nginx config template created at `deploy/nginx/devdock.conf` (Plan 01-02 Task 2 Step 3). Actual installation path is determined at VPS deployment time via symlink.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js, npm | Yes | 24.13.0 | -- |
| npm | Package management | Yes | 11.6.2 | -- |
| Docker | Base image build, dev PostgreSQL | Partial (installed, daemon may not be running for user) | 28.4.0 | Phase 1 creates files only; Docker runtime needed in Phase 3 |
| Docker Compose | Template validation | Partial (same as Docker) | v2.39.1 | Same as above |
| PostgreSQL (local) | Database development | No (`psql` not installed) | -- | Docker-based PostgreSQL via docker-compose.dev.yml |
| Python 3 | Build tools, scripts | Yes | 3.12.3 | -- |
| Git | Version control | Yes | 2.43.0 | -- |
| nginx | Reverse proxy | No (not installed locally) | -- | Not needed locally; Next.js dev server accessed directly |
| systemd | Process management | Yes | 255 | Not needed locally; only for VPS deployment |

**Missing dependencies with no fallback:**
- None that block Phase 1 execution

**Missing dependencies with fallback:**
- PostgreSQL client: Use Docker-based PostgreSQL for local development
- Docker runtime access: Phase 1 only creates files; test Docker build in Phase 3
- nginx: Not needed locally; create config template only

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest (ships with create-next-app) or Vitest (lighter, faster) |
| Config file | none -- see Wave 0 |
| Quick run command | `npm test -- --watchAll=false` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Compose template generates valid YAML with sidecar services | unit | `npm test -- --testPathPattern=compose` | Wave 0 |
| INFRA-02 | Base Dockerfile builds successfully | integration | `docker build -t devdock-base-test docker/base/` | Wave 0 |
| INFRA-03 | Nginx config is valid syntax | smoke | `nginx -t -c deploy/nginx/devdock.conf` (on VPS) | manual-only (no nginx locally) |
| INFRA-04 | Docker socket not in any compose template | unit | `npm test -- --testPathPattern=security` | Wave 0 |
| INFRA-05 | No published ports in compose template sidecars | unit | `npm test -- --testPathPattern=compose` | Wave 0 |
| DASH-06 | Next.js responds to HTTP requests | smoke | `npm run build && node .next/standalone/server.js & curl localhost:3000` | Wave 0 |
| DB-SCHEMA | Database schema applies and tables exist | integration | `npm test -- --testPathPattern=db` | Wave 0 |
| DB-HEALTH | Health endpoint returns healthy when DB connected | integration | `npm test -- --testPathPattern=health` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --watchAll=false`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + `npm run build` succeeds + Docker base image builds

### Wave 0 Gaps
- [ ] Test framework setup (Jest or Vitest config for Next.js App Router)
- [ ] `tests/unit/compose-template.test.ts` -- validates YAML generation and security (INFRA-01, INFRA-04, INFRA-05)
- [ ] `tests/integration/db-schema.test.ts` -- validates migration applies and tables exist
- [ ] `tests/integration/health-endpoint.test.ts` -- validates /api/health returns 200
- [ ] `tests/smoke/build.test.ts` -- validates `npm run build` produces standalone output

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 2) | Auth.js v5 with credentials provider |
| V3 Session Management | No (Phase 2) | Auth.js JWT sessions |
| V4 Access Control | Partially | Docker socket restricted to API server process only (INFRA-04) |
| V5 Input Validation | Yes | zod v3 for all API input validation |
| V6 Cryptography | No (Phase 2) | bcryptjs for passwords, encryption for OAuth tokens |
| V13 API Security | Partially | Health endpoint is public; all other endpoints protected (Phase 2) |
| V14 Configuration | Yes | Environment variables for secrets, .env.example template, no secrets in code |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Docker socket gives root on host | Elevation of Privilege | NEVER mount socket into user containers; API server only (INFRA-04) |
| Cross-project container communication | Information Disclosure | Per-project Docker networks (INFRA-05) |
| Nginx config collision breaks production | Denial of Service | Isolated server block in separate file (D-02); `nginx -t` before reload |
| Sidecar ports exposed to internet | Tampering, Information Disclosure | No `ports:` directive on sidecars; internal network only (INFRA-05) |
| Secrets in source code | Information Disclosure | `.env.local` gitignored; `.env.example` has placeholder values only |
| Container root owns host files | Elevation of Privilege | UID/GID matching in Dockerfile (`ARG HOST_UID=1000`) |
| OOM kills production processes | Denial of Service | Architecture supports mem_limit (D-18); enforcement in Phase 7 |

## Sources

### Primary (HIGH confidence)
- npm registry -- verified all package versions (2026-04-09)
- [Drizzle ORM official docs](https://orm.drizzle.team/docs/get-started/postgresql-new) -- PostgreSQL setup, schema declaration, migrations
- [Drizzle ORM schema docs](https://orm.drizzle.team/docs/sql-schema-declaration) -- Column types, enums, indexes, relations
- [Docker networking docs](https://docs.docker.com/compose/how-tos/networking/) -- Per-project network isolation
- [Docker socket security](https://docs.docker.com/engine/security/protect-access/) -- Unix socket permissions, docker group

### Secondary (MEDIUM confidence)
- [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting) -- standalone output, nginx configuration (URL worked via search but not direct fetch)
- [Next.js v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) -- Breaking changes confirmed via WebSearch
- [Auth.js migration guide](https://authjs.dev/getting-started/migrating-to-v5) -- next-auth v5 still in beta
- [shadcn/ui installation](https://ui.shadcn.com/docs/installation/next) -- Next.js + Tailwind v4 setup
- [Claude Code setup docs](https://code.claude.com/docs/en/setup) -- Installation methods

### Tertiary (LOW confidence)
- nginx reverse proxy config for Next.js streaming -- composite from multiple blog posts, standard pattern but not verified against official Next.js docs directly

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry, CLAUDE.md constraints honored
- Architecture: HIGH -- patterns sourced from official docs (Drizzle, Docker, Next.js) and confirmed by project architecture research
- Pitfalls: HIGH -- sourced from project PITFALLS.md (researched 2026-04-08) and verified against official docs
- Docker security: HIGH -- Docker official docs confirm socket permissions model
- nginx config: MEDIUM -- standard pattern but exact streaming config not verified against Next.js official docs

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days -- stable technologies, no fast-moving dependencies)
