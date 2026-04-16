---
phase: 06-dashboard-monitoring
plan: "06"
subsystem: preview-proxy
tags: [nginx, proxy, subdomain, preview, docker]
dependency_graph:
  requires: []
  provides: [subdomain-preview-proxy]
  affects: [environment-card, nginx-config, config]
tech_stack:
  added: []
  patterns: [subdomain-routing, nginx-wildcard, uuid-as-token]
key_files:
  created:
    - deploy/nginx/devdock-preview.conf
    - src/app/api/preview/[[...path]]/route.ts
  modified:
    - src/lib/config.ts
    - src/app/dashboard/_components/environment-card.tsx
  deleted:
    - src/app/api/environments/[id]/preview/[[...path]]/route.ts
decisions:
  - "Subdomain-based preview proxy: each env at {uuid}.preview.devdock.example.com — eliminates HTML path rewriting entirely"
  - "No auth on preview route: UUID (122-bit entropy) acts as unguessable token, same model as Vercel/Netlify preview URLs (T-06-06-02)"
  - "NEXT_PUBLIC_PREVIEW_DOMAIN controls client-side button visibility; button hidden when unset"
metrics:
  duration: "~7min"
  completed: "2026-04-16"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 5
---

# Phase 06 Plan 06: Subdomain Preview Proxy Summary

Replaced broken path-based preview proxy with nginx wildcard subdomain routing — each environment is now accessible at `{env-id}.preview.devdock.example.com` so assets and navigation resolve naturally without any HTML rewriting.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Nginx wildcard config + subdomain proxy route + config update | dcc510a | deploy/nginx/devdock-preview.conf, src/app/api/preview/[[...path]]/route.ts, src/lib/config.ts |
| 2 | Update preview button URL + remove old proxy route | a5cb248 | src/app/dashboard/_components/environment-card.tsx, deleted src/app/api/environments/[id]/preview/[[...path]]/route.ts |

## Checkpoint Pending

**Task 3** (checkpoint:human-verify) is pending human verification of the end-to-end subdomain infrastructure setup (DNS, wildcard TLS, nginx reload, env var configuration, and functional testing of asset loading and navigation).

## What Was Built

**Nginx wildcard subdomain config** (`deploy/nginx/devdock-preview.conf`): Server block for `*.preview.devdock.yourdomain.com` that proxies all requests to Next.js on port 3000, forwarding the original `Host` header so Next.js can extract the environment ID from the subdomain. Includes WebSocket upgrade support for HMR.

**Subdomain-aware proxy route** (`src/app/api/preview/[[...path]]/route.ts`): Extracts the environment UUID from the `Host` header subdomain, validates UUID format, looks up the environment in the DB, finds the container's Docker network IP via `docker inspect`, and proxies the request to `http://{containerIp}:{previewPort}{path}`. No HTML rewriting — paths resolve naturally at the subdomain root.

**Config update** (`src/lib/config.ts`): Added `PREVIEW_DOMAIN` to the zod schema (server-side, used by the proxy route). Added comment noting `NEXT_PUBLIC_PREVIEW_DOMAIN` must also be set for the client-side button (inlined at build time by Next.js).

**Preview button update** (`src/app/dashboard/_components/environment-card.tsx`): `getPreviewUrl` helper constructs `https://{env-id}.{NEXT_PUBLIC_PREVIEW_DOMAIN}`. Button is hidden when `NEXT_PUBLIC_PREVIEW_DOMAIN` is not set, preventing broken links in unconfigured environments.

**Old proxy deleted** (`src/app/api/environments/[id]/preview/[[...path]]/route.ts`): Removed per D-19. The path-based proxy with HTML rewriting is fully replaced.

## Security

Threat T-06-06-01 (cookie/authorization header leakage) is mitigated: `STRIP_HEADERS = ['cookie', 'authorization']` applied before forwarding. Threat T-06-06-02 (unauthenticated preview access) is accepted: UUID entropy (122 bits) is the access control, matching the Vercel/Netlify preview URL model.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The proxy implementation is complete. The preview feature requires one-time infrastructure setup (DNS + TLS + nginx reload + env vars) documented in Task 3's verification steps.

## Threat Flags

None. All security-relevant surfaces are covered by the plan's threat model.

## Self-Check: PASSED

- deploy/nginx/devdock-preview.conf: FOUND
- src/app/api/preview/[[...path]]/route.ts: FOUND
- src/lib/config.ts (PREVIEW_DOMAIN): FOUND
- src/app/dashboard/_components/environment-card.tsx (getPreviewUrl): FOUND
- src/app/api/environments/[id]/preview/[[...path]]/route.ts: DELETED (intentional per D-19)
- Commits dcc510a and a5cb248: FOUND
- Next.js build: PASSED
