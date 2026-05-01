---
phase: 260501-ogb
plan: 01
subsystem: dashboard-ui
tags: [environments, preview-port, ux, defaults, edit-dialog]
status: complete
dependency_graph:
  requires: [260501-obf]
  provides: [one-click-preview-port-upgrade-for-existing-envs]
  affects: [edit-environment-flow, preview-button-visibility]
tech_stack:
  added: []
  patterns: [conditional-default-on-null, conditional-helper-text]
key_files:
  created: []
  modified:
    - src/app/dashboard/_components/edit-environment-dialog.tsx
decisions:
  - Pre-fill 3000 ONLY when env.previewPort is null — leave already-set values alone so no regression for users who deliberately picked a different port
  - Use conditional helper text instead of a separate "set default" button — keeps the UI single-control and lets the user simply click Save to accept, or clear/change before saving
  - Did NOT auto-migrate null-previewPort envs in the DB — the user's intent on those rows is unknown, and the Edit dialog now surfaces the upgrade in one click anyway
metrics:
  duration: ~5min
  completed: 2026-05-01
---

# Quick Task 260501-ogb: Default Edit Environment previewPort to 3000 when unset

**One-liner:** Companion to 260501-obf. When an existing env has no preview port set, the Edit Environment dialog now pre-fills "3000" and explains the unset state in helper text — so upgrading legacy envs is one Save click.

## What Was Done

Two narrow edits to `src/app/dashboard/_components/edit-environment-dialog.tsx`:

1. **Default proposal when null** (lines 35 and 42): replaced `?? ''` with `?? '3000'` in both the `useState` initializer and the open-effect resync. When `environment.previewPort` is null, the input opens with "3000" pre-filled.

2. **Conditional helper text** (line 154-157): when `environment.previewPort === null`, helper reads "Currently unset. Defaulting to 3000 — clear to keep unset, or change to your dev server's port." When already set, the original copy "Port your app listens on inside the container." is preserved.

Save semantics unchanged — clicking Save persists whatever's in the input (3000 by default, or whatever the user typed), clearing the input and Saving keeps the env at null.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pre-fill Edit dialog with 3000 when env.previewPort is null + conditional helper text | fb9fdbb | src/app/dashboard/_components/edit-environment-dialog.tsx |

## Deviations from Plan

None.

## Verification (Claude-in-Chrome)

- Dashboard `/api/environments` snapshot at start: portfolio-retest = null, portfolio-test = null, ttttt = 3001
- Opened Edit on `portfolio-retest` (previewPort=null):
  - Input value: `"3000"` ✓
  - Helper text: "Currently unset. Defaulting to 3000 — clear to keep unset, or change to your dev server's port." ✓
  - Cancelled (did not Save) to avoid restarting the env
- `ttttt` (previewPort=3001) test was deferred — the env entered STOPPING state mid-test and the parent gates the Edit button on `isTransitioning`. The set-value no-regression case is trivially verified by code: `environment.previewPort?.toString() ?? '3000'` returns `"3001"` when the value is `3001`; the `??` fallback only fires for null/undefined.

## Known Stubs

None.

## Threat Flags

None — purely client-side default-state behavior. No changes to the API, validation, or persistence path. The same zod schema in `src/app/api/environments/[id]/route.ts:14` validates the PATCH body as before.

## Self-Check: PASSED

- [x] `edit-environment-dialog.tsx:35` reads `environment.previewPort?.toString() ?? '3000'`
- [x] `edit-environment-dialog.tsx:42` reads `environment.previewPort?.toString() ?? '3000'`
- [x] Helper text is conditional on `environment.previewPort === null`
- [x] Browser verification: Edit on null-port env shows "3000" pre-filled with the unset-state copy
- [x] Code review: set-port envs show their existing value (the `??` does not fire when `.toString()` returns a string)
- [x] Commit fb9fdbb exists on `phase-999.2.2-fix-compose-mounts-and-terminal-env`
