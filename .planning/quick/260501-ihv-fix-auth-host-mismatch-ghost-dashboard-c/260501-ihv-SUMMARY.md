---
phase: quick-260501-ihv
plan: 01
subsystem: edge-proxy / auth
tags: [caddy, auth, cookie-scope, host-canonicalization, ghost-dashboard]
requires:
  - existing-caddy-stack-on-:8080
provides:
  - canonical-host-redirect-at-edge
  - cookie-scope-consistent-with-AUTH_URL
affects:
  - all-:8080-traffic-including-/ws/*
tech-stack:
  added: []
  patterns:
    - caddyfile-time-substitution-{$ENV}-for-regex-baked-at-adapt
    - host-canonicalization-308-before-Set-Cookie
key-files:
  created:
    - .planning/quick/260501-ihv-fix-auth-host-mismatch-ghost-dashboard-c/260501-ihv-SUMMARY.md
  modified:
    - Caddyfile
    - docker-compose.yml
    - .planning/debug/app-missing-cli-binaries.md
decisions:
  - "Use Caddyfile-time `{$CANONICAL_HOST}` (adapt-time substitution) instead of runtime `{env.CANONICAL_HOST}` placeholder — runtime placeholders are NOT expanded inside `header_regexp` pattern arguments, so the regex would compile with the literal placeholder text and never match a real Host header, causing every request to redirect (infinite loop). Adapt-time substitution bakes the literal `localhost:8080` into the compiled regex."
  - "Use loopback restart instead of full recreate for the second iteration — env var was already wired during the first recreate, so restart is sufficient to re-read the Caddyfile bind mount."
  - "AUTH_URL stays as-is; only Caddy enforces canonical host. Keeps the GitHub OAuth callback URL pinned in 333befb / 1ace7d6 working without an .env edit."
metrics:
  duration: ~10min
  completed: 2026-05-01T11:26:10Z
---

# Quick Task 260501-ihv: Fix Auth Host-Mismatch Ghost Dashboard Summary

Caddy now 308-redirects any `:8080` request whose Host header is not the canonical AUTH_URL host (`localhost:8080`) before the Next.js app sees it, eliminating the cookie-scope split that produced the "ghost dashboard" when users navigated to `http://127.0.0.1:8080`.

## What Was Built

A two-line Caddyfile addition + a one-stanza docker-compose.yml addition:

1. **Caddyfile (`:8080` site block)** — added a `@noncanonical` named matcher with `not header_regexp Host (?i)^{$CANONICAL_HOST}$` and a `redir @noncanonical http://{$CANONICAL_HOST}{uri} 308` directive at the top of the block, before the `/ws/*` and root `handle` directives. Both lines use Caddyfile-time substitution `{$CANONICAL_HOST}` (NOT `{env.CANONICAL_HOST}`) so the literal canonical host is baked into the compiled regex at config-adapt time.

2. **docker-compose.yml (`caddy` service)** — added an `environment:` block exposing `CANONICAL_HOST: ${CANONICAL_HOST:-localhost:${CADDY_INTERNAL_PORT:-8080}}`, defaulting to the same host:port the compose default for AUTH_URL produces.

3. **Side-issue tracker (`.planning/debug/app-missing-cli-binaries.md`)** — marked the "Auth host-mismatch / ghost dashboard" side issue as RESOLVED, pointing back to this commit + summary.

The change is enforced strictly earlier than Next.js middleware, so Auth.js never gets a chance to issue a `Set-Cookie` on a non-canonical host.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add host canonicalization to Caddyfile and wire CANONICAL_HOST env into compose caddy service | `0641e0a` | `Caddyfile`, `docker-compose.yml` |
| 2 | Browser retest — confirm ghost dashboard is gone | (deferred — `checkpoint:human-verify`, executed by user, not the agent) | — |

## Verification (Automated)

All five `<automated>` checks from the plan pass:

```
=== Test 1: Caddyfile validates ===
Valid configuration

=== Test 2: Non-canonical Host (127.0.0.1:8080) → 308 ===
HTTP/1.1 308 Permanent Redirect
Location: http://localhost:8080/login
PASS: 308 status
PASS: Location header

=== Test 3: Canonical Host (localhost:8080) NOT redirected ===
HTTP/1.1 200 OK
Set-Cookie: authjs.csrf-token=...; Path=/; HttpOnly; SameSite=Lax
Set-Cookie: authjs.callback-url=http%3A%2F%2Flocalhost%3A8080; Path=/; HttpOnly; SameSite=Lax
PASS: 200/3xx
PASS: no self-redirect

=== Test 4: /dashboard redirect chain terminates at 2xx/3xx ===
  status: 308   (Caddy: 127.0.0.1 → localhost)
  status: 200   (Next.js renders /dashboard or auth-redirect on canonical host)
final: 200
PASS

=== Test 5: WebSocket path also redirected ===
HTTP/1.1 308 Permanent Redirect
Location: http://localhost:8080/ws/socket.io/
PASS: WS 308
```

`docker compose logs caddy --tail 20` after the restart shows no `error|fail` lines. The `Set-Cookie` headers in Test 3 confirm Auth.js cookies are being scoped to the canonical host (no Domain attribute means host-only on `localhost`).

## Ready For Browser Retest (Task 2 / Human Checkpoint)

The orchestrator should hand the user the plan's Task 2 checklist verbatim. Concretely:

1. Fresh incognito window.
2. Visit `http://127.0.0.1:8080/login` — URL should bounce to `http://localhost:8080/login`.
3. Log in.
4. Confirm `/dashboard` renders WITH `/api/environments` returning 200 (not 401).
5. DevTools → Application → Cookies should show the Auth.js session cookie scoped to `localhost`, NOT to `127.0.0.1`.

If any step fails, capture URL + status + console error and reopen as a follow-up task.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's `{env.CANONICAL_HOST}` placeholder syntax produced an infinite redirect loop**

- **Found during:** Task 1 verification (Test 3 failed — canonical host was also being redirected, with `final: 308` after 6 hops on `/dashboard`).
- **Issue:** The plan specified `not header_regexp Host (?i)^{env.CANONICAL_HOST}$` and `redir @noncanonical http://{env.CANONICAL_HOST}{uri} 308`. Caddy's `caddy adapt` produced JSON with the literal pattern `(?i)^{env.CANONICAL_HOST}$` — runtime placeholders are NOT expanded inside `header_regexp` pattern arguments. The compiled regex never matches a real Host header (e.g., `localhost:8080`), so the `not` matcher always evaluates true, redirecting every request — including the canonical one — and producing an infinite loop.
- **Fix:** Switched both occurrences to Caddyfile-time substitution `{$CANONICAL_HOST}`, which expands at config-adapt time. The adapted JSON now contains the literal `(?i)^localhost:8080$`, which matches the canonical Host header correctly. The redirect target is similarly baked to `http://localhost:8080{http.request.uri}`.
- **Files modified:** `Caddyfile`
- **Commit:** `0641e0a`

The threat-model entry T-quick-260501-ihv-04 (Denial of Service: redirect loop) anticipated exactly this failure mode and called for verification step 3 to detect it. That verification fired correctly and the loop was caught before commit.

**2. [Rule 3 - Operational] Caddyfile bind-mount cache truncated the file inside the running container before recreate**

- **Found during:** Task 1 first validate attempt.
- **Issue:** The first `docker compose exec caddy caddy validate` hit a stale, truncated copy of the Caddyfile inside the container (1918 bytes vs 2476 on host) — a Docker Desktop on macOS bind-mount cache artifact. Validate failed with a misleading syntax error pointing at `@noncanonic` (truncated mid-token).
- **Fix:** Proceeded with the planned `docker compose up -d caddy` (recreate), which re-mounts the file fresh; the recreated container saw the full file and adapted/served it cleanly.
- **Files modified:** none (operational only).
- **No commit:** transient state.

### No Other Deviations

The compose env-var stanza, defaults, placement, and the order of operations (validate → recreate → re-verify) all matched the plan exactly. AUTH_URL in `.env` was NOT touched. No app or terminal rebuild was performed.

## Threat Surface

The plan's `<threat_model>` covers all four trust-boundary risks. Disposition outcomes:

| Threat ID | Disposition | Verified? |
|-----------|-------------|-----------|
| T-quick-260501-ihv-01 (Spoofing — bypass via Host suffix) | mitigate | ✅ regex anchored `^...$` and case-insensitive; `Host: localhost:8080.attacker` would not match `^localhost:8080$` |
| T-quick-260501-ihv-02 (Tampering — open redirect via Host header) | accept | ✅ redirect target is hardcoded `http://localhost:8080{uri}` (env-supplied at adapt time, not request-controlled) |
| T-quick-260501-ihv-03 (Information Disclosure — split cookie scope) | mitigate | ✅ this change IS the mitigation; verified by Set-Cookie observed only on canonical-host responses |
| T-quick-260501-ihv-04 (DoS — redirect loop) | mitigate | ✅ Test 3 explicitly verifies canonical host returns 200 with no Location; the very deviation above demonstrates this verification works |

No new threat surface introduced beyond what the plan specified.

## Self-Check: PASSED

- ✅ `Caddyfile` modified, `git log -1 --stat` shows `+9` lines (matcher + redir + comments).
- ✅ `docker-compose.yml` modified, environment block + `CANONICAL_HOST` line present in caddy service.
- ✅ Commit `0641e0a` exists in `git log --oneline`.
- ✅ Container `devdock-caddy` is `Up (healthy)` with ports `127.0.0.1:8080->8080/tcp`.
- ✅ `caddy adapt` shows pattern `(?i)^localhost:8080$` (literal, expanded at adapt time).
- ✅ `.env` AUTH_URL untouched (not staged, not modified).
- ✅ All 5 automated verify steps from the plan return PASS.
- ✅ No deletions in the commit (`git diff --diff-filter=D` empty).
