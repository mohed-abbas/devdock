---
phase: 2
slug: authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (to be installed in Wave 0) |
| **Config file** | vitest.config.ts (Wave 0 creates) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AUTH-01 | T-02-01 | Valid credentials return session | integration | `npx vitest run tests/auth/login.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | AUTH-01 | T-02-06 | Invalid credentials return generic error | integration | `npx vitest run tests/auth/login.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | AUTH-01 | T-02-01 | Rate limiting blocks after 5 failures | unit | `npx vitest run tests/auth/rate-limit.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | AUTH-02 | T-02-04 | Session cookie is HTTP-only | integration | `npx vitest run tests/auth/session.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | AUTH-02 | T-02-02 | CSRF protection on auth endpoints | integration | `npx vitest run tests/auth/session.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | AUTH-03 | — | Logout clears session and redirects | integration | `npx vitest run tests/auth/logout.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | AUTH-04 | — | Session persists across requests | integration | `npx vitest run tests/auth/session.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install `vitest` + `@vitejs/plugin-react` — test framework
- [ ] `vitest.config.ts` — framework config with path aliases
- [ ] `tests/auth/login.test.ts` — stubs for AUTH-01
- [ ] `tests/auth/session.test.ts` — stubs for AUTH-02, AUTH-04
- [ ] `tests/auth/logout.test.ts` — stubs for AUTH-03
- [ ] `tests/auth/rate-limit.test.ts` — stubs for AUTH-01 (rate limiting)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login page visual layout (centered card, dark bg) | D-01, D-02 | Visual check | Open /login, verify card is centered, dark background, "DevDock" title visible |
| Seed script interactive prompts | D-06 | Requires TTY | Run `npm run seed-admin`, verify username/password prompts work |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
