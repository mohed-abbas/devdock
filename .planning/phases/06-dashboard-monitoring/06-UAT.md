---
status: complete
phase: 06-dashboard-monitoring
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md]
started: 2026-04-16T12:00:00Z
updated: 2026-04-16T12:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Log Streaming — Buffered Output
expected: Open Logs page for a running environment. Open Terminal in another tab. Run commands (echo "test", ls -la). Logs page shows clean complete lines — no per-keystroke characters, no garbled ANSI prefixes like [?2004h or ;dev@...
result: pass

### 2. Preview Proxy — App Running
expected: Set a preview port on an environment (e.g., 3000). Start an app on that port inside the container. Click Preview button on the environment card. A new tab opens showing the proxied app content.
result: issue
reported: "Three issues: (a) Docker not available inside dev containers so can't run docker commands. (b) Preview loads HTML but assets/JS broken — burger menu not clickable, app not fully functional. (c) Navigation links in previewed app break out of proxy — clicking /services goes to localhost:3000/services instead of staying within /api/environments/[id]/preview/services."
severity: blocker

### 3. Preview Proxy — No App Running
expected: Click Preview on an environment with a preview port set but no app running on that port. The page shows a graceful error message (e.g., "Upstream connection failed"), not a raw crash or blank page.
result: pass

### 4. Create Environment — Preview Port Field
expected: Click "New Environment". The dialog includes an optional Preview Port number input with helper text. Leaving it empty works. Setting a value (e.g., 3000) persists and shows on the environment card.
result: pass

### 5. Environment Card — Action Buttons
expected: A running environment card shows buttons in order: Preview (if preview port set), Logs, Terminal, Stop, Edit, Delete. Preview opens new tab. Logs navigates to logs page. Terminal navigates to terminal page.
result: pass

### 6. Production Apps — Hidden When Unconfigured
expected: When PRODUCTION_APPS_DIR is not set, the dashboard shows only "Dev Environments" section. No "Production Apps" heading or empty state visible.
result: pass

### 7. Logs Page — Connection States
expected: Open logs for a running environment — shows "connected" state. Stop the terminal server — logs page shows reconnecting/disconnected overlay with retry button. Click retry — reconnects when server is back.
result: pass

### 8. Logs Page — Controls
expected: Auto-scroll toggle pauses/resumes scrolling to bottom. Clear button removes all visible log lines. Back button returns to dashboard.
result: pass

### 9. Edit Environment
expected: Click Edit on an environment card. A dialog opens allowing you to modify environment settings. Changes persist after saving.
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Preview proxy loads the full app with working assets and JS interactions"
  status: failed
  reason: "User reported: HTML loads but JS/CSS assets broken (burger menu not clickable), app not fully functional. The HTML rewrite regex (line 106) only prefixes _next/fonts/images/favicon paths — misses dynamically loaded JS chunks and other asset patterns."
  severity: blocker
  test: 2
  artifacts:
    - path: "src/app/api/environments/[id]/preview/[[...path]]/route.ts"
      issue: "HTML rewrite regex too narrow — only matches _next|fonts|images|favicon prefixes, misses other root-relative paths"
  missing:
    - "Broader asset rewriting or alternative approach (base tag injection, service worker) to handle all root-relative paths"

- truth: "Navigation within previewed app stays inside the preview proxy"
  status: failed
  reason: "User reported: Clicking /services link navigates to localhost:3000/services instead of localhost:3000/api/environments/[id]/preview/services. Links break out of the proxy context."
  severity: blocker
  test: 2
  artifacts:
    - path: "src/app/api/environments/[id]/preview/[[...path]]/route.ts"
      issue: "No rewriting of navigation links (<a href='/...'>) — only static asset prefixes are rewritten"
  missing:
    - "Rewrite all root-relative href/src/action attributes in HTML responses"
    - "Intercept client-side navigation (pushState/replaceState) to stay within proxy base path"
