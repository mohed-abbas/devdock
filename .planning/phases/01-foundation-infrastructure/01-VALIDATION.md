---
phase: 1
slug: foundation-infrastructure
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Static checks (tsc, grep, file existence) — no test runner needed for Phase 1 |
| **Config file** | N/A — Phase 1 is scaffolding and config files; vitest installed in Phase 2 |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

**Wave 0 rationale:** Phase 1 is pure scaffolding (create-next-app, Dockerfiles, config templates, schema definitions). All tasks produce static artifacts verifiable via `tsc --noEmit`, `grep`, and file existence checks. A test runner (vitest) adds no value for verifying "does this file exist with this content" — those checks are faster and more reliable as direct shell commands. Vitest will be installed when testable business logic appears (Phase 2+).

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit` + file existence checks
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 01-01-T1 | 01 | 1 | DASH-06 | T-01-01 | .env.local in .gitignore | static | `npx tsc --noEmit && grep -q 'standalone' next.config.ts && test -f src/components/ui/button.tsx` | pending |
| 01-01-T2 | 01 | 1 | DASH-06 | T-01-02 | zod validates env vars | static | `npx tsc --noEmit && grep -q 'pgTable' src/lib/db/schema.ts` | pending |
| 01-02-T1 | 02 | 1 | INFRA-02, INFRA-04 | T-02-01, T-02-08 | No docker.sock in Dockerfile | static | `grep -q 'ubuntu:24.04' docker/base/Dockerfile && ! grep -q 'docker.sock' docker/base/Dockerfile` | pending |
| 01-02-T2 | 02 | 1 | INFRA-01, INFRA-03, INFRA-05 | T-02-02, T-02-05, T-02-07, T-02-09 | No ports in compose, cleanup script | static | `! grep -q 'ports:' docker/templates/base-compose.yml && grep -q 'docker system prune' scripts/docker-cleanup.sh` | pending |
| 01-03-T1 | 03 | 2 | DASH-06 | T-03-01 | Health endpoint hides errors | static | `npx tsc --noEmit && grep -q 'status.*ok' src/app/api/health/route.ts` | pending |
| 01-03-T2 | 03 | 2 | DASH-06 | — | Human verifies UI and API | checkpoint | Human-verify: dark theme, /api/health JSON, file existence | pending |

*Status: pending (pre-execution) -- will be updated to green/red during execution*

---

## Wave 0 Requirements

- [x] No test runner needed — Phase 1 uses static verification (tsc + grep + file checks)
- [x] All tasks have `<automated>` verify commands that run in < 10 seconds
- [x] No MISSING references — every task has concrete automated verification

**Wave 0 is satisfied by design:** Phase 1 artifacts (scaffolding, Dockerfiles, YAML templates, config files) are verifiable through TypeScript compilation and content checks. No runtime test framework is required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| nginx reverse proxy with HTTPS | DASH-06 | Requires deployed nginx + TLS cert | Deploy to VPS, verify HTTPS response |
| Docker socket isolation at runtime | INFRA-04 | Requires Docker daemon running | Verify socket not mounted in containers |
| Docker base image builds | INFRA-02 | Requires Docker daemon access | `docker build -t devdock-base docker/base/` on machine with Docker |
| Dark theme visual appearance | DASH-06 | Visual verification | Open localhost:3000, confirm dark background |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none needed)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
