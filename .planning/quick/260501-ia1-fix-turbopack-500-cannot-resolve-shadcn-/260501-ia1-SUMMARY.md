---
phase: 260501-ia1
plan: 01
subsystem: dev-tooling/next-config
tags: [turbopack, shadcn, tailwind, css-resolver, dev-server, quick-task]
requires:
  - node_modules/shadcn/dist/tailwind.css (already installed)
  - node_modules/tw-animate-css/dist/tw-animate.css (already installed)
provides:
  - Turbopack CSS @import resolution for bare-specifier CSS modules whose
    package.json gates files behind the `style` export condition
affects:
  - src/app/globals.css (consumer; unchanged but now resolves cleanly)
  - app dev container CSS pipeline at boot
tech-stack-added: []
patterns:
  - "next.config.ts → turbopack.resolveAlias for `style`-conditioned CSS exports"
key-files:
  modified:
    - next.config.ts
  created: []
  unchanged-by-design:
    - src/app/globals.css
    - node_modules/shadcn/package.json
    - node_modules/tw-animate-css/package.json
decisions:
  - "Use Turbopack resolveAlias instead of editing globals.css or patching upstream package.json"
  - "Alias paths are project-root-relative (./node_modules/...) so they resolve identically inside the /app working dir of the dev container"
  - "Extended the alias pattern to tw-animate-css (Rule 3 deviation) — same root cause surfaced one CSS import earlier, blocking the plan's truth: 'homepage returns 200'"
metrics:
  duration_minutes: ~6
  tasks_completed: 2
  tasks_total: 3
  checkpoint_pending: 1
  files_modified: 1
  commits: 2
completed: 2026-05-01
---

# Quick Task 260501-ia1: Fix Turbopack 500 — Cannot Resolve shadcn/tailwind.css

Map `shadcn/tailwind.css` (and, per deviation, `tw-animate-css`) through `turbopack.resolveAlias` so Turbopack's CSS `@import` resolver finds the underlying files that upstream package.json files only expose via the `style` export condition.

## Root Cause

Both `shadcn` and `tw-animate-css` ship with package.json `exports` maps that gate their CSS files behind the `style` export condition:

```jsonc
// node_modules/shadcn/package.json (paraphrased)
"exports": { "./tailwind.css": { "style": "./dist/tailwind.css" } }

// node_modules/tw-animate-css/package.json
"exports": { ".": { "style": "./dist/tw-animate.css" } }
```

Turbopack's CSS `@import` resolver does **not** pass the `style` condition when resolving bare specifiers in CSS files. With Webpack/PostCSS the older bare-specifier resolution rules tolerated this; with Turbopack it fails with `Module not found: Can't resolve 'shadcn/tailwind.css'` and a 500 on every page that pulls `globals.css`.

This is upstream behavior in Turbopack's CSS handler, not something to "fix" in the source CSS or the third-party package.

## Fix

Add a `turbopack.resolveAlias` block to `next.config.ts` that maps each bare specifier directly to the on-disk file, bypassing the export-conditions resolver entirely:

```typescript
// next.config.ts (final)
turbopack: {
  resolveAlias: {
    'shadcn/tailwind.css': './node_modules/shadcn/dist/tailwind.css',
    'tw-animate-css': './node_modules/tw-animate-css/dist/tw-animate.css',
  },
},
```

`globals.css` is **unchanged** — the bare specifiers are kept as-is and the alias does the resolution.

## Tasks Executed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add Turbopack `resolveAlias` for `shadcn/tailwind.css` | `d67f618` | next.config.ts |
| 2 | Restart dev container; auto-fixed `tw-animate-css` resolution (Rule 3) | `af6d8fb` | next.config.ts |
| 3 | Browser human-verify | **PENDING** | (no code changes) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Same export-condition failure on `tw-animate-css`**

- **Found during:** Task 2 (post-restart verification of the shadcn fix).
- **Issue:** After fixing `shadcn/tailwind.css`, Turbopack moved on to the *previous* line of `globals.css` and emitted `Module not found: Can't resolve 'tw-animate-css'`. Homepage continued to return 500. The plan's stated truth ("homepage returns 200, login renders with 'Username'") could not be satisfied by the shadcn alias alone.
- **Root cause:** Identical — `tw-animate-css` exports its CSS via the `style` condition only.
- **Fix:** Add a second `resolveAlias` entry: `'tw-animate-css': './node_modules/tw-animate-css/dist/tw-animate.css'`.
- **Files modified:** `next.config.ts`
- **Commit:** `af6d8fb`
- **Why Rule 3 (not Rule 4):** No architectural change — same one-line alias pattern the plan already prescribes, applied to the next entry in the same `globals.css` import list. Extending the pattern is the obvious continuation; alternative ("ask the user") would have left the dev server broken for an hour.

## Verification Results

After both aliases were added and the app container restarted:

| Check | Command | Expected | Actual |
|-------|---------|----------|--------|
| Raw homepage | `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` | 200 / 307 / 302 | **307** |
| Followed homepage | `curl -sL -o /dev/null -w "%{http_code}" http://localhost:8080/` | 200 | **200** |
| Login page rendered | `curl -sL http://localhost:8080/login \| grep -c "Username"` | ≥ 1 | **1** |
| No shadcn resolve error (post-restart logs) | `docker compose logs --since 30s app \| grep "Can't resolve 'shadcn/tailwind.css'"` | empty | **empty** |
| No tw-animate resolve error (post-restart logs) | `docker compose logs --since 30s app \| grep "Can't resolve 'tw-animate-css'"` | empty | **empty** |

> Note on the plan's verify command: the plan greps `--tail=200` which can include errors from BEFORE the restart. Scoping with `--since 30s` (after the second restart) yields the correct behavior. Recent log tail shows clean `200` and `307` responses across `/`, `/login`, `/api/environments`, `/api/auth/session`, `/api/health`, `/api/github/connection`, `/api/production-apps`, `/dashboard`.

## Pending — Browser Human-Verify

The plan's Task 3 is `checkpoint:human-verify` and is intentionally **not executed** by the executor. **Ready for browser retest:**

1. Open http://localhost:8080/ in a browser.
2. Confirm the redirect to `/login` and that the **Username** field is rendered with full Tailwind + shadcn styling (NOT raw unstyled HTML).
3. Open DevTools → Network, hard reload, confirm no 500s and no console errors mentioning `shadcn/tailwind.css` or `tw-animate-css`.
4. Optionally log in and confirm the dashboard renders styled.

Resume signal: type "approved" in chat if the page renders styled, or describe any visual issue.

## Carried-Along Working-Tree Changes (Not Committed by This Task)

Per task constraints, the following uncommitted working-tree change from a prior debug session is intentionally **left untouched**:

- `Dockerfile` — adds `git`/`docker` CLI to the deps + app-runner stages (debug session, correct, awaits separate commit).

It was NOT included in either of this task's commits (`d67f618`, `af6d8fb`). Both commits scoped to `git add next.config.ts` only. `git status` post-execution still shows `M Dockerfile` for traceability.

## Self-Check: PASSED

- Created files: `.planning/quick/260501-ia1-fix-turbopack-500-cannot-resolve-shadcn-/260501-ia1-SUMMARY.md` — FOUND
- Modified files: `next.config.ts` — FOUND, contains both `resolveAlias` entries
- Commits: `d67f618` — FOUND in `git log`; `af6d8fb` — FOUND in `git log`
- Dockerfile preservation: working tree still shows `M Dockerfile` — confirmed not committed
- All "must_haves.truths" from PLAN frontmatter satisfied (HTTP 200, no module-not-found, login renders Username)
