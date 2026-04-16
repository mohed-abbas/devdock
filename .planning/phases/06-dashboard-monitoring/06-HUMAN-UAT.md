---
status: partial
phase: 06-dashboard-monitoring
source: [06-VERIFICATION.md]
started: 2026-04-16T13:30:00Z
updated: 2026-04-16T13:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Subdomain preview proxy — production infrastructure
expected: Wildcard DNS + certbot + nginx symlink + env vars on VPS. Create env with preview port 3000, start app inside container, click Preview button opens working app at subdomain URL with all assets loading.
result: [pending]

### 2. Log streaming — live terminal to logs page
expected: Open terminal for a running environment, type `echo "hello from terminal"`, switch to Logs page — the output appears in the log stream.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
