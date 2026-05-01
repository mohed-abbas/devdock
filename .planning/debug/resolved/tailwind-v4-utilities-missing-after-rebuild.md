---
slug: tailwind-v4-utilities-missing-after-rebuild
status: resolved
trigger: "Tailwind v4 utility classes intermittently fail to generate after `docker compose build app && docker compose up -d app` rebuilds. Initial state: dashboard fully styled (dark theme, Inter font). After rebuild: completely unstyled (Times font, white background, no utilities). Has now happened twice in one session, both times after container rebuild. Earlier prior 'fix' (260501-ia1) only addressed the @import resolution, not utility generation."
created: 2026-05-01T14:35:00Z
updated: 2026-05-01T15:30:00Z
goal: find_and_fix
related_phase: dev-tooling
diagnose_only: false
---

# Debug Session: tailwind-v4-utilities-missing-after-rebuild

## Symptoms

- **Expected:** After `docker compose build app && docker compose up -d app`, navigating to `http://localhost:8080/dashboard` should render the styled dashboard (dark theme, Inter font, rounded buttons, modal styling).
- **Actual:** Dashboard renders with NO Tailwind utility classes applied — Times font, white background, default browser styling. Backend data renders correctly in HTML, but no styling. The terminal page (xterm itself) renders with its own bundled CSS, but the page chrome around it is also unstyled.
- **Errors:** No JS console errors. No build errors in dev-server logs. Tailwind silently produces a CSS chunk with only base reset and zero utility class definitions.
- **Timeline:** Has occurred twice in this session, both immediately after `docker compose up -d app` recreated the container. Originally surfaced as a 500 (Module not found: shadcn/tailwind.css) — that resolution issue was patched via `next.config.ts` `turbopack.resolveAlias` in quick task 260501-ia1. After that patch, the @import resolves but utility generation is unreliable on first compile.

## Evidence

- timestamp: 2026-05-01T15:00:00Z
  source: CSS chunk inspection (cold start)
  content: >
    CSS chunk [root-of-the-server]__*.css contains @tailwind utilities; as RAW
    unexpanded text. @apply directives in @layer base also stay raw. Zero utility
    selectors (only 3 dot-lines: .inter_*__className, .inter_*__variable, .dark).
    Total lines ~1026. This is the broken state on cold start.

- timestamp: 2026-05-01T15:05:00Z
  source: Container filesystem inspection
  content: >
    `docker exec devdock-app find / -name "postcss.config.*"` returns NOTHING.
    postcss.config.mjs is completely absent from the container. The deps-stage
    Dockerfile only runs `COPY package.json package-lock.json ./` + `npm ci`.
    It does NOT run `COPY . .` (that only happens in the builder stage).
    docker-compose.override.yml bind-mounts: src/, server/, public/,
    next.config.ts, tsconfig.json, package.json, drizzle.config.ts, middleware.ts —
    but NOT postcss.config.mjs.

- timestamp: 2026-05-01T15:06:00Z
  source: Root cause analysis
  content: >
    Without postcss.config.mjs present, Turbopack has no PostCSS config to load.
    It silently falls back to plain CSS bundling: all CSS @imports are resolved
    and concatenated, but @tailwind utilities, @apply, @theme, and @source directives
    pass through as raw text without any Tailwind processing. The @tailwindcss/postcss
    plugin is never invoked.

- timestamp: 2026-05-01T15:25:00Z
  source: Fix verification (cold start)
  content: >
    After adding `./postcss.config.mjs:/app/postcss.config.mjs` to
    docker-compose.override.yml volumes and force-recreating the container:
    CSS chunk [root-of-the-server]__048517db._.css has 4503 lines (vs 1026 broken).
    659 utility-like CSS lines. .bg-card { background-color: var(--card) } present.
    --card resolves to #fff (lab(100% 0 0) for wide-gamut). font-family: Inter present.
    @apply and @tailwind utilities are fully expanded — NO raw directives in output.
    Cold compile of /dashboard: 2.1s. This is a completely clean container with fresh
    anonymous .next volume, confirming the fix is deterministic on cold start.

## Eliminated

- Hypothesis: Tailwind v4 content scanner returns 0 candidates on cold start.
  Eliminated: Scanner tested directly in container returns 2477 candidates from /app.
  
- Hypothesis: Turbopack pre-resolves @import before PostCSS, stripping @tailwind utilities.
  Eliminated: CSS chunk shows @tailwind utilities as raw text when postcss.config.mjs
  is absent — not a pre-resolution issue, a no-PostCSS-at-all issue.

- Hypothesis: @source directive needed for cold-start scanning.
  Eliminated: @source appeared raw in chunk (not processed) when postcss.config.mjs
  was absent, confirming PostCSS was the missing piece.

## Side Issues (capture, do NOT debug here)

- `middleware.ts` is incorrectly mounted as a DIRECTORY (drwxr-xr-x 2) in the container
  instead of as a file. This is visible from `docker exec devdock-app ls -la /app/`.
  Low priority — middleware functionality works despite the wrong mount type.

## Resolution

```yaml
root_cause: >
  postcss.config.mjs is absent from the dev container. The Dockerfile's deps stage
  only copies package.json + package-lock.json (for npm ci), not the full project.
  docker-compose.override.yml bind-mounts 8 specific files but omits postcss.config.mjs.
  Without it, Turbopack has no PostCSS config, falls back to plain CSS bundling, and
  all Tailwind v4 directives (@tailwind utilities, @apply, @source) pass through as raw
  text — producing a CSS chunk with zero utility classes.

fix: >
  Added `./postcss.config.mjs:/app/postcss.config.mjs` to the app service volumes in
  docker-compose.override.yml. With the file present, Turbopack discovers it on startup,
  invokes @tailwindcss/postcss for every CSS file, and @tailwind utilities is expanded
  to the full utility class set. Cold start now produces 4503 lines in the CSS chunk
  with 659 utility-like CSS rules, .bg-card resolves to lab(100%) white, Inter font loads.
  globals.css restored to original @import "tailwindcss" — the split-import approach
  added during investigation was unnecessary and reverted.

files_modified:
  - docker-compose.override.yml (added postcss.config.mjs bind-mount)
  - src/app/globals.css (restored to original @import "tailwindcss")

verification:
  - Container force-recreated (fresh anonymous .next volume)
  - /dashboard compiled cold (2.1s, no Fast Refresh triggered)
  - CSS chunk: 4503 lines, 659 utility-like rules
  - .bg-card present: background-color: var(--card)
  - --card: lab(100% 0 0) (not transparent)
  - font-family: Inter present
  - No raw @apply or @tailwind directives in output
```
