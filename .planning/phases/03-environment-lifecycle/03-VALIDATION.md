---
phase: 3
slug: environment-lifecycle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 |
| **Config file** | vitest.config.ts (Plan 03-01 Task 1 creates) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-00 | 01 | 1 | ENV-01..06 | T-03-15 | Docker socket access verified | checkpoint | `docker ps > /dev/null 2>&1` | N/A | ⬜ pending |
| 03-01-01 | 01 | 1 | ENV-01 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | ENV-02 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | ENV-03 | — | N/A | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | ENV-04 | — | N/A | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 03-02-02 | 02 | 2 | ENV-05 | — | N/A | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 03-03-01 | 03 | 2 | ENV-06 | — | N/A | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 03-03-02 | 03 | 2 | ENV-07 | — | N/A | type-check | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration with path aliases matching tsconfig
- [ ] `src/lib/docker/__tests__/compose-generator.test.ts` — tests for ENV-01, ENV-02 (compose generation, network isolation)
- [ ] `src/lib/docker/__tests__/docker-service.test.ts` — tests for ENV-03, ENV-04, ENV-05 (lifecycle operations with mocked Docker)

**Note:** API route tests (`src/app/api/environments/__tests__/routes.test.ts`) are intentionally excluded from Wave 0. API routes are verified via `npx tsc --noEmit` (type-checking) and the Plan 04 integration checkpoint (human-verify with real Docker operations). Adding a full API route test suite with mocked auth, DB, and Docker service would significantly bloat Plan 02 beyond the 50% context budget. API route testing is deferred to a future phase or gap closure if needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docker socket accessible by mohed_abbas | ENV-01..06 | Requires sudo for group setup | Plan 03-01 Task 0: run `docker ps`, verify exit 0 |
| devdock-base:latest image exists | ENV-01 | Requires Docker daemon | Plan 03-01 Task 0: `docker images devdock-base:latest` shows image |
| Docker Compose stack starts with isolated network | ENV-01 | Requires Docker daemon | Run `docker compose -p devdock-test up -d`, verify network isolation |
| Volumes persist across stop/start | ENV-02 | Requires Docker daemon | Create file in workspace, stop/start, verify file persists |
| Real-time status polling updates UI | ENV-06 | Requires browser + running environment | Start environment, observe status badge transitions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
