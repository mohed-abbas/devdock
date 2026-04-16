---
phase: 05-github-integration
fixed_at: 2026-04-16T16:58:54Z
review_path: .planning/phases/05-github-integration/05-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-04-16T16:58:54Z
**Source review:** .planning/phases/05-github-integration/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Non-atomic upsert in OAuth callback can destroy token on insert failure

**Files modified:** `src/app/api/github/callback/route.ts`
**Commit:** 1ed0f2f
**Applied fix:** Wrapped the DELETE + INSERT upsert in `db.transaction()` so both operations are atomic. If the INSERT fails, the DELETE is rolled back and the existing token is preserved.

### WR-01: Paginate abort condition checks per-page count, not accumulated count

**Files modified:** `src/app/api/github/repos/route.ts`
**Commit:** 38e368d
**Applied fix:** Added a `total` accumulator variable outside the paginate callback. Each page adds `response.data.length` to `total`, and `done()` is called when `total >= 500`. Previously the condition checked a single page's length (max 100) against 500, which could never be true.

### WR-02: Stale closure in terminal connect_error handler reads initial state value

**Files modified:** `src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx`
**Commit:** a5aa447
**Applied fix:** Replaced direct `connectionState` variable read with `setConnectionState((prev) => prev === 'connecting' ? 'disconnected' : prev)` functional updater form. This guarantees the latest state is read without closure capture issues.

### WR-03: Compose file written without restrictive permissions (regression)

**Files modified:** `src/lib/docker/compose-generator.ts`
**Commit:** d7392e5
**Applied fix:** Changed `writeFile(composePath, template, 'utf-8')` to `writeFile(composePath, template, { encoding: 'utf-8', mode: 0o600 })`, restoring owner-only read/write permissions on the generated compose file.

### WR-04: Expired token state from useGitHubRepos is never surfaced to the user

**Files modified:** `src/hooks/use-github-repos.ts`
**Commit:** 3de2971
**Applied fix:** Added `setError('GitHub token expired. Reconnect in Settings.')` alongside the existing `setExpired(true)` in the 401/expired branch. The `RepoCombobox` component already renders the `error` state, so the expired message now displays correctly without requiring combobox changes.

---

_Fixed: 2026-04-16T16:58:54Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
