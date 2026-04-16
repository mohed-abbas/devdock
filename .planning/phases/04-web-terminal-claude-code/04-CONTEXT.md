# Phase 4: Web Terminal & Claude Code - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can open a browser-based terminal into any running environment with Claude Code and shared developer tools ready to use. This phase delivers the xterm.js terminal UI, Socket.IO WebSocket transport, Docker exec integration, tabbed multi-terminal support, and ~/.claude config mounting. No dashboard UI polish (Phase 6), no resource limits (Phase 7), no GitHub integration (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Terminal Access UX
- **D-01:** Dedicated terminal page at `/dashboard/env/[id]/terminal`. Full-screen terminal with a small header bar (back button, environment name, status indicator). Clicking "Terminal" on an environment card navigates here.
- **D-02:** Tabbed terminals — tab bar above the terminal area with a "+" button to open new tabs. Each tab is a separate Docker exec session. Enables running Claude Code in one tab and commands in another.
- **D-03:** Default shell is bash, running as the `dev` user (matches base Dockerfile).

### WebSocket Transport
- **D-04:** Socket.IO for terminal I/O. Auto-reconnect, long-polling fallback, and namespaces for separating terminal sessions. Already specified in the tech stack.
- **D-05:** WebSocket authentication via short-lived token in query parameter. API generates a token, client passes `?token=xxx` when connecting. Server validates before upgrading.
- **D-06:** Auto-reconnect with overlay — show "Reconnecting..." overlay on the terminal during disconnection. If reconnect fails after ~30s, show "Connection lost" with a manual retry button.

### Claude Config Mounting
- **D-07:** Full `~/.claude` directory mounted read-only into containers. One bind mount — GSD workflows, SuperClaude skills, settings, agents all available.
- **D-08:** ANTHROPIC_API_KEY (or Claude Max session token) provided as an environment variable in the Compose file. User sets it once in DevDock settings, it's injected at environment start.
- **D-09:** Fully read-only mount — containers cannot write back to host ~/.claude. Claude Code conversation history stays in the container's own volume.

### Terminal Capabilities
- **D-10:** Basic mobile support — terminal renders on mobile browsers and accepts touch input. No special mobile keyboard or touch gestures. Usable for quick checks, not optimized for long sessions.
- **D-11:** xterm.js addons: addon-fit (auto-resize), addon-web-links (clickable URLs), addon-search (Ctrl+F scrollback search), addon-clipboard (cross-browser copy/paste).
- **D-12:** Minimal header only on the terminal page — back button, environment name, status indicator, tab bar. Maximum screen space for the terminal.

### Claude's Discretion
- Socket.IO namespace structure for terminal sessions
- Docker exec command construction and PTY allocation
- Terminal token generation/validation mechanism (JWT or nanoid with expiry)
- xterm.js theme/font configuration (should match dark mode aesthetic)
- Tab lifecycle management (max tabs, tab naming)
- Socket.IO server integration with Next.js (custom server or separate process)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Stack
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, coexistence strategy
- `.planning/research/STACK.md` — Technology choices (xterm.js, Socket.IO, dockerode)

### Security
- `.planning/research/PITFALLS.md` — Docker socket access restrictions (INFRA-04), terminal auth (Pitfall #2), no published ports (INFRA-05)

### Requirements
- `.planning/REQUIREMENTS.md` — TERM-01 through TERM-05 are this phase's scope

### Schema & Config
- `src/lib/db/schema.ts` — Environments table with status enum, slug, dockerProjectName
- `src/lib/config.ts` — DOCKER_SOCKET, DEVDOCK_DATA_DIR config

### Docker
- `docker/templates/base-compose.yml` — Compose template with commented ~/.claude mount line (needs uncommenting/resolving)
- `docker/base/Dockerfile` — Base image with Claude Code CLI, `dev` user, bash shell
- `src/lib/docker/docker-service.ts` — Existing Docker operations (compose up/down/stop, dockerode instance)

### Prior Phase Context
- `.planning/phases/01-foundation-infrastructure/01-CONTEXT.md` — VPS specs (8GB RAM), base image decisions, Docker daemon config
- `.planning/phases/02-authentication/02-CONTEXT.md` — Auth.js v5 patterns, middleware route protection, JWT sessions
- `.planning/phases/03-environment-lifecycle/03-CONTEXT.md` — Docker lifecycle operations, polling for status, compose generation via template substitution

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/docker/docker-service.ts` — dockerode instance already initialized, exec can be added here
- `src/lib/config.ts` — Environment config with zod validation, can extend for ANTHROPIC_API_KEY
- `src/hooks/use-environments.ts` — Polling hook pattern, can inform terminal state management
- `src/components/ui/` — shadcn/ui Button, Card, Badge, Skeleton components available
- `src/app/dashboard/_components/` — Dashboard component pattern (client components in `_components/`)
- `src/middleware.ts` — Auth middleware protecting `/dashboard/*` and `/api/*` routes

### Established Patterns
- Dark mode by default, Inter font, Tailwind CSS + shadcn/ui
- Drizzle ORM for database access
- Zod for runtime validation
- Auth.js v5 JWT sessions with middleware-based route protection
- Docker operations via `execFile` (shell injection prevention) for compose CLI, dockerode for inspection
- API routes under `src/app/api/`
- Dashboard `_components/` directory for page-specific client components

### Integration Points
- `src/app/dashboard/` — New terminal page route: `/dashboard/env/[id]/terminal`
- Environment card (existing) — Needs "Terminal" button linking to terminal page
- `src/lib/docker/docker-service.ts` — Add Docker exec function for terminal sessions
- `docker/templates/base-compose.yml` — Uncomment and configure ~/.claude mount + add ANTHROPIC_API_KEY env var
- Next.js custom server or API route — Socket.IO server needs to attach to HTTP server

</code_context>

<specifics>
## Specific Ideas

- User asked about Warp terminal — not applicable (native desktop app, not embeddable). xterm.js confirmed as the right choice for browser-based terminal.
- Tab support is important — user wants to run Claude Code in one tab and commands in another simultaneously.
- ANTHROPIC_API_KEY should be a "set once" experience — user configures it in DevDock settings, it auto-injects into every environment.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-web-terminal-claude-code*
*Context gathered: 2026-04-13*
