---
status: resolved
trigger: "preview proxy broken scripts — HTML loads but all JS/CSS assets fail because browser resolves root-relative paths against DevDock host"
created: 2026-04-14T00:00:00Z
updated: 2026-04-16T00:00:00Z
resolution_commit: 785ef04
---

**Resolution (2026-04-16):** Superseded by the architecture change in phase 06-06.
The path-based proxy at `/api/environments/{id}/preview/[[...path]]/` was removed
(commit `785ef04`) and replaced with a subdomain proxy at `{envId}.{PREVIEW_DOMAIN}`
(commits `a5b5aaf`, `c675fd3`). Subdomain routing preserves root-relative asset
paths natively, so no HTML rewriting is needed. This debug note is kept for
history.

---

## Current Focus

hypothesis: The proxy forwards the container's HTML verbatim. Root-relative asset paths (e.g. `/_next/static/...`) in that HTML resolve against the DevDock origin, not the proxy base path. The fix is to rewrite root-relative paths in HTML responses before returning them to the browser.
test: Read route.ts, confirm no HTML rewriting exists, then apply targeted rewrite.
expecting: After fix, browser asset requests will hit `/api/environments/{id}/preview/_next/...` which the catch-all proxy handles correctly.
next_action: Await human verification that assets load correctly through the proxy


## Symptoms

expected: Preview proxy renders full containerized Next.js app with all assets loading
actual: HTML loads (200) but all script/font assets fail — browser console shows ~20 errors pointing at `http://localhost:3000/_next/static/chunks/...`
errors: Scripts point to `http://localhost:3000/_next/static/...` (DevDock's own Next.js), not through the proxy
reproduction: Create env with preview_port=3000, start env, run `npm run dev` inside container, click preview → HTML loads but UI broken
started: Always — fundamental issue with path-based reverse proxying of SPAs/SSR apps

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-14T00:00:00Z
  checked: src/app/api/environments/[id]/preview/[[...path]]/route.ts
  found: Line 90 — upstream response body is forwarded verbatim with no HTML rewriting. No content-type check, no path substitution.
  implication: Root-relative paths in HTML responses are never adjusted → browser resolves them against DevDock origin

## Resolution

root_cause: The preview proxy at route.ts forwards HTML responses from the container verbatim. The container's Next.js app emits root-relative asset URLs (e.g. `/_next/static/...`, `/_next/image?...`, font paths). The browser resolves these against the DevDock host origin, so asset requests never reach the container proxy path. The `[[...path]]` catch-all WOULD handle these assets if the browser requested `/api/environments/{id}/preview/_next/...`, but the unmodified HTML sends it to `/_next/...` instead.
fix: For text/html responses, rewrite all root-relative paths to be proxy-relative before streaming to the browser. Replace `"/_next/` and `'/_next/` and `/fonts/` (and any other root-absolute static paths) with the proxy base path prefix. Only mutate text/html content-type; all other response types pass through unchanged.
verification: (pending)
files_changed: []
