---
phase: 5
slug: github-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.4 |
| **Config file** | vitest.config.ts |
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
| 05-01-01 | 01 | 1 | GH-04 | T-05-01 | AES-256-GCM encrypt/decrypt roundtrip | unit | `npx vitest run src/lib/github/__tests__/encryption.test.ts -t "roundtrip"` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | GH-04 | T-05-01 | Decrypt with wrong key fails | unit | `npx vitest run src/lib/github/__tests__/encryption.test.ts -t "wrong key"` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | GH-04 | T-05-01 | Each encryption produces unique ciphertext (random IV) | unit | `npx vitest run src/lib/github/__tests__/encryption.test.ts -t "unique IV"` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | AUTH-05 | T-05-02 | OAuth state validation rejects mismatched state | unit | `npx vitest run src/lib/github/__tests__/oauth.test.ts -t "state mismatch"` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | GH-01 | — | Authorize URL includes correct params | unit | `npx vitest run src/lib/github/__tests__/oauth.test.ts -t "authorize URL"` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | GH-02 | — | Repo list API returns mapped data | unit | `npx vitest run src/app/api/github/__tests__/repos.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | GH-05 | T-05-03 | Clone command includes token for private repos | unit | `npx vitest run src/lib/docker/__tests__/docker-service.test.ts -t "clone with token"` | ❌ W0 | ⬜ pending |
| 05-03-03 | 03 | 2 | GH-05 | T-05-03 | Error messages sanitize token | unit | `npx vitest run src/lib/docker/__tests__/docker-service.test.ts -t "sanitize token"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/github/__tests__/encryption.test.ts` — stubs for GH-04 (encrypt/decrypt)
- [ ] `src/lib/github/__tests__/oauth.test.ts` — stubs for AUTH-05, GH-01 (OAuth flow)
- [ ] `src/app/api/github/__tests__/repos.test.ts` — stubs for GH-02 (repo listing)
- [ ] Extended `src/lib/docker/__tests__/docker-service.test.ts` — stubs for GH-05 (clone with token)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth redirect completes successfully | AUTH-05 | Requires real GitHub OAuth App | Register OAuth App, set env vars, click "Connect GitHub", verify redirect and callback |
| Repo dropdown shows private repos | GH-02, GH-03 | Requires real GitHub account with private repos | Connect GitHub, open create dialog, verify private repos appear with lock icon |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
