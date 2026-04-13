# Phase 4: Web Terminal & Claude Code - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 04-web-terminal-claude-code
**Areas discussed:** Terminal access UX, WebSocket transport, Claude config mounting, Terminal capabilities

---

## Terminal access UX

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated terminal page | Clicking 'Terminal' navigates to /dashboard/env/[id]/terminal — full-screen terminal with header bar | ✓ |
| Split panel on dashboard | Terminal opens as resizable bottom/right panel, environment list stays visible | |
| Modal overlay | Terminal opens as full-screen modal over dashboard | |

**User's choice:** Dedicated terminal page
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, tabbed terminals | Tab bar above terminal with '+' button. Each tab is a separate exec session | ✓ |
| Single terminal only | One terminal per environment. Users use tmux/screen inside container | |
| You decide | Claude picks | |

**User's choice:** Yes, tabbed terminals
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| bash | Default bash shell as 'dev' user. Matches base Dockerfile | ✓ |
| User's preferred shell | Check for zsh/fish first, fall back to bash | |
| You decide | Claude picks | |

**User's choice:** bash
**Notes:** None

---

## WebSocket transport

| Option | Description | Selected |
|--------|-------------|----------|
| Socket.IO | Auto-reconnect, long-polling fallback, namespaces. Already in tech stack | ✓ |
| Raw WebSocket (ws) | Lighter, no extra dependency. No auto-reconnect or fallback | |
| You decide | Claude picks | |

**User's choice:** Socket.IO
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Token in query param | Short-lived token via API, passed as ?token=xxx on WebSocket open | ✓ |
| Cookie-based (session) | Reuse Auth.js JWT cookie on upgrade request | |
| You decide | Claude picks | |

**User's choice:** Token in query param
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-reconnect with overlay | Show 'Reconnecting...' overlay, auto-retry, manual button after ~30s | ✓ |
| Manual reconnect only | Show 'Connection lost', user clicks to reconnect | |
| You decide | Claude picks | |

**User's choice:** Auto-reconnect with overlay
**Notes:** None

---

## Claude config mounting

| Option | Description | Selected |
|--------|-------------|----------|
| Full ~/.claude read-only | Mount entire ~/.claude directory read-only. One bind mount | ✓ |
| Cherry-pick subdirectories | Mount specific dirs individually | |
| You decide | Claude picks | |

**User's choice:** Full ~/.claude read-only
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Environment variable at start | Pass ANTHROPIC_API_KEY as env var in Compose file | ✓ |
| Mounted credentials file | Mount credentials file read-only | |
| User handles it manually | User runs 'claude login' each time | |
| You decide | Claude picks | |

**User's choice:** Environment variable at start
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Fully read-only | All ~/.claude is read-only. History stays in container volume | ✓ |
| Read-write for specific paths | Most read-only, specific dirs writable | |
| You decide | Claude picks | |

**User's choice:** Fully read-only
**Notes:** None

---

## Terminal capabilities

| Option | Description | Selected |
|--------|-------------|----------|
| Basic mobile support | Renders on mobile, accepts touch input. No special gestures | ✓ |
| Mobile-optimized | Touch-friendly controls, on-screen Ctrl/Alt/Tab buttons, swipe gestures | |
| Desktop only for now | Don't worry about mobile | |

**User's choice:** Basic mobile support
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| addon-fit | Auto-resize terminal to container | ✓ |
| addon-web-links | Clickable URLs in terminal output | ✓ |
| addon-search | Ctrl+F search through scrollback | ✓ |
| addon-clipboard | Improved clipboard handling | ✓ |

**User's choice:** All four addons selected
**Notes:** User asked about Warp terminal — clarified it's a native desktop app, not embeddable in browser. xterm.js confirmed.

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal header only | Back button, env name, status, tab bar. Max terminal space | ✓ |
| Collapsible sidebar | Optional sidebar with container stats and quick actions | |
| You decide | Claude picks | |

**User's choice:** Minimal header only
**Notes:** None

---

## Claude's Discretion

- Socket.IO namespace structure
- Docker exec command construction and PTY allocation
- Terminal token generation mechanism
- xterm.js theme/font configuration
- Tab lifecycle management
- Socket.IO server integration approach

## Deferred Ideas

None — discussion stayed within phase scope
