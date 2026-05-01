---
quick_id: 260501-ogb
description: Default Edit Environment previewPort to 3000 when currently unset
date: 2026-05-01
mode: quick
must_haves:
  truths:
    - When opening Edit Environment on an env with previewPort=null, the input shows "3000" (proposed default) instead of empty
    - When opening Edit Environment on an env with previewPort already set, the input shows the existing value (unchanged behavior)
    - User can clear the field and Save to keep the env at null (no forced opt-in)
    - Helper text makes the "currently unset → defaulting to 3000" state visible so the user knows clicking Save will apply it
  artifacts:
    - src/app/dashboard/_components/edit-environment-dialog.tsx (initial state, sync effect, helper text)
  key_links:
    - src/app/dashboard/_components/edit-environment-dialog.tsx:34-36 (initial useState)
    - src/app/dashboard/_components/edit-environment-dialog.tsx:42 (useEffect resync)
    - src/app/dashboard/_components/edit-environment-dialog.tsx:74-78 (newPort diff logic, must keep working)
    - src/app/dashboard/_components/edit-environment-dialog.tsx:154-156 (helper text)
---

# Quick Task 260501-ogb: Default Edit Environment previewPort to 3000 when unset

## Problem

Companion to 260501-obf. The previous quick task fixed the *new env* path. Existing envs (portfolio-test, portfolio-retest, ttttt) still have `previewPort: null` because they predate the fix. The Edit dialog technically supports setting a port, but currently shows a blank field with placeholder "3000" — same default-blindness as before. Users have to know to type 3000 and click Save.

A one-click fix: when `environment.previewPort === null`, pre-fill the Edit input with "3000" (a proposed default) and surface that intent in the helper text. The user can accept by clicking Save, change the value, or clear it back to blank to keep the env unset.

## Plan 01: Pre-fill Edit dialog with 3000 when env has no port

**Files:** `src/app/dashboard/_components/edit-environment-dialog.tsx`

**Action:**
1. Line 35 — `environment.previewPort?.toString() ?? ''` → `environment.previewPort?.toString() ?? '3000'`
2. Line 42 — same change inside the open-effect resync
3. Line 154-156 — replace the static helper text with a conditional one. When `environment.previewPort === null`: "Currently unset. Defaulting to 3000 — clear to keep unset, or change to your dev server's port." When already set: keep the existing copy "Port your app listens on inside the container."

**Verify:**
- Open the Edit dialog on `portfolio-retest` (previewPort=null) → input shows "3000", helper text mentions "Currently unset. Defaulting to 3000"
- Click Save → API PATCH carries `previewPort: 3000`, env row updates, dialog closes
- Re-open Edit dialog on the now-set env → input shows "3000", helper text drops back to the unset-aware copy disappears (since previewPort is now 3000, not null)
- Open Edit dialog on `portfolio-test`, clear the field (still null currently → input pre-fills 3000, then user clears), click Save → previewPort stays null (or becomes null if it was set)

**Done when:**
- Edit applied to all three locations
- Browser verification: a `null` env shows "3000" pre-filled in Edit; clicking Save persists 3000 to DB; refresh confirms `previewPort: 3000` in `/api/environments`
- Existing envs with non-null previewPort still show their existing value (no regression)

## Out of scope

- Auto-applying 3000 to all null-previewPort envs without user interaction (this is the "one-click" framing the user accepted; we don't want a silent migration)
- Changes to the API or DB schema (already optional/nullable)
- Showing a "Save" hint banner / toast — the helper text is enough
- Touching the Create dialog (already done in 260501-obf)
