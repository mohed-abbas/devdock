---
task_id: 260426-vk1
type: quick
plan: 01
wave: 1
status: completed
completed: 2026-04-26
requirements:
  - QUICK-260426-vk1
key-files:
  modified:
    - src/app/api/github/authorize/route.ts
    - docker-compose.yml
commit: 1ace7d6
---

# Quick Task 260426-vk1: Fix GitHub OAuth State Cookie Not Surviving on HTTP — Summary

GitHub OAuth state cookie now survives the authorize → callback redirect on `http://localhost:8080` (Secure flag is dropped when AUTH_URL is HTTP), and the app container now actually receives `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_TOKEN_ENCRYPTION_KEY` from `.env` via compose bare interpolation.

## Changes

### `src/app/api/github/authorize/route.ts` (line 18)

```diff
-    secure: true,
+    secure: config.AUTH_URL?.startsWith('https://') ?? false,
```

The `config` import was already in place at line 4, so no other lines changed. The other cookie flags (`httpOnly: true`, `sameSite: 'lax'`, `maxAge: 600`, `path: '/'`) remain unchanged — those still provide CSRF and lifetime protection on the 10-minute OAuth state cookie. On HTTPS production deploys the cookie keeps the Secure attribute as before.

### `docker-compose.yml` (app service env block, between `ADMIN_PASSWORD_HASH` and `CADDY_ADMIN_URL`)

User had pre-staged this change in the working tree — it was committed verbatim as part of this atomic fix:

```yaml
# GITHUB_* — bare interpolation without default. When the var is set in .env,
# compose injects it. When unset, compose emits a warning and injects an empty
# string, which fails zod .min(1)/.regex() at app init — loud rather than the
# silent "integration not configured" failure mode.
GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
GITHUB_TOKEN_ENCRYPTION_KEY: ${GITHUB_TOKEN_ENCRYPTION_KEY}
```

Bare interpolation (no `:-` default) is intentional: an unset var produces a compose warning and an empty string that trips zod at boot. Loud failure beats the previous silent "GitHub integration not configured" 503.

## Verification

| Check | Result |
| --- | --- |
| `src/app/api/github/authorize/route.ts:18` reads `secure: config.AUTH_URL?.startsWith('https://') ?? false,` | PASS |
| `docker-compose.yml` retains the three `GITHUB_*` bare-interpolation entries with explanatory comment | PASS |
| `pnpm exec tsc --noEmit` | PASS (exit 0, no type errors) |
| `pnpm exec vitest run src/lib/github` | DEFERRED — vitest config loader fails with `ERR_REQUIRE_ESM` on `std-env` (pre-existing environment issue, not caused by this change; reproduced on master with this change stashed) |

### Single atomic commit

```
1ace7d6 fix(github-oauth): allow state cookie over HTTP and pass GITHUB_* env into app container
```

Both files staged and committed together as required by the plan.

## Deferred Issues

**Vitest config loader broken in current environment.** Running `pnpm exec vitest run` fails before any test executes with:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module .../std-env/dist/index.mjs not supported.
  at Object.<anonymous> (.../node_modules/vitest/dist/config.cjs:4:14)
```

This is a CommonJS/ESM mismatch in the vitest 4.1.4 + std-env (newer ESM-only) combination, not caused by this task's diff. Verified the failure reproduces on master with the change stashed. Tracked here for the next environment/dependency-cleanup pass — possible fixes:

- Pin/downgrade `std-env` to a CJS-compatible version
- Bump the entire vitest stack
- Run vitest under an alternate node mode (e.g. `--experimental-require-module`)

Out of scope for this quick fix per the executor scope boundary.

## Manual Smoke (still owed by the user)

The plan calls these out as informational, not blocking. After rebuilding the app image, the user should:

1. `docker compose up -d --build app`
2. Visit `http://localhost:8080/dashboard/settings`, click **Connect GitHub**.
3. Authorize on github.com; expect `/dashboard/settings?github_success=connected` (NOT `?github_error=state_mismatch`).
4. DevTools → Application → Cookies on `localhost`: `github_oauth_state` cookie has `Secure` unchecked.

## Self-Check

- [x] `src/app/api/github/authorize/route.ts` line 18 contains the conditional secure flag (verified via Read after Edit; tsc clean)
- [x] `docker-compose.yml` lines 111–117 contain the GITHUB_* bare-interpolation block with comment (verified via `git diff docker-compose.yml` before commit)
- [x] Commit `1ace7d6` exists on `phase-999.2.2-fix-compose-mounts-and-terminal-env` (verified via `git rev-parse --short HEAD`)
- [x] Commit message has no Co-Authored-By or Generated-with trailers (per user MEMORY)

## Self-Check: PASSED
