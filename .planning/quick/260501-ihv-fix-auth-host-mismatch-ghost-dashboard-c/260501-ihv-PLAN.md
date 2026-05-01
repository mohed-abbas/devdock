---
phase: quick-260501-ihv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Caddyfile
  - docker-compose.yml
autonomous: false
requirements:
  - QUICK-AUTH-HOST-CANON
must_haves:
  truths:
    - "A request to http://127.0.0.1:8080/<path> (Host: 127.0.0.1:8080) is 308-redirected to http://localhost:8080/<path> by Caddy before the Next.js app sees it."
    - "A request whose Host header already matches the canonical AUTH_URL host (localhost:8080) is served normally with no redirect."
    - "Following the redirect chain from http://127.0.0.1:8080/dashboard ends at a 200 response on the canonical localhost:8080 host."
    - "Auth.js login flow initiated at http://localhost:8080/login sets its session cookie on the localhost host AND the dashboard at localhost:8080 sends that cookie to /api/* — no ghost dashboard."
    - "AUTH_URL in .env is unchanged (still http://localhost:8080); only Caddy enforces the canonical host."
  artifacts:
    - path: "Caddyfile"
      provides: "Host canonicalization redirect on the :8080 site block"
      contains: "redir"
    - path: "docker-compose.yml"
      provides: "CANONICAL_HOST env wired into the caddy service so the Caddyfile can reference {env.CANONICAL_HOST}"
      contains: "CANONICAL_HOST"
  key_links:
    - from: "docker-compose.yml (caddy service environment)"
      to: "Caddyfile (:8080 block)"
      via: "CANONICAL_HOST env var consumed via {env.CANONICAL_HOST}"
      pattern: "CANONICAL_HOST"
    - from: "Caddyfile redirect"
      to: "browser session cookie scope"
      via: "308 to canonical host before any Set-Cookie is issued by Auth.js"
      pattern: "redir.*308"
---

<objective>
Fix the auth host-mismatch ghost dashboard by canonicalizing the request host at the Caddy edge so the cookie host always matches AUTH_URL.

Cause: AUTH_URL=http://localhost:8080 but Caddy's loopback bind (127.0.0.1:8080) accepts any Host header. Logging in via 127.0.0.1:8080 sets a cookie scoped to 127.0.0.1; Auth.js then redirects to localhost:8080 where that cookie is not sent → /api/* returns 401 → "ghost dashboard."

Fix: Add a host matcher to the existing :8080 site block in Caddyfile that 308-redirects any non-canonical Host header to the canonical AUTH_URL host (localhost:8080). Caddy is strictly earlier than Next middleware, so no Set-Cookie can be issued on the wrong host.

Purpose: Eliminate the ghost dashboard for any combination of host the user types (127.0.0.1, LAN IP, etc.) without changing AUTH_URL — keeps the GitHub OAuth callback URL on the canonical host (333befb / 1ace7d6).

Output:
- Caddyfile gains a host-canonicalization `redir` block at the top of the `:8080` site
- docker-compose.yml caddy service gains `CANONICAL_HOST` env (derived from AUTH_URL host:port, default `localhost:8080`)
- A `docker compose restart caddy` brings the fix live (no app rebuild)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Existing Caddy + compose are the entire surface area for this change.
@Caddyfile
@docker-compose.yml

# .env AUTH_URL is the source of the canonical host — DO NOT modify it.
# Current value: AUTH_URL=http://localhost:8080  (canonical host = localhost:8080)
</context>

<interfaces>
<!-- Current :8080 site block in Caddyfile (lines 36-49) — the only block we modify. -->

```
:8080 {
    handle /ws/* {
        reverse_proxy terminal:3001
    }
    handle {
        reverse_proxy app:3000
    }
}
```

<!-- Caddy host-matcher + redir syntax (Caddy v2). Note that Caddy's named matchers
     are placed at the top of the site block; `not` inverts a matcher. The `header_regexp`
     matcher matches request headers via regex; case-insensitive flag `(?i)` covers
     "Localhost" / "LOCALHOST" oddities. -->

```
:8080 {
    @noncanonical not header_regexp Host (?i)^{env.CANONICAL_HOST}$
    redir @noncanonical http://{env.CANONICAL_HOST}{uri} 308

    handle /ws/* {
        reverse_proxy terminal:3001
    }
    handle {
        reverse_proxy app:3000
    }
}
```

<!-- docker-compose.yml caddy service environment (currently has none — only volumes,
     networks, ports). We must ADD an `environment:` key to the caddy service. -->

```yaml
caddy:
  image: caddy:2-alpine
  ...
  environment:
    # Canonical host:port for cookie/session consistency. Derived from AUTH_URL.
    # If AUTH_URL is unset, default matches the compose default (localhost:8080).
    CANONICAL_HOST: ${CANONICAL_HOST:-localhost:${CADDY_INTERNAL_PORT:-8080}}
  volumes:
    ...
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add host canonicalization to Caddyfile and wire CANONICAL_HOST env into compose caddy service</name>
  <files>Caddyfile, docker-compose.yml</files>
  <action>
Two edits, both small:

(1) **Caddyfile** — Inside the existing `:8080 {` site block (lines 37-49), add a named matcher and a `redir` directive at the TOP of the block, BEFORE the existing `handle /ws/*` and `handle` blocks. Use:

```
    # Host canonicalization — fixes auth ghost-dashboard caused by 127.0.0.1 vs localhost
    # cookie scope mismatch (RFC 6265). Any request whose Host header is not the canonical
    # AUTH_URL host is 308-redirected so the browser re-issues against the canonical host
    # BEFORE Auth.js issues any Set-Cookie. Canonical host is supplied via the
    # CANONICAL_HOST env var on the caddy service (see docker-compose.yml).
    @noncanonical not header_regexp Host (?i)^{env.CANONICAL_HOST}$
    redir @noncanonical http://{env.CANONICAL_HOST}{uri} 308
```

Place those lines as the first content inside `:8080 {` — directly above the `handle /ws/* {` block. Do NOT touch the `handle /ws/*` or `handle` blocks. Do NOT touch the global `{ ... }` block at the top of the file.

(2) **docker-compose.yml** — Add an `environment:` key to the `caddy:` service (currently the caddy service has no `environment:` block — only `image`, `container_name`, `restart`, `volumes`, `networks`, `ports`, `healthcheck`, `logging`). Insert it directly after `restart: unless-stopped` and before `volumes:`. Use this exact form so it tracks AUTH_URL's host without forcing a new required env var:

```yaml
    environment:
      # Canonical host:port for Caddy's host-canonicalization redir. Must match the
      # host portion of AUTH_URL so Auth.js cookies are scoped to the same host the
      # browser uses for /api/*. Default mirrors the compose default for AUTH_URL.
      CANONICAL_HOST: ${CANONICAL_HOST:-localhost:${CADDY_INTERNAL_PORT:-8080}}
```

Do NOT change AUTH_URL anywhere. Do NOT add CANONICAL_HOST to .env (the compose default is the source of truth unless the user overrides). Do NOT modify the `app` or `terminal` services.

After edits, validate the Caddyfile syntax inside the running container (no rebuild required):

```
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
```

Then apply the change with a restart (Caddyfile is bind-mounted read-only; restart re-reads it and picks up the new env var):

```
docker compose up -d caddy
```

(`up -d caddy` is preferred over `restart caddy` because the new `environment:` key requires a recreate, not just a restart — `restart` keeps the existing container's env.)
  </action>
  <verify>
    <automated>
# 1. Caddyfile parses cleanly inside the container
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile

# 2. Non-canonical Host (127.0.0.1:8080) is 308-redirected to canonical host
curl -sI -H 'Host: 127.0.0.1:8080' http://127.0.0.1:8080/login | tee /tmp/devdock-noncanon.txt
grep -q '^HTTP/.* 308' /tmp/devdock-noncanon.txt
grep -qi '^Location: http://localhost:8080/login' /tmp/devdock-noncanon.txt

# 3. Canonical Host (localhost:8080) is NOT redirected — passes through to app
curl -sI -H 'Host: localhost:8080' http://127.0.0.1:8080/login | tee /tmp/devdock-canon.txt
grep -q '^HTTP/.* 200\|^HTTP/.* 30[12347]' /tmp/devdock-canon.txt
! grep -qi '^Location: http://localhost:8080/login' /tmp/devdock-canon.txt

# 4. Following redirects from a non-canonical Host on /dashboard ends at a 2xx (or auth-redirect to /login)
#    on the canonical host — no infinite redirect loop, no 5xx.
curl -sIL --max-redirs 5 -H 'Host: 127.0.0.1:8080' http://127.0.0.1:8080/dashboard \
  | awk 'BEGIN{IGNORECASE=1} /^HTTP\//{code=$2} END{exit !(code ~ /^(200|30[12347])$/)}'

# 5. WebSocket path is also covered by the same site block — non-canonical /ws/* still redirects
#    (Socket.IO clients must connect using the canonical host too, otherwise cookie auth on
#    the WS handshake breaks for the same RFC 6265 reason).
curl -sI -H 'Host: 127.0.0.1:8080' http://127.0.0.1:8080/ws/socket.io/ | grep -q '^HTTP/.* 308'
    </automated>
  </verify>
  <done>
- Caddyfile has the `@noncanonical` matcher + `redir ... 308` at the top of the `:8080` block; `caddy validate` passes.
- docker-compose.yml caddy service has `environment.CANONICAL_HOST` with the `${CANONICAL_HOST:-localhost:${CADDY_INTERNAL_PORT:-8080}}` default.
- `curl -sI -H 'Host: 127.0.0.1:8080' http://127.0.0.1:8080/login` returns `308` with `Location: http://localhost:8080/login`.
- `curl -sI -H 'Host: localhost:8080' http://127.0.0.1:8080/login` returns 200/3xx (NOT a self-redirect to itself).
- `.env` AUTH_URL is unchanged.
- No app/terminal rebuild was necessary.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Browser retest — confirm ghost dashboard is gone</name>
  <what-built>
Caddy now 308-redirects any request whose Host header is not the canonical AUTH_URL host (`localhost:8080`) before reaching the Next.js app. Cookies set by Auth.js will always be scoped to the canonical host, so `/api/*` requests from the dashboard send the session cookie correctly.
  </what-built>
  <how-to-verify>
1. Open a fresh incognito window in Chrome (so no stale cookies skew the test).
2. Navigate to **http://127.0.0.1:8080/login** (deliberately the non-canonical host).
3. Confirm the URL bar bounces to **http://localhost:8080/login** automatically (the 308 from Caddy).
4. Log in with your normal admin credentials.
5. Confirm you land on **http://localhost:8080/dashboard** (still on the canonical host).
6. Open DevTools → Network → reload the page. Confirm `GET /api/environments` returns **200** (not 401), and the response includes the existing environments. This is the assertion that the ghost-dashboard is fixed.
7. Open DevTools → Application → Cookies → confirm the Auth.js session cookie is scoped to `localhost` (not `127.0.0.1`), and that no cookie is set for `127.0.0.1`.
8. (Optional) Repeat from step 2 starting at `http://127.0.0.1:8080/dashboard` directly — should redirect to `http://localhost:8080/dashboard` (and then to `/login` if not authenticated, all on the canonical host).

If anything fails (still ghost dashboard, infinite redirect, 502, WS connection broken), describe what you saw and which step.
  </how-to-verify>
  <resume-signal>Type "approved" if all 7 steps pass. Otherwise describe which step failed and what you saw (URL, status code, console error).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → Caddy (loopback :8080) | First hop where Host header is attacker-controllable; canonicalization happens here |
| Caddy → app:3000 | Compose-internal; Host header is whatever Caddy forwarded (now always canonical) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-260501-ihv-01 | Spoofing | Caddyfile `@noncanonical` matcher | mitigate | `header_regexp Host (?i)^{env.CANONICAL_HOST}$` is anchored (`^...$`) and case-insensitive — prevents `localhost:8080.attacker.tld` or `LOCALHOST:8080` from bypassing the canonicalization |
| T-quick-260501-ihv-02 | Tampering | Open redirect via Host header | accept | Redirect target is hardcoded to `http://{env.CANONICAL_HOST}` (env-supplied at container start, not request-controlled). User-controlled Host header CANNOT influence the Location value. |
| T-quick-260501-ihv-03 | Information Disclosure | Session cookie scope | mitigate | This change is itself the mitigation — cookie is now always scoped to the canonical host, eliminating the 127.0.0.1-vs-localhost split-cookie information leak (cookies set on the wrong host can be read by any other service the user binds to that same host:port) |
| T-quick-260501-ihv-04 | Denial of Service | Redirect loop | mitigate | Verification step 3 (`curl -sI -H 'Host: localhost:8080' ...` returns 200/3xx, NOT a self-redirect) explicitly proves the canonical host does not match `@noncanonical` and is served directly. Anchored regex (`^...$`) ensures no off-by-one Host parsing causes loops. |
</threat_model>

<verification>
- `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile` exits 0.
- All 5 automated curl checks in Task 1's `<automated>` block pass.
- Task 2 human-verify checkpoint returns "approved" with `/api/environments` returning 200 in the browser and the session cookie scoped to `localhost`.
</verification>

<success_criteria>
- A login attempt that starts at `http://127.0.0.1:8080/login` ends with the user successfully on `http://localhost:8080/dashboard` with `/api/*` returning data (no 401 ghost dashboard).
- A login attempt that starts at `http://localhost:8080/login` continues to work exactly as before (no regression).
- WebSocket terminal connections, when opened from the canonical host, still work (no regression on `/ws/*`).
- AUTH_URL in `.env` is unchanged; the GitHub OAuth callback URL pinned in 333befb / 1ace7d6 still matches the canonical host.
- Only `Caddyfile` and `docker-compose.yml` were modified; only the `caddy` service was recreated.
</success_criteria>

<output>
After completion, create `.planning/quick/260501-ihv-fix-auth-host-mismatch-ghost-dashboard-c/260501-ihv-SUMMARY.md`
</output>
