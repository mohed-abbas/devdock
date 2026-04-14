---
phase: 6
slug: dashboard-monitoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | vitest.config.ts |
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
| 06-01-01 | 01 | 1 | DASH-01 | — | N/A | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | DASH-03 | — | N/A | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | DASH-04 | — | N/A | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | DASH-05 | — | N/A | integration | `npx vitest run` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | DASH-02 | — | N/A | integration | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live log streaming displays in browser | DASH-04 | Requires running Docker container + Socket.IO connection | Start env, open logs page, verify log lines appear |
| Preview URL accessible through proxy | DASH-05 | Requires running container with web server on preview port | Start env with preview port, click preview button, verify page loads |
| Production apps display from /home/murx/apps/ | DASH-03 | Requires production Docker containers on host | Check dashboard shows production section when apps are running |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
