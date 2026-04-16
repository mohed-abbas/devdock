---
phase: 04-web-terminal-claude-code
plan: 03
subsystem: terminal-ui
tags: [xterm, socket-io, terminal, tabs, reconnect]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [terminal-page, terminal-tabs, reconnect-overlay, env-card-terminal-button]
  affects: [environment-card]
tech_stack:
  added: ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-web-links", "@xterm/addon-search", "@xterm/addon-clipboard", "socket.io-client"]
  patterns: ["dynamic import with ssr:false via client wrapper", "ResizeObserver + debounce for terminal fit", "Socket.IO namespace auth with signed tokens", "base-nova tooltip render prop pattern"]
key_files:
  created:
    - src/app/dashboard/env/[id]/terminal/page.tsx
    - src/app/dashboard/env/[id]/terminal/_components/terminal-loader.tsx
    - src/app/dashboard/env/[id]/terminal/_components/terminal-client.tsx
    - src/app/dashboard/env/[id]/terminal/_components/terminal-instance.tsx
    - src/app/dashboard/env/[id]/terminal/_components/terminal-tabs.tsx
    - src/app/dashboard/env/[id]/terminal/_components/reconnect-overlay.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/tooltip.tsx
  modified:
    - src/app/dashboard/_components/environment-card.tsx
    - server/terminal-server.ts
decisions:
  - "Client wrapper pattern for dynamic(ssr:false) -- Next.js 15 disallows ssr:false in Server Components, so TerminalLoader client component wraps the dynamic import"
  - "base-nova render prop for TooltipTrigger instead of asChild -- base-ui TooltipTrigger uses render prop to wrap custom components like Button"
  - "Link wraps Button instead of asChild -- base-nova Button (base-ui) does not support asChild prop"
metrics:
  duration: 6min
  completed: 2026-04-13
  tasks_completed: 1
  tasks_total: 2
  files_created: 8
  files_modified: 2
---

# Phase 4 Plan 3: Terminal UI (xterm.js + Tabs + Reconnect) Summary

Browser-side terminal page with xterm.js, Socket.IO connection, tabbed multi-terminal support (max 5), reconnect overlay, and Terminal button on environment cards.

## What Was Built

### Terminal Page (`/dashboard/env/[id]/terminal`)
- **Server component** validates session ownership and running status before rendering
- **Dynamic import** via client wrapper (TerminalLoader) with `ssr: false` to avoid xterm.js browser API issues in SSR
- Redirects to `/dashboard` if environment not found or not running

### TerminalClient (orchestration component)
- Manages Socket.IO connection lifecycle: fetch token from `/api/terminal/token`, connect to `/terminal` namespace via `/ws/socket.io` path
- Tab state management: add/close/switch tabs, max 5 tabs enforced
- Socket event handling: `exec:create`, `exec:created`, `exec:input`, `exec:output`, `exec:resize`, `exec:exit`, `exec:error`
- Connection state machine: connecting -> connected -> reconnecting -> disconnected
- Retry logic: disconnect old socket, fetch new token, reconnect
- Auto-creates first tab on connection

### TerminalInstance (xterm.js wrapper)
- Creates Terminal with dark theme matching UI-SPEC xterm color palette
- Loads 4 addons: FitAddon, WebLinksAddon, SearchAddon, ClipboardAddon
- ResizeObserver with 150ms debounce for responsive terminal sizing
- Visibility-aware: fits and focuses terminal when tab becomes active
- Proper cleanup: disposes terminal on unmount

### TerminalTabs
- Tab bar with ARIA roles (`role="tablist"`, `role="tab"`, `aria-selected`)
- Close button hidden on inactive tabs, visible on hover (group-hover pattern)
- New tab button with tooltip, disabled at max 5 with "Maximum 5 terminals" message
- Mobile-friendly: tab labels truncate at 80px

### ReconnectOverlay
- Three states: connected (hidden), reconnecting (spinner), disconnected (error + retry)
- Accessible with `aria-live="assertive"` for screen reader announcements
- "Back to Dashboard" link as escape route

### Environment Card Update
- Terminal button (TerminalSquare icon) added as first action button when status is running
- Button order: Terminal (running) -> Start (stopped/error) -> Stop (running) -> Delete (any)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Next.js 15 ssr:false in Server Component**
- **Found during:** Task 1, Step 2
- **Issue:** `dynamic()` with `ssr: false` is not allowed in Server Components in Next.js 15
- **Fix:** Created `terminal-loader.tsx` as a `'use client'` wrapper that performs the dynamic import
- **Files modified:** `page.tsx` (simplified), `terminal-loader.tsx` (new)
- **Commit:** cb50842

**2. [Rule 3 - Blocking] base-nova Button/Tooltip API differences**
- **Found during:** Task 1, Steps 5-7
- **Issue:** base-nova (base-ui) components don't support `asChild` prop like Radix-based shadcn. TooltipProvider uses `delay` not `delayDuration`. TooltipTrigger uses `render` prop instead of `asChild`.
- **Fix:** Used Link wrapping Button (instead of Button asChild > Link), TooltipTrigger render prop for Button integration, `delay` prop on TooltipProvider
- **Files modified:** terminal-tabs.tsx, terminal-client.tsx, environment-card.tsx
- **Commit:** cb50842

**3. [Rule 3 - Blocking] Pre-existing stream.destroy type error in terminal-server.ts**
- **Found during:** Task 1 verification (build step)
- **Issue:** `ReadWriteStream` interface doesn't include `destroy()` method, causing tsc build failure
- **Fix:** Cast to optional destroy pattern: `(stream as ...).destroy?.()`
- **Files modified:** server/terminal-server.ts
- **Commit:** cb50842

## Verification Results

- TypeScript check: PASS (only pre-existing server/ errors remain, all new files clean)
- Next.js build: PASS (route `/dashboard/env/[id]/terminal` generated successfully)
- All acceptance criteria patterns verified in source files

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | cb50842 | Terminal UI with xterm.js, tabs, Socket.IO, reconnect overlay, env card button |

## Awaiting

Task 2 is a human verification checkpoint. The user needs to verify end-to-end terminal functionality with a running environment.
