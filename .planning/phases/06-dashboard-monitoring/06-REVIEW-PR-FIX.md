---
phase: 06-dashboard-monitoring
fixed_at: 2026-04-16T00:00:00Z
review_path: .planning/phases/06-dashboard-monitoring/06-REVIEW-PR.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report (PR #5)

**Fixed at:** 2026-04-16
**Source review:** `.planning/phases/06-dashboard-monitoring/06-REVIEW-PR.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 Warning, 3 Info)
- Fixed: 4
- Skipped: 0

User explicitly approved expanding the PR scope to include WR-01 (pre-existing
defense-in-depth gap in the PATCH handler) alongside the three Info-level
findings on this post-merge follow-up PR.

## Fixed Issues

### WR-01: PATCH handler UPDATE does not re-apply the userId filter

**Files modified:** `src/app/api/environments/[id]/route.ts`
**Commit:** 19476c5
**Applied fix:** Added `eq(environments.userId, session.user.id)` to the
`.where(...)` clause of the PATCH `UPDATE` statement so authorization is
re-enforced at the point of mutation, matching the GET and DELETE handlers
and closing the defense-in-depth gap.

### IN-01: `window.location.protocol` SSR guard is unnecessary in this render path

**Files modified:** `src/app/dashboard/_components/environment-card.tsx`
**Commit:** 56dced0
**Applied fix:** Kept the `typeof window` guard as a safety net and added a
multi-line comment explaining (a) why no hydration mismatch occurs today
(`EnvironmentList` is `'use client'` and starts with `environments = []`, so
cards never render during SSR) and (b) what to change if the render path
ever pre-fetches environments server-side (switch to a `useEffect`-gated
mounted flag). Chose the documentation route over refactoring because the
current code is correct and the reviewer classified this as optional
hardening.

### IN-02: `.env.example` overstates startup validation for GitHub vars

**Files modified:** `.env.example`
**Commit:** 7ee5383
**Applied fix:** Replaced the misleading "partial config is rejected at
runtime" comment with "partial config is silently ignored at startup but
OAuth flows will return an error response if any var is missing", matching
the actual behavior of `src/lib/config.ts` (all three vars are independently
`.optional()` with no `.refine()` cross-check) and the request-time 503/
`?github_error=not_configured` handling in the authorize/callback routes.

### IN-03: README production section uses the dev runner script for terminal server

**Files modified:** `README.md`
**Commit:** 403f3ca
**Applied fix:** Updated the inline comment in the production build snippet
from "run the terminal server under your process manager" to "tsx is used
for both dev and prod in this project". This picks the lower-churn option
of the two fixes suggested by the review (vs. adding a `terminal:start`
script that compiles to JS) and documents the accepted trade-off of running
`tsx` in production.

---

_Fixed: 2026-04-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
