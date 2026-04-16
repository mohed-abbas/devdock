---
phase: 05-github-integration
plan: 01
subsystem: github
tags: [octokit, oauth, aes-256-gcm, encryption, drizzle, github]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: database schema (users table), config validation, project structure
provides:
  - github_accounts table schema
  - AES-256-GCM encrypt/decrypt utilities
  - OAuth URL builder and token exchange functions
  - Octokit client factory from encrypted tokens
  - Config validation for GitHub env vars
affects: [05-02, 05-03, 05-04]

# Tech tracking
tech-stack:
  added: ["@octokit/rest", "sonner"]
  patterns: ["AES-256-GCM with random IV per encryption, stored as iv:tag:ciphertext hex", "Manual OAuth flow separate from Auth.js"]

key-files:
  created:
    - src/lib/github/encryption.ts
    - src/lib/github/oauth.ts
    - src/lib/github/client.ts
    - src/lib/github/__tests__/encryption.test.ts
    - src/lib/github/__tests__/oauth.test.ts
    - src/components/ui/popover.tsx
    - src/components/ui/command.tsx
    - src/components/ui/avatar.tsx
    - src/components/ui/select.tsx
  modified:
    - src/lib/db/schema.ts
    - src/lib/config.ts
    - package.json

key-decisions:
  - "AES-256-GCM with 12-byte random IV and iv:tag:ciphertext hex storage format"
  - "Manual OAuth flow (not Auth.js provider) per research findings"
  - "GitHub env vars optional so DevDock works without GitHub configured"

patterns-established:
  - "Encryption module: encrypt/decrypt pair with hex key validation"
  - "OAuth utilities: separate URL builder, state generator, token exchange"
  - "Octokit factory: decrypt token at creation time, never store plaintext"

requirements-completed: [GH-04]

# Metrics
duration: 2min
completed: 2026-04-14
---

# Phase 05 Plan 01: GitHub Integration Foundation Summary

**AES-256-GCM token encryption, OAuth flow utilities, Octokit factory, and github_accounts schema for GitHub integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-14T09:20:05Z
- **Completed:** 2026-04-14T09:22:24Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 13

## Accomplishments
- github_accounts table schema with encrypted token column and user FK (unique per user)
- AES-256-GCM encrypt/decrypt with random 12-byte IV per operation, stored as hex triplet
- OAuth URL builder with scope=repo, CSRF state generator, and token exchange function
- Octokit client factory that decrypts tokens at instantiation time
- Config validation for optional GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_TOKEN_ENCRYPTION_KEY
- 14 unit tests covering roundtrip encryption, wrong key rejection, unique IV, OAuth URL params, token exchange

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests** - `4a56d15` (test)
2. **Task 1 (GREEN): Implementation** - `2ee2a3e` (feat)

## Files Created/Modified
- `src/lib/github/encryption.ts` - AES-256-GCM encrypt/decrypt with random IV
- `src/lib/github/oauth.ts` - OAuth URL builder, state generator, token exchange
- `src/lib/github/client.ts` - Octokit factory from encrypted token
- `src/lib/github/__tests__/encryption.test.ts` - 8 encryption tests
- `src/lib/github/__tests__/oauth.test.ts` - 6 OAuth tests
- `src/lib/db/schema.ts` - Added github_accounts table
- `src/lib/config.ts` - Added optional GitHub env vars
- `package.json` - Added @octokit/rest, sonner
- `src/components/ui/popover.tsx` - shadcn popover component
- `src/components/ui/command.tsx` - shadcn command component
- `src/components/ui/avatar.tsx` - shadcn avatar component
- `src/components/ui/select.tsx` - shadcn select component

## Decisions Made
- AES-256-GCM with 12-byte random IV and `iv_hex:tag_hex:ciphertext_hex` storage format per plan spec
- Manual OAuth flow separate from Auth.js per research findings (Pitfall 1)
- All three GitHub env vars optional so DevDock functions without GitHub configured

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required. GitHub credentials will be configured in a later plan when the OAuth callback route is implemented.

## Next Phase Readiness
- All foundation modules ready for plans 05-02 (OAuth callback route), 05-03 (repo browser API), and 05-04 (UI)
- Schema migration will need to be run on the database before OAuth flow works end-to-end

---
*Phase: 05-github-integration*
*Completed: 2026-04-14*
