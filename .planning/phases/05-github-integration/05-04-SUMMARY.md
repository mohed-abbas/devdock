---
phase: 05-github-integration
plan: 04
subsystem: ui
tags: [react, hooks, combobox, select, github, shadcn]

requires:
  - phase: 05-02
    provides: GitHub API routes (repos, branches, connection)
  - phase: 05-03
    provides: useGitHubConnection hook, GitHub connection card

provides:
  - useGitHubRepos hook with client-side 5-min cache
  - useGitHubBranches hook for per-repo branch fetching
  - RepoCombobox searchable dropdown component
  - BranchSelect dropdown with default branch pre-selection
  - Enhanced CreateEnvironmentDialog with GitHub repo/branch selection

affects: [06-dashboard-polish, 07-resource-limits]

tech-stack:
  added: []
  patterns: [combobox pattern with Popover+Command, mode toggle pattern]

key-files:
  created:
    - src/hooks/use-github-repos.ts
    - src/hooks/use-github-branches.ts
    - src/app/dashboard/_components/repo-combobox.tsx
    - src/app/dashboard/_components/branch-select.tsx
  modified:
    - src/app/dashboard/_components/create-environment-dialog.tsx

key-decisions:
  - "Base-ui Select onValueChange returns string|null; wrapped with null guard in BranchSelect"
  - "Schema push deferred to deployment time (dev environment without DB access)"

patterns-established:
  - "Combobox pattern: Popover + Command for searchable dropdowns with base-nova style"
  - "Mode toggle pattern: GitHub combobox vs manual URL input with bidirectional switching"

requirements-completed: [GH-02, GH-03]

duration: 11min
completed: 2026-04-14
---

# Phase 5 Plan 4: Repo Combobox, Branch Select, and Enhanced Creation Dialog Summary

**Searchable GitHub repo combobox and branch selector integrated into environment creation dialog with manual URL fallback toggle**

## What Was Built

### Hooks (Data Layer)

**useGitHubRepos** (`src/hooks/use-github-repos.ts`): Fetches authenticated user's repos from `/api/github/repos` with a 5-minute client-side cache via `useRef`. Handles token expiry (401 with `expired: true`) by setting an `expired` state flag. Returns `{ repos, loading, error, expired, fetchRepos }`.

**useGitHubBranches** (`src/hooks/use-github-branches.ts`): Fetches branches for a specific `owner/repo` from `/api/github/repos/[owner]/[repo]/branches`. Resets branch list on each new fetch. Returns `{ branches, loading, fetchBranches }`.

### Components (UI Layer)

**RepoCombobox** (`src/app/dashboard/_components/repo-combobox.tsx`): Searchable repository dropdown using shadcn Popover + Command pattern. Fetches repos on open. Shows Lock icon for private repos with `aria-label="Private repository"`. Displays loading spinner, error with retry button, and "No repositories found." empty state. ChevronsUpDown trigger icon.

**BranchSelect** (`src/app/dashboard/_components/branch-select.tsx`): Branch dropdown using shadcn Select. Auto-fetches branches when owner/repo changes. Sorts default branch first, then alphabetical. Shows "Loading branches..." placeholder during fetch.

**CreateEnvironmentDialog** (enhanced): Now imports `useGitHubConnection` to detect GitHub status. When connected: shows RepoCombobox with "Enter URL manually" toggle link, plus BranchSelect when repo selected. When not connected: shows original URL input with "Connect GitHub in Settings" hint linking to `/dashboard/settings`. Form submission includes `branch` field when repo selected from combobox. All state (selectedRepo, selectedBranch, manualMode) resets on dialog close.

## Verification Results

- TypeScript: 0 errors in plan files (9 pre-existing errors from missing dependencies in other plans)
- Tests: 63/64 pass (1 pre-existing failure in compose-generator unrelated to this plan)
- Build: Turbopack error due to worktree node_modules resolution (pre-existing infrastructure issue)

## Deviations from Plan

### Intentional Deviations

**1. Schema push deferred to deployment time**
- **Reason:** Per orchestrator instructions, schema push can be done later when the app is deployed. The worktree environment lacks direct database access.
- **Impact:** None on code correctness. The `github_accounts` table schema exists in `src/lib/db/schema.ts` from Plan 02.

**2. Build verification limited to TypeScript check**
- **Reason:** `npm run build` fails with Turbopack "Next.js package not found" error due to worktree symlink resolution. This is a pre-existing infrastructure issue affecting all worktree agents.
- **Impact:** TypeScript compilation validates all imports, types, and component boundaries.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed base-ui Select onValueChange type mismatch**
- **Found during:** Task 1
- **Issue:** Base-ui Select's `onValueChange` signature is `(value: string | null, eventDetails) => void` but BranchSelect's `onChange` prop expects `(branch: string) => void`
- **Fix:** Wrapped with null guard: `onValueChange={(v) => { if (v) onChange(v); }}`
- **Files modified:** `src/app/dashboard/_components/branch-select.tsx`
- **Commit:** 7ad1432

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 7ad1432 | feat(05-04): add repo combobox, branch select, and enhanced creation dialog |

## Self-Check: PASSED
