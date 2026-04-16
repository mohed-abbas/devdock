---
status: diagnosed
phase: 06-dashboard-monitoring
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md
started: 2026-04-16T09:10:00Z
updated: 2026-04-16T09:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Start the application from scratch (`npm run dev`). Server boots without errors. Dashboard loads at localhost:3000 and shows your environments.
result: pass
note: Postgres Docker container must be running first (expected infrastructure dependency).

### 2. Dashboard Layout
expected: Dashboard shows "Dev Environments" heading. Environment cards are visible with name and status badge.
result: pass
auto-verified: Playwright snapshot confirmed "Dev Environments" heading and environment card with name "fix-verify" and "Running" status.

### 3. Create Environment Dialog — Preview Port
expected: Clicking "New Environment" opens a dialog with Name, Git Repository URL, Preview Port (number input with helper text "Port your app listens on inside the container"), and Sidecar Services checkboxes. Preview Port is optional.
result: pass
auto-verified: Playwright snapshot confirmed spinbutton "Preview Port" with helper text "Port your app listens on inside the container (optional)" and sidecar checkboxes for PostgreSQL and Redis.

### 4. Environment Card Action Buttons
expected: A running environment card shows action buttons in order: Preview (external link icon), Logs (scroll icon), Terminal (terminal icon), Stop, Edit, Delete. Preview and Logs are links; Stop, Edit, Delete are buttons.
result: pass
auto-verified: Playwright snapshot confirmed buttons in order — "Open preview" (link), "View logs" (link), "Open terminal" (link), "Stop environment", "Edit environment", "Delete environment".

### 5. Preview Proxy
expected: Clicking the Preview button on an environment card with a preview port set opens a new tab. If an app is running on that port inside the container, the proxied content is displayed. If nothing is running, an error message appears (not a raw crash).
result: pass
note: Shows "Upstream connection failed" when no app running on preview port — correct graceful error.

### 6. Container Log Streaming
expected: Clicking "View logs" on a running environment navigates to a full-screen logs page. The page shows the environment name and status in a header bar, with auto-scroll toggle and clear buttons. Log lines stream in real-time from the container.
result: issue
reported: "Page loads and connects (no Connection Lost error) but shows 'Waiting for output logs' permanently. Running commands in the web terminal does not produce any log output on the logs page."
severity: major

### 7. Log Controls
expected: On the logs page, the auto-scroll toggle disables/enables automatic scrolling to bottom. The clear button clears all visible log lines. The back button returns to dashboard.
result: pass

### 8. Production Apps Section Hidden
expected: When PRODUCTION_APPS_DIR is not configured (or empty), the Production Apps section does not appear on the dashboard at all — no heading, no empty state.
result: pass
auto-verified: Playwright snapshot confirmed no Production Apps section in DOM when unconfigured.

### 9. Logs Page Layout
expected: The logs page has a header bar with back navigation, environment name, status badge, auto-scroll toggle button, and clear logs button. Connection state overlay shows when disconnected.
result: pass
auto-verified: Playwright snapshot confirmed header with env name "fix-verify", "Running" badge, "Disable auto-scroll" button, "Clear logs" button, and "Connection lost" overlay with retry button (terminal server not running).

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Log lines stream in real-time from the container on the logs page"
  status: failed
  reason: "User reported: Page loads and connects but shows 'Waiting for output logs' permanently. Running commands in the web terminal does not produce any log output on the logs page."
  severity: major
  test: 6
  root_cause: "Container entrypoint is `exec sleep infinity` (PID 1), which produces zero stdout/stderr. Docker `container.logs()` only captures PID 1 output. Terminal sessions run via `docker exec`, whose output goes to the exec stream, not container logs. The log streaming pipeline is wired correctly but the data source is empty."
  artifacts:
    - path: "docker/base/entrypoint.sh"
      issue: "sleep infinity produces no stdout/stderr for container.logs() to capture"
    - path: "server/terminal-server.ts"
      issue: "/logs namespace correctly streams container.logs() but exec session output goes to /terminal namespace only"
  missing:
    - "Forward exec session output from /terminal namespace to /logs namespace subscribers for the same container"
