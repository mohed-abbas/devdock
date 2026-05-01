---
slug: app-missing-cli-binaries
status: resolved
trigger: "DevDock app container launches fail with `spawn git ENOENT` and `spawn docker ENOENT`; CLI binaries the runtime shells out to are not installed in the app-runner Docker stage. Discovered during Claude-in-Chrome E2E test of the launch flow on 2026-05-01."
created: 2026-05-01T10:49:56Z
updated: 2026-05-01T11:01:47Z
goal: find_and_fix
related_phase: 999.2-devdock-self-containerization
diagnose_only: false
---

# Debug Session: app-missing-cli-binaries

## Symptoms

- **Expected:** Creating an environment from a GitHub repo via the dashboard should run `git clone` then `docker compose up -d` inside the `devdock-app` container, leaving the new env in `running` status with a working terminal.
- **Actual:** Every create/start attempt lands the env row in `status: error`. Two distinct error messages observed in `environments.errorMessage`:
  - `"Clone failed: spawn git ENOENT"` (fresh env "portfolio-test", created 2026-05-01T10:45:02Z)
  - `"spawn docker ENOENT"` (older env "ttttt", created 2026-05-01T10:25:44Z — passed clone, died at compose stage)
- **Errors:** `ENOENT` from Node `child_process.execFile` — there is no `git` or `docker` binary on PATH in the running `devdock-app` container.
- **Timeline:** Regression introduced (or never closed) in Phase 999.2 self-containerization. Earlier, host-side execution of `docker compose` worked because the host has both binaries. Once the orchestration code started running *inside* the app container, those calls have nothing to invoke.
- **Reproduction (one-line):**
  ```
  docker exec devdock-app sh -c 'which git docker docker-compose'
  ```
  All three return empty. `ls /usr/bin/docker* /usr/bin/git` → `No such file or directory`.

## Initial Evidence

- `Dockerfile:42-60` (`AS app-runner`) installs only `gosu` (line 55). No `git`, no `docker-cli`, no compose plugin.
- `src/lib/docker/docker-service.ts`:
  - line 26 — `execFile('docker', ['compose', '-p', ..., '-f', ..., 'up', '-d'])`
  - line 46 — `execFile('docker', ['compose', '-p', ..., '-f', ..., 'stop'])`
  - line 68 — `execFile('docker', ['compose', '-p', ..., '-f', ..., 'down', '-v', '--remove-orphans'])`
  - line 166 — `execFile('git', ['clone', ...])`
- `/var/run/docker.sock` IS mounted into the container (`srw-rw---- root root`), so adding the docker CLI alone (no daemon) is sufficient — the socket talks to the host daemon.
- The terminal-runner stage (`Dockerfile:102+`) also copies `src/lib/docker` (line 119) — it likely needs the same binaries if it shells out, but that hasn't been verified yet.

## Current Focus

```yaml
hypothesis: "The app-runner stage is missing the `git` and `docker` (CLI + compose plugin) binaries. Adding them to that stage's apt install (and confirming whether terminal-runner needs the same) restores the launch flow without any code changes."
test: "After Dockerfile patch, rebuild devdock-app, retry env create — clone + compose up should succeed; new env row should reach status=running."
expecting: "`docker exec devdock-app which git docker docker compose` all resolve. Subsequent dashboard 'New Environment' run leaves status=running and yields a working terminal."
next_action: "(complete) audit done; binaries added to deps stage (dev override target) AND app-runner stage (prod target); rebuild + restart verified."
reasoning_checkpoint: "Hypothesis CONFIRMED. Grep of src/ for execFile/spawn yielded only docker-service.ts (lines 26/46/68/166). Terminal-runner uses dockerode only (server/terminal-server.ts imports just createExecSession + resizeExec, both pure dockerode), so it does NOT need git/docker CLI. Critical discovery during fix: docker-compose.override.yml line 11 sets `target: deps`, so dev mode runs out of the deps stage — patching only app-runner is not enough; deps stage needed the same install. Also discovered deps stage was missing `wget` (used by compose healthcheck), causing the post-rebuild container to flap unhealthy; added wget too in the same Dockerfile commit."
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-05-01T10:45Z — `POST /api/environments` returned 202; `GET /api/environments` showed new row `portfolio-test` with `status: error, errorMessage: "Clone failed: spawn git ENOENT"`.
- timestamp: 2026-05-01T10:33Z — `POST /api/environments/{id}/start` on env `ttttt` returned 202; row updated to `status: error, errorMessage: "spawn docker ENOENT"`.
- timestamp: 2026-05-01T10:48Z — `docker exec devdock-app which git docker docker-compose` → empty output for all three.
- timestamp: 2026-05-01T10:48Z — `Dockerfile:54-56` confirmed: only `gosu` in app-runner apt install.
- timestamp: 2026-05-01T10:55Z — Audit complete: `grep -rn execFile src/` outside tests returns only `src/lib/docker/docker-service.ts` (4 callsites). `server/terminal-server.ts` imports only `createExecSession` + `resizeExec` (dockerode-based) → terminal-runner needs NO CLI binaries.
- timestamp: 2026-05-01T10:56Z — Gap matrix in running containers: `devdock-app` missing `git`, `docker`, `docker compose`. `devdock-terminal` missing same — but does not use them. Only app needs the patch.
- timestamp: 2026-05-01T10:57Z — Initial patch added install ONLY to `app-runner` stage. Rebuild produced new image, but binaries still absent. Root cause: `docker-compose.override.yml:11` overrides `target: deps` in dev — dev mode runs out of deps stage, not app-runner.
- timestamp: 2026-05-01T10:58Z — Patched deps stage: added `git` to apt install, plus `COPY --from=docker:28-cli` for docker CLI + compose plugin (`/usr/local/libexec/docker/cli-plugins/docker-compose`). Rebuild + recreate.
- timestamp: 2026-05-01T10:59Z — devdock-app went unhealthy: healthcheck `wget -qO- http://localhost:3000/api/health` failed because deps stage lacked wget. Added `wget` to deps apt install. Rebuild + recreate.
- timestamp: 2026-05-01T11:00Z — devdock-app healthy. `docker exec devdock-app sh -lc 'which git docker wget && docker compose version'`:
  ```
  /usr/bin/git
  /usr/local/bin/docker
  /usr/bin/wget
  Docker Compose version v2.40.3
  ```
- timestamp: 2026-05-01T11:01Z — End-to-end probe: `docker exec devdock-app git clone --depth=1 https://github.com/octocat/Hello-World.git /tmp/gitprobe` succeeded. `docker exec devdock-app docker info` reaches host daemon (server 29.4.0). Both original ENOENT failures are resolved at the binary level.

## Eliminated

- Terminal-runner stage needing the same patch — confirmed unaffected. server/terminal-server.ts imports only dockerode-based exec helpers.
- apt repo (download.docker.com) install path — rejected in favor of `COPY --from=docker:28-cli` (smaller, no repo+key wiring, ships compose plugin in canonical `/usr/local/libexec/docker/cli-plugins/`).
- `apt install docker.io` from Debian repos — rejected (older, compose-v2 plugin support inconsistent).

## Side Issues (capture, do NOT debug here)

- **Auth host-mismatch / "ghost dashboard"**: With `AUTH_URL=http://localhost:8080`, logging in via `http://127.0.0.1:8080` sets the session cookie on host `127.0.0.1`. The post-login redirect goes to `localhost:8080`, where that cookie is not sent. The dashboard page renders (server has no required-auth gate on `/dashboard`?), but every API call returns 401 and `document.cookie` is empty. Symptom: looks logged in, nothing works. **Track separately** — likely a `/gsd-quick` for adding a host-canonicalization redirect or removing 127.0.0.1 from Caddy. Do not mix into this session.
  - **RESOLVED:** quick task 260501-ihv (commit `0641e0a`) added a Caddyfile host-canonicalization redirect on the `:8080` site block — any non-canonical Host header is 308'd to `{$CANONICAL_HOST}` (default `localhost:8080`) before Auth.js sees the request. Summary: `.planning/quick/260501-ihv-fix-auth-host-mismatch-ghost-dashboard-c/260501-ihv-SUMMARY.md`.

- **NEW (2026-05-01T11:01Z): shadcn/tailwind.css module-not-found in dev** — After the rebuild, `GET http://localhost:8080/` returns 500 with: `Module not found: Can't resolve 'shadcn/tailwind.css'` (imported from `src/app/globals.css:3`). The package IS installed in the container (`/app/node_modules/shadcn/dist/tailwind.css` exists) and `package.json` exports `./tailwind.css` via the `style` condition. Looks like a Turbopack export-condition resolution issue, surfaced (not caused) by the container recreate clearing dev-server caches. Unrelated to ENOENT root cause. Track separately — likely `/gsd-quick` to either pin a different shadcn version, replace the import with a relative path to `node_modules/shadcn/dist/tailwind.css`, or configure Turbopack/Next to honor the `style` export condition. **Will block end-to-end retest of the env launch flow until fixed.**

## Resolution

**Root cause:** The app container's runtime stages (both `deps` — used by dev override — and `app-runner` — used by prod) lacked the external CLIs that `src/lib/docker/docker-service.ts` shells out to. Specifically: `git` (line 166) and `docker` with the Compose v2 plugin (lines 26, 46, 68). The dockerode socket-API path was fine, but four `execFile()` callsites had no binary to invoke. Compounding factor: dev mode rebuilds out of the `deps` stage (per `docker-compose.override.yml:11`), so a patch limited to `app-runner` would have left dev broken.

**Fix:** Single Dockerfile patch (no application code changes):

1. **`deps` stage** (dev runtime via override) — added `git` and `wget` to the apt install, and added `COPY --from=docker:28-cli` for the docker CLI + compose plugin into `/usr/local/bin/docker` and `/usr/local/libexec/docker/cli-plugins/docker-compose`.
2. **`app-runner` stage** (prod runtime) — same additions: `git` to apt install, `COPY --from=docker:28-cli` for CLI + plugin.
3. Terminal-runner stage left untouched (verified it does not shell out to either binary).

**Install method rationale:** Multi-stage `COPY --from=docker:28-cli` chosen over the apt repo (download.docker.com) and `apt install docker.io`. The COPY approach is ~30MB smaller, requires no repo+key plumbing, and lands the compose plugin at the canonical CLI-plugin path so `docker compose ...` (subcommand form, which is what `docker-service.ts` invokes) auto-discovers it. The host daemon (Server 29.4.0) is unaffected — only the client lives in our image; the socket mount in `docker-compose.yml` connects them.

**Verification:**
- `docker compose build app` succeeded.
- `docker compose up -d app` → container healthy.
- `docker exec devdock-app which git docker wget` → all resolve.
- `docker exec devdock-app docker compose version` → v2.40.3.
- `docker exec devdock-app git clone --depth=1 ...` → succeeds.
- `docker exec devdock-app docker info` → reaches host daemon.

**Outstanding for retest from browser:** A separate, pre-existing dev-mode Turbopack regression (`Module not found: Can't resolve 'shadcn/tailwind.css'`) currently returns 500 from the dashboard. That blocks the user's "create new environment" flow in Claude-in-Chrome. Captured as a side issue above for a follow-up `/gsd-quick`. The original `spawn git ENOENT` / `spawn docker ENOENT` failures are conclusively resolved at the binary level.

**Files changed:**
- `Dockerfile` (deps stage + app-runner stage)
