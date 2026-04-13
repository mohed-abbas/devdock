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
| 04-01-01 | 01 | 1 | TERM-01 | — | N/A | integration | `npx vitest run src/__tests__/terminal-api.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | TERM-03 | T-04-01 | WebSocket rejects unauthenticated connections | integration | `npx vitest run src/__tests__/terminal-auth.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | TERM-02 | — | N/A | e2e | Manual — xterm.js resize/clipboard in browser | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | TERM-04 | — | N/A | integration | `npx vitest run src/__tests__/claude-code-env.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | TERM-05 | — | Read-only mount prevents writes to host ~/.claude | integration | `npx vitest run src/__tests__/claude-config-mount.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/terminal-api.test.ts` — stubs for TERM-01 (terminal API endpoint)
- [ ] `src/__tests__/terminal-auth.test.ts` — stubs for TERM-03 (authenticated WebSocket)
- [ ] `src/__tests__/claude-code-env.test.ts` — stubs for TERM-04 (Claude Code functional)
- [ ] `src/__tests__/claude-config-mount.test.ts` — stubs for TERM-05 (read-only config mount)

*Existing vitest infrastructure from prior phases covers framework installation.*

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
