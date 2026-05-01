---
phase: 260501-gx3
plan: 01
subsystem: github-oauth
tags:
  - github-oauth
  - redirects
  - hardening
requires: []
provides:
  - "GitHub OAuth callback redirects pinned to canonical AUTH_URL host"
affects:
  - src/app/api/github/callback/route.ts
tech-stack:
  added: []
  patterns:
    - "config.AUTH_URL ?? request.url fallback for Response.redirect base URLs"
key-files:
  created: []
  modified:
    - src/app/api/github/callback/route.ts
decisions:
  - "Use `config.AUTH_URL ?? request.url` fallback rather than asserting AUTH_URL — AUTH_URL is optional in envSchema, and `new URL(path, undefined)` throws TypeError. The fallback preserves prior behavior when AUTH_URL is unset."
metrics:
  duration: "~2 minutes"
  completed: "2026-05-01"
  tasks_completed: 1
  files_modified: 1
requirements:
  - GX3-01
---

# Phase 260501-gx3 Plan 01: Harden GitHub OAuth Callback Redirects Summary

Pinned the GitHub OAuth callback redirect base URL to `config.AUTH_URL` (with `request.url` as fallback) so post-OAuth navigation always lands on a host the browser can reach, even when the user initiated the flow via a non-routable hostname like `0.0.0.0`.

## What Changed

Two-line edit in `src/app/api/github/callback/route.ts`:

1. **Line 14** — login redirect when no session:
   ```ts
   // before
   if (!session?.user?.id) return Response.redirect(new URL('/login', request.url));
   // after
   if (!session?.user?.id) return Response.redirect(new URL('/login', config.AUTH_URL ?? request.url));
   ```

2. **Line 21** — base URL for all subsequent settings redirects (success/error branches all reuse `settingsUrl`):
   ```ts
   // before
   const settingsUrl = new URL('/dashboard/settings', request.url);
   // after
   const settingsUrl = new URL('/dashboard/settings', config.AUTH_URL ?? request.url);
   ```

`config` was already imported on line 4, so no new imports were needed.

## Why

`new URL(path, request.url)` inherits the inbound request host. If a user reaches the app via a hostname the browser refuses to use as a redirect destination (e.g. `0.0.0.0`), the OAuth handshake succeeds but the post-OAuth landing page fails to load. Pinning the base to `config.AUTH_URL` (the canonical host) makes the redirect target always reachable. The `?? request.url` fallback preserves the prior behavior when `AUTH_URL` is unset (the env schema treats it as optional).

## Verification

- `grep -n "config.AUTH_URL ?? request.url" src/app/api/github/callback/route.ts` → 2 occurrences (lines 14 and 21).
- `pnpm exec tsc --noEmit` exits 0 with no new errors.
- No other files modified.

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | fix(github-oauth): pin OAuth callback redirects to AUTH_URL | 333befb |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/app/api/github/callback/route.ts (modified, 2 occurrences of `config.AUTH_URL ?? request.url`)
- FOUND: 333befb (commit in git log)
- FOUND: .planning/quick/260501-gx3-harden-github-oauth-callback-redirects-t/260501-gx3-SUMMARY.md
