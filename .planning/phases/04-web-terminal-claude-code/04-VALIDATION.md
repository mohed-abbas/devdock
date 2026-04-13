---
phase: 4
slug: web-terminal-claude-code
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | TERM-04, TERM-05 | T-04-05 | Read-only mount, API key injection | integration | `npx vitest run src/lib/docker/__tests__/compose-generator.test.ts` | yes (extended) | ⬜ pending |
| 04-01-02 | 01 | 1 | TERM-01, TERM-03 | T-04-01, T-04-02 | Token auth, single-use validation | unit | `npx vitest run src/app/api/terminal/__tests__/token.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | TERM-01, TERM-03 | T-04-08 | Signed token auth for Socket.IO | unit | `AUTH_SECRET=test-secret-32chars npx vitest run server/__tests__/terminal-auth.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | TERM-02 | — | N/A | e2e | Manual — xterm.js resize/clipboard in browser | N/A | ⬜ pending |
| 04-03-01 | 03 | 3 | TERM-01 to TERM-05 | T-04-14 | Auth + ownership check on terminal page | build | `npx tsc --noEmit && npx next build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/app/api/terminal/__tests__/token.test.ts` — stubs for token API validation (auth, ownership, status checks)
- [ ] `server/__tests__/terminal-auth.test.ts` — stubs for signed token create/verify

*Existing vitest infrastructure from prior phases covers framework installation. `src/lib/docker/__tests__/compose-generator.test.ts` already exists and will be extended.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Terminal resize, key bindings, clipboard | TERM-02 | Browser-based xterm.js interaction requires visual verification | Open terminal in browser, resize window, verify terminal reflows. Test Ctrl+C, arrow keys. Copy text from terminal, paste into terminal. |
| Claude Code interactive session | TERM-04 | Requires live ANTHROPIC_API_KEY and Docker environment | Run `claude` in web terminal, verify prompt appears and responds to input |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
