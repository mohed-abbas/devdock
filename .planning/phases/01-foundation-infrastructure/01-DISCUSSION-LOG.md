# Phase 1: Foundation & Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 01-foundation-infrastructure
**Areas discussed:** Nginx setup, Base dev image, Database layout, Project location, Build cache

---

## Nginx Setup

| Option | Description | Selected |
|--------|-------------|----------|
| dev.yourdomain.com | Standard pattern — 'dev' is intuitive | |
| devdock.yourdomain.com | More specific — won't collide if you later want dev. for something else | ✓ |
| Custom | User specifies domain | |

**User's choice:** devdock.yourdomain.com
**Notes:** More specific subdomain to avoid future collisions

| Option | Description | Selected |
|--------|-------------|----------|
| Separate include | New file in sites-enabled/ — completely isolated from prod | ✓ |
| You decide | Claude picks safest approach | |

**User's choice:** Separate include file
**Notes:** Clean isolation from production nginx configs

---

## Base Dev Image

| Option | Description | Selected |
|--------|-------------|----------|
| Ubuntu 24.04 | Full-featured, familiar, all tools available (~200MB) | ✓ |
| Debian slim | Smaller (~80MB), still has apt | |
| Alpine | Tiny (~5MB) but musl libc — potential compatibility issues | |

**User's choice:** Ubuntu 24.04
**Notes:** Prioritized compatibility and familiarity over image size

| Option | Description | Selected |
|--------|-------------|----------|
| Node.js + npm | For JS/TS projects and Claude Code CLI | ✓ |
| Python 3 | For Python projects and scripting | ✓ |
| Git + SSH | Essential for repo operations | ✓ |
| Common CLIs | curl, wget, vim, jq, build-essential | ✓ |

**User's choice:** All tools selected
**Notes:** Full development toolkit in every container

---

## Database Layout

| Option | Description | Selected |
|--------|-------------|----------|
| New DB in existing cluster | CREATE DATABASE devdock in existing PostgreSQL | |
| Separate instance | Run separate PostgreSQL container for DevDock | |
| You decide | Claude picks based on VPS constraints | ✓ |

**User's choice:** Claude's discretion
**Notes:** Claude will optimize for 8GB RAM constraint

| Option | Description | Selected |
|--------|-------------|----------|
| Drizzle Kit | Built-in migration tool for Drizzle ORM | |
| You decide | Claude picks standard approach | ✓ |

**User's choice:** Claude's discretion
**Notes:** Drizzle Kit is the natural choice

---

## Project Location

**User's choice:** Development happens locally first in current directory. Deployment to VPS later under a new `murx-dev` user.
**Notes:** User clarified this is a local development machine, not the VPS. VPS deployment is a separate step after development.

| Option | Description | Selected |
|--------|-------------|----------|
| systemd | Standard Linux service | |
| Docker container | DevDock in Docker | |
| You decide | Claude picks | ✓ |

**User's choice:** Claude's discretion
**Notes:** systemd recommended by architecture research

---

## Build Cache

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative | Weekly prune, keep recent caches (10-20GB) | |
| Aggressive | Daily prune, only keep active images | |
| Threshold-based | Auto-prune when disk > 80% — adaptive | ✓ |
| You decide | Claude picks | |

**User's choice:** Threshold-based cleanup
**Notes:** Adaptive to actual usage on 100GB NVMe

| Option | Description | Selected |
|--------|-------------|----------|
| Shared base + layers | One base image, projects add layers | |
| Per-project images | Each project can have its own Dockerfile | ✓ |
| You decide | Claude picks | |

**User's choice:** Per-project images
**Notes:** Maximum flexibility, each project can customize fully

---

## Claude's Discretion

- Database setup (new DB in existing cluster vs separate instance)
- Migration tool (Drizzle Kit)
- Process management (systemd vs Docker)

## Deferred Ideas

None — discussion stayed within phase scope
