---
phase: 01-foundation-infrastructure
fixed_at: 2026-04-09T12:30:00Z
review_path: .planning/phases/01-foundation-infrastructure/01-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 7
skipped: 1
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-09T12:30:00Z
**Source review:** .planning/phases/01-foundation-infrastructure/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8
- Fixed: 7
- Skipped: 1

## Fixed Issues

### CR-01: Database module bypasses Zod-validated config

**Files modified:** `src/lib/db/index.ts`
**Commit:** 81a9aca
**Applied fix:** Replaced `process.env.DATABASE_URL!` with `config.DATABASE_URL` from the Zod-validated config module. Added `import { config } from '@/lib/config'` to use the validated configuration object instead of bypassing it with a raw env var and non-null assertion.

### CR-02: NEXTAUTH_SECRET is optional in config validation

**Files modified:** `src/lib/config.ts`
**Commit:** d31afa4
**Applied fix:** Changed `NEXTAUTH_SECRET` from `z.string().min(16).optional()` to `z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters')`. The field is now required (not optional) and enforces a minimum length of 32 characters, preventing deployments with missing or weak session signing secrets.

### CR-03: .env file is not in .gitignore

**Files modified:** `.gitignore`
**Commit:** a6067bc
**Applied fix:** Added `.env` to the env files section of `.gitignore`, placed before `.env.local`. This prevents accidental commits of the `.env` file containing `DATABASE_URL`, `NEXTAUTH_SECRET`, and other secrets.

### WR-01: Systemd service blocks Docker socket access

**Files modified:** `deploy/systemd/devdock.service`
**Commit:** 92fee87
**Applied fix:** Added `ReadWritePaths=/var/run/docker.sock` to allow Docker socket access under `ProtectSystem=strict`, and added `SupplementaryGroups=docker` to ensure the service process has the docker group membership needed for socket access.

### WR-02: Entrypoint chown block is dead code

**Files modified:** `docker/base/entrypoint.sh`
**Commit:** 38a8e78
**Applied fix:** Removed the dead `if [ "$(id -u)" = "0" ]` chown block. Since the Dockerfile sets `USER dev` before `ENTRYPOINT`, the entrypoint always runs as UID 1000 (non-root), making the root-only chown block unreachable. Workspace permissions are already handled by the `HOST_UID`/`HOST_GID` build args.

### WR-03: Nginx Connection header unconditionally set to "upgrade"

**Files modified:** `deploy/nginx/devdock.conf`
**Commit:** 44468c7
**Applied fix:** Added a `map $http_upgrade $connection_upgrade` block outside the server blocks that sets `Connection` to `upgrade` only when `$http_upgrade` is present, and `close` otherwise. Updated the location block to use `$connection_upgrade` instead of the hardcoded `"upgrade"` string. This preserves proper HTTP/1.1 keep-alive behavior for non-WebSocket requests.

### WR-04: Docker Compose dev environment exposes PostgreSQL on all interfaces

**Files modified:** `docker-compose.dev.yml`
**Commit:** 04e5284
**Applied fix:** Changed port binding from `"5432:5432"` to `"127.0.0.1:5432:5432"` so PostgreSQL is only accessible from localhost, not from the network. This prevents the dev database with its hardcoded password from being reachable from the internet on the VPS.

## Skipped Issues

### WR-05: Dockerfile uses curl-pipe-bash for NodeSource and Claude CLI without integrity verification

**File:** `docker/base/Dockerfile:34,44`
**Reason:** No practical fix without known-good SHA256 hashes. The NodeSource and Claude CLI install scripts are dynamically generated and change with each release. Pinning a hash would break on the next update and there are no published checksums to reference. The review itself flagged this as "accept/skip -- no practical fix without known hashes." Both scripts use HTTPS (`curl -fsSL`) which provides transport-level integrity but not supply-chain verification.
**Original issue:** Two `curl | bash` patterns fetch and execute remote scripts without checksum or signature verification, creating a supply-chain attack vector.

---

_Fixed: 2026-04-09T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
