---
quick_id: 260501-obf
description: Default previewPort to 3000 in New Environment dialog
date: 2026-05-01
mode: quick
must_haves:
  truths:
    - The New Environment dialog's Preview Port field is pre-filled with "3000" when the dialog opens
    - Resetting the form (closing/reopening the dialog) returns the field to "3000", not blank
    - User can clear or change the value before submitting
    - API contract is unchanged (zod schema already accepts optional number)
  artifacts:
    - src/app/dashboard/_components/create-environment-dialog.tsx (two one-line edits)
  key_links:
    - src/app/dashboard/_components/create-environment-dialog.tsx:38 (initial state)
    - src/app/dashboard/_components/create-environment-dialog.tsx:51 (resetForm)
    - src/app/dashboard/_components/create-environment-dialog.tsx:256 (helper text)
    - src/app/api/environments/route.ts:21 (zod schema — unchanged)
    - src/app/api/preview/[[...path]]/route.ts:59 (preview proxy — unchanged)
---

# Quick Task 260501-obf: Default previewPort to 3000 in New Environment dialog

## Problem

The Preview Port field in the New Environment dialog defaults to empty string. The placeholder shows "3000" but the value is blank, so users who don't fill it in get `previewPort: null` persisted to the DB. The preview proxy then returns 404 for those envs (`route.ts:59` checks `!env.previewPort`), and the Preview button never appears on the environment card (`environment-card.tsx:111`).

Most dev servers (Next.js, Vite, CRA, Storybook) listen on port 3000 by default, so the right behavior is to pre-fill 3000 and let the user clear it if their stack uses a different port.

## Plan 01: Pre-fill Preview Port with "3000"

**Files:** `src/app/dashboard/_components/create-environment-dialog.tsx`

**Action:**
1. Line 38: change `useState<string>('')` → `useState<string>('3000')`
2. Line 51: change `setPreviewPort('')` → `setPreviewPort('3000')` (so resetForm returns the field to 3000, not blank)
3. Line 257: tighten helper text to make the default explicit. Current: "Port your app listens on inside the container (optional)". New: "Port your dev server listens on inside the container (defaults to 3000 — clear if not needed)."

**Verify:**
- TypeScript compile passes (`npx tsc --noEmit` — but app uses Next.js build; trust the TS server for this single-file edit)
- Manual verification: open the New Environment dialog in the running app via Claude-in-Chrome, confirm the Preview Port input shows "3000" on first open and after closing+reopening
- Confirm a freshly created env gets `previewPort: 3000` in the API response
- Confirm `/api/environments/{id}/preview/` no longer returns the previewPort:null 404 (it may return a 502 / connection-refused if no server is actually listening on 3000 inside the dev container — that's expected and correct, distinct from the previewPort:null gate)

**Done when:**
- Both edits applied
- Browser verification screenshot shows "3000" pre-filled in the Preview Port field
- API response on a freshly created env contains `"previewPort": 3000`

## Out of scope

- Backfilling existing envs (portfolio-test, portfolio-retest, ttttt) with previewPort=3000. The Edit Environment dialog already supports setting it — the user can update each env via the UI when they need preview to work for that env. A SQL migration would be invasive and behavioral (changes the contract for envs the user explicitly chose not to set a port for).
- Auto-detecting the actual listening port inside the container (would require dockerode `containerStats` polling or a sidecar — significant scope).
- Edit Environment dialog: leaves the existing behavior alone (it already defaults to whatever the env was created with, which is correct).
- Schema/API changes: the zod schema already accepts an optional number; nothing else needs to change.
