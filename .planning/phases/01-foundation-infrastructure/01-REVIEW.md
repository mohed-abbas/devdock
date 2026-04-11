---
phase: 01-foundation-infrastructure
reviewed: 2026-04-09T12:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - deploy/nginx/devdock.conf
  - deploy/systemd/devdock.service
  - docker/base/Dockerfile
  - docker/base/entrypoint.sh
  - docker-compose.dev.yml
  - docker/daemon.json
  - docker/templates/base-compose.yml
  - drizzle.config.ts
  - .env.example
  - .gitignore
  - next.config.ts
  - package.json
  - scripts/docker-cleanup.sh
  - src/app/api/health/route.ts
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/lib/config.ts
  - src/lib/db/index.ts
  - src/lib/db/schema.ts
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-09T12:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

This review covers the Phase 01 foundation infrastructure for DevDock: Docker configuration, database schema, systemd/nginx deployment configs, Next.js scaffolding, and supporting scripts. The codebase is well-structured with good separation of concerns (config validation via Zod, schema-as-code with Drizzle, threshold-based cleanup scripts). However, there are three critical security issues: the database module bypasses validated configuration, the auth secret is optional allowing deployments without session security, and the `.env` file is not gitignored which risks secret leakage. Several warnings around deployment configuration could cause runtime failures in production.

## Critical Issues

### CR-01: Database module bypasses Zod-validated config

**File:** `src/lib/db/index.ts:6`
**Issue:** The database connection pool reads `process.env.DATABASE_URL!` directly with a TypeScript non-null assertion, completely bypassing the Zod-validated `config` object from `src/lib/config.ts`. This means:
1. If `DATABASE_URL` is missing, the app gets a runtime crash from `pg` instead of a clear validation error from Zod.
2. If `DATABASE_URL` is malformed (not a `postgresql://` URL), the Zod schema validation in `config.ts` is never applied to the actual database connection.
3. The non-null assertion (`!`) silences TypeScript's safety check.
**Fix:**
```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { config } from '@/lib/config';

const pool = new Pool({
  connectionString: config.DATABASE_URL,
});

export const db = drizzle({ client: pool, schema });
```

### CR-02: NEXTAUTH_SECRET is optional in config validation

**File:** `src/lib/config.ts:7`
**Issue:** `NEXTAUTH_SECRET` is marked as `.optional()` in the Zod schema. In production, if this value is missing, Auth.js will either use a weak default or fail silently, allowing session tokens to be forged. The CLAUDE.md spec explicitly requires Auth.js with JWT sessions -- those JWTs are signed with this secret.
**Fix:**
```typescript
const envSchema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters')
    .refine(
      (val) => process.env.NODE_ENV !== 'production' || val !== undefined,
      'NEXTAUTH_SECRET is required in production'
    ),
  DOCKER_SOCKET: z.string().default('/var/run/docker.sock'),
  DEVDOCK_DATA_DIR: z.string().default('./data'),
  DEVDOCK_MAX_CONCURRENT_ENVS: z.coerce.number().int().min(1).default(3),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});
```
At minimum, make it required (not optional) and enforce `min(32)`. A more robust approach is to make it required only in production via a `.superRefine()`.

### CR-03: .env file is not in .gitignore -- secret leakage risk

**File:** `.gitignore:37-40`
**Issue:** The `.gitignore` excludes `.env.local` and `.env*.local` patterns, but does NOT exclude `.env` itself. The `.env.example` file documents that `DATABASE_URL`, `NEXTAUTH_SECRET`, and `DOCKER_SOCKET` go in environment files. If a developer creates `.env` with real credentials (a common pattern, and the one `drizzle.config.ts` explicitly loads on line 6), those secrets will be staged and potentially committed.
**Fix:** Add `.env` to the gitignore. Place it with the other env patterns:
```gitignore
# env files
.env
.env.local
.env*.local
.env.development.local
.env.test.local
.env.production.local
```

## Warnings

### WR-01: Systemd service blocks Docker socket access

**File:** `deploy/systemd/devdock.service:29-31`
**Issue:** The service uses `ProtectSystem=strict` which makes the entire filesystem read-only except paths listed in `ReadWritePaths`. However, `ReadWritePaths` only includes `/home/murx-dev/devdock/data`. The application needs to access the Docker socket at `/var/run/docker.sock` (per `src/lib/config.ts` default). With `ProtectSystem=strict`, the Docker socket will be inaccessible, causing all Docker management operations to fail at runtime.
**Fix:** Add the Docker socket path and also consider the user's supplementary group:
```ini
# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/home/murx-dev/devdock/data
ReadWritePaths=/var/run/docker.sock
PrivateTmp=true
SupplementaryGroups=docker
```

### WR-02: Entrypoint chown block is dead code

**File:** `docker/base/entrypoint.sh:7`
**Issue:** The Dockerfile sets `USER dev` (line 50) before the `ENTRYPOINT` (line 53), so the entrypoint always runs as the `dev` user (UID 1000, not 0). The condition `if [ "$(id -u)" = "0" ]` on line 7 will never be true, making the entire chown block dead code. If workspace permissions need fixing, this code will silently not fix them.
**Fix:** Either remove the dead code block since permissions are handled by the `HOST_UID`/`HOST_GID` build args, or restructure the Dockerfile to run entrypoint as root and drop privileges:
```dockerfile
# Option A: Remove dead code from entrypoint.sh
#!/bin/bash
set -e
# Keep container running for docker exec access
exec sleep infinity
```
```dockerfile
# Option B: Run entrypoint as root, drop to dev user
# In Dockerfile, remove "USER dev" before ENTRYPOINT
# In entrypoint.sh:
#!/bin/bash
set -e
if [ -d /workspace ]; then
    chown -R dev:dev /workspace 2>/dev/null || true
fi
exec gosu dev sleep infinity
```

### WR-03: Nginx Connection header unconditionally set to "upgrade"

**File:** `deploy/nginx/devdock.conf:42`
**Issue:** `proxy_set_header Connection "upgrade"` is set for all requests under `/`, not just WebSocket connections. For regular HTTP requests, the `Connection` header should be passed through or set based on the `$http_upgrade` variable. Hardcoding "upgrade" on every request can interfere with keep-alive behavior and HTTP/1.1 connection management.
**Fix:**
```nginx
# Use a map block outside the server block:
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

# Then in the location block:
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```

### WR-04: Docker Compose dev environment exposes PostgreSQL on all interfaces

**File:** `docker-compose.dev.yml:9`
**Issue:** `ports: - "5432:5432"` publishes PostgreSQL on `0.0.0.0:5432`, making it accessible from the network. On the VPS, this means the dev database with the hardcoded password `devdock_dev_password` is reachable from the internet (unless blocked by a firewall). Even in development, binding to localhost is safer.
**Fix:**
```yaml
ports:
  - "127.0.0.1:5432:5432"
```

### WR-05: Dockerfile uses curl-pipe-bash for NodeSource and Claude CLI without integrity verification

**File:** `docker/base/Dockerfile:34,44`
**Issue:** Two `curl | bash` patterns fetch and execute remote scripts without any checksum or signature verification:
- Line 34: `curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -`
- Line 44: `curl -fsSL https://claude.ai/install.sh | bash`

This is a supply-chain attack vector. If either URL is compromised or MITM'd, arbitrary code runs in the build. The Claude CLI install is particularly concerning as `claude.ai/install.sh` is not a well-established package distribution channel.
**Fix:** For NodeSource, prefer the official Node.js Docker image or use the apt repository with GPG key verification. For Claude CLI, download the script first, verify a checksum, then execute:
```dockerfile
# NodeSource alternative: Use multi-stage with official node image
# Or at minimum, pin a known-good script hash
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x -o /tmp/nodesource.sh \
    && echo "<expected_sha256>  /tmp/nodesource.sh" | sha256sum -c - \
    && bash /tmp/nodesource.sh \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* /tmp/nodesource.sh
```

## Info

### IN-01: Health route hardcodes version string

**File:** `src/app/api/health/route.ts:5`
**Issue:** `const VERSION = '0.1.0'` is hardcoded and will drift from the version in `package.json` (currently also `0.1.0`). When the package version is bumped, the health endpoint will report stale information.
**Fix:** Read from package.json or use a build-time constant:
```typescript
import packageJson from '../../../../package.json';
const VERSION = packageJson.version;
```
Or define it in `next.config.ts` via `env` to make it available at build time.

### IN-02: Base compose template contains weak default password in commented section

**File:** `docker/templates/base-compose.yml:40`
**Issue:** The commented-out PostgreSQL sidecar section contains `POSTGRES_PASSWORD: devpassword`. When users uncomment this template to add a database to their project environment, they will get a weak default password. The template variable system uses `{{...}}` placeholders for other values but not for this password.
**Fix:** Use a template variable for the password:
```yaml
#     POSTGRES_PASSWORD: "{{PROJECT_DB_PASSWORD}}"
```
And generate a random password at environment creation time.

---

_Reviewed: 2026-04-09T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
