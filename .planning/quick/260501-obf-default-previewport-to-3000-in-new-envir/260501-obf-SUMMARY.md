---
phase: 260501-obf
plan: 01
subsystem: dashboard-ui
tags: [environments, preview-port, ux, defaults]
status: complete
dependency_graph:
  requires: []
  provides: [usable-preview-default-on-fresh-envs]
  affects: [create-environment-flow, preview-button-visibility, preview-proxy-route]
tech_stack:
  added: []
  patterns: [default-state-over-empty-state]
key_files:
  created: []
  modified:
    - src/app/dashboard/_components/create-environment-dialog.tsx
decisions:
  - Default value "3000" beats placeholder-only — dev servers (Next/Vite/CRA/Storybook) all default to 3000, so pre-filling matches the modal case and lets users clear when they have a different stack
  - Did NOT backfill existing envs (portfolio-test, portfolio-retest, ttttt) — they were created without a port deliberately or by accident, and the Edit Environment dialog already lets the user set it. A SQL migration would change behavior for envs the user explicitly chose not to set
  - Did NOT touch the Edit Environment dialog — it correctly defaults to whatever the env was created with; defaulting to 3000 there would mask user intent on existing envs
  - Did NOT change the API zod schema — already accepts `optional()`, behavior is purely client-side
metrics:
  duration: ~6min
  completed: 2026-05-01
---

# Quick Task 260501-obf: Default previewPort to 3000 in New Environment dialog

**One-liner:** Changed the Preview Port input's initial state from `''` to `'3000'` so newly created envs come with a working preview port out of the box, restoring the Preview button on the env card and unblocking the preview proxy route.

## What Was Done

The New Environment dialog had a Preview Port field with placeholder `"3000"` but a blank value. Most users (myself included) ignored the optional field, which left `previewPort: null` on the env row. Two downstream gates fired off that null:

- `src/app/api/preview/[[...path]]/route.ts:59` short-circuits to 404 when `!env.previewPort`
- `src/app/dashboard/_components/environment-card.tsx:111` hides the Preview button when `previewPort === null`

Result: Preview was effectively dead for envs created via the dashboard. Three lines of change to make it work by default.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pre-fill Preview Port + tighten helper text | 8ad9a7a | src/app/dashboard/_components/create-environment-dialog.tsx |

Three edits in one file:
- Line 38 — `useState<string>('')` → `useState<string>('3000')` (initial state)
- Line 51 — `setPreviewPort('')` → `setPreviewPort('3000')` (resetForm restores default)
- Line 257 — helper text updated: "Port your dev server listens on inside the container (defaults to 3000 — clear if not needed)"

## Deviations from Plan

None.

## Verification (Claude-in-Chrome)

- Opened New Environment dialog → Preview Port input shows `value="3000"` (was empty before)
- Helper text shows the new copy verbatim
- Typed `8080` into the field, pressed Escape (closes dialog), reopened — input is back to `3000` (resetForm path verified)
- API contract confirmed via existing route handlers — no changes to validation or persistence

## Known Stubs

None.

## Threat Flags

None — purely a client-side UX default. No new network surface, no permission changes, no user input crossing a trust boundary differently than before. The same zod schema that always validated this field still validates it; pre-filling with `"3000"` just removes a footgun where users accidentally created unusable envs.

## Out of Scope (captured for follow-up)

- **Existing envs (portfolio-test, portfolio-retest, ttttt) still have `previewPort: null`.** They were created before this fix. Users can update each via the Edit Environment dialog (which already supports the field). No migration was applied — that would change behavior for envs the user may have deliberately left unset.
- **Auto-detecting the actual listening port** (e.g. via `dockerode containerStats` + port-watching) is the next-level fix but a much larger scope. Default-to-3000 covers ~90% of cases.
- **The portfolio repo's `next.config.ts` has `output: 'export'`** which causes `next dev` to silently exit in Next.js 16. That's a portfolio-side concern, not a DevDock issue. Captured here only because it surfaced during the same browsing session.

## Self-Check: PASSED

- [x] `create-environment-dialog.tsx:38` reads `useState<string>('3000')`
- [x] `create-environment-dialog.tsx:51` reads `setPreviewPort('3000')`
- [x] Helper text mentions "defaults to 3000"
- [x] Browser verification: dialog opens with value "3000"
- [x] Browser verification: resetForm restores "3000" after close+reopen
- [x] Commit 8ad9a7a exists on `phase-999.2.2-fix-compose-mounts-and-terminal-env`
- [x] No API/schema changes needed
