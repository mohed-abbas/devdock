---
phase: 04-web-terminal-claude-code
plan: 01
subsystem: terminal-backend
tags: [docker-exec, terminal-token, compose-template, xterm-deps]
dependency_graph:
  requires: []
  provides: [terminal-types, docker-exec, terminal-token-api, claude-mount]
  affects: [compose-generator, docker-service, config]
tech_stack:
  added: ["@xterm/xterm@5.5.0", "@xterm/addon-fit@0.10.0", "@xterm/addon-web-links@0.11.0", "@xterm/addon-search@0.15.0", "@xterm/addon-clipboard@0.1.0", "socket.io@4.8.3", "socket.io-client@4.8.3", "express@5.1.0", "zustand@5.0.5", "@types/express@5"]
  patterns: [in-memory-token-store, docker-exec-pty, compose-template-vars]
key_files:
  created:
    - src/lib/terminal/types.ts
    - src/app/api/terminal/token/route.ts
    - src/app/api/terminal/__tests__/token.test.ts
  modified:
    - package.json
    - package-lock.json
    - docker/templates/base-compose.yml
    - src/lib/docker/compose-generator.ts
    - src/lib/docker/types.ts
    - src/lib/config.ts
    - src/lib/docker/__tests__/compose-generator.test.ts
    - src/lib/docker/docker-service.ts
    - src/app/api/environments/route.ts
decisions:
  - In-memory token store for terminal tokens (single-use, 30s TTL) -- acceptable for single-server deployment
  - Removed descriptive comment from compose template to keep placeholder removal regex clean
metrics:
  duration: 4min
  completed: "2026-04-13T16:11:49Z"
  tasks: 2
  files: 12
---

# Phase 04 Plan 01: Terminal Backend Foundation Summary

Backend foundation for web terminal: Docker exec functions, terminal token API, Claude config mounting in compose template, and all Phase 4 npm dependencies installed.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 7940487 | Install Phase 4 deps, update compose template for Claude config mounting |
| 1 (TDD RED) | 82dd1f3 | Add failing tests for terminal token store |
| 2 (TDD GREEN) | 48cd10d | Add terminal types, Docker exec functions, and token API |

## What Was Built

### Task 1: Compose Template and Dependencies
- Installed all Phase 4 npm dependencies: xterm.js, Socket.IO, express, zustand, and addons
- Extended config with `ANTHROPIC_API_KEY`, `CLAUDE_CONFIG_PATH`, and `TERMINAL_PORT`
- Updated compose template with `{{CLAUDE_CONFIG_MOUNT}}` placeholder and `ANTHROPIC_API_KEY` env var injection
- Updated compose generator to conditionally mount `~/.claude` read-only and inject API key
- Added `claudeConfigPath` and `anthropicApiKey` to `ComposeOptions` interface
- Updated environments API route to pass new compose options from config
- Added 4 new compose generator tests for Claude mount and API key scenarios

### Task 2: Terminal Types, Docker Exec, Token API (TDD)
- Created `src/lib/terminal/types.ts` with `TerminalToken`, `ExecSession` interfaces and in-memory token store
- Token store supports single-use validation with 30s TTL and periodic cleanup
- Added `createExecSession` (PTY exec as dev user), `resizeExec`, and `findDevContainerId` to docker-service
- Created `POST /api/terminal/token` endpoint with auth session check, environment ownership verification, running status validation, and nanoid(32) token generation
- 6 token store unit tests passing

## Test Results

All 33 tests passing across 4 test files:
- `compose-generator.test.ts`: 14 tests (4 new)
- `token.test.ts`: 6 tests (all new)
- `docker-service.test.ts`: 10 tests
- `types-config.test.ts`: 3 tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed descriptive comment from compose template**
- **Found during:** Task 1
- **Issue:** Template had `# {{CLAUDE_CONFIG_MOUNT}} is replaced at generation time` comment line. The removal regex `.*\{\{CLAUDE_CONFIG_MOUNT\}\}\n` could not match this line because text appeared after the placeholder.
- **Fix:** Removed the descriptive comment, keeping only the `# Claude config mounted read-only (D-07, D-09)` comment above the placeholder.
- **Files modified:** `docker/templates/base-compose.yml`, `src/lib/docker/__tests__/compose-generator.test.ts`
- **Commit:** 7940487

## Known Stubs

None -- all data paths are wired and functional.

## Self-Check: PASSED

All 10 key files verified present. All 3 commits verified in git log.
