# Phase 6: Dashboard & Monitoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 06-dashboard-monitoring
**Areas discussed:** Production apps view, Container logs UI, Preview URLs / port forwarding, Dashboard layout polish, Modularity & edge cases

---

## Production Apps View

### Discovery Method

| Option | Description | Selected |
|--------|-------------|----------|
| Scan Docker containers | Discover by listing running Docker containers/compose projects under production dir. Real-time status. No manual config. | :heavy_check_mark: |
| Scan filesystem directories | Read directory names under /home/murx/apps/. Simpler but no live status. | |
| Manual config file | JSON/YAML file listing apps. Most control but manual maintenance. | |

**User's choice:** Scan Docker containers
**Notes:** None

### Card Information

| Option | Description | Selected |
|--------|-------------|----------|
| Status + uptime + ports | Container status, uptime duration, exposed ports. Glanceable. | :heavy_check_mark: |
| Status + uptime + ports + resource usage | All above plus CPU/memory. Heavier (Docker stats polling). | |
| Status only | Minimal, just running/stopped. Limited monitoring value. | |

**User's choice:** Status + uptime + ports
**Notes:** None

### Card Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Strictly read-only | No start/stop/delete. View-only monitoring. | :heavy_check_mark: |
| View logs only | Read-only with log viewing button. | |
| Full controls | Same start/stop as dev environments. Risky for production. | |

**User's choice:** Strictly read-only
**Notes:** None

---

## Container Logs UI

### Display Method

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated logs page | Full-page route at /dashboard/env/[id]/logs. Clean separation. | :heavy_check_mark: |
| Slide-out panel | Side panel on dashboard. Less screen space. | |
| Inline expandable | Expand below card. Compact but limited. | |

**User's choice:** Dedicated logs page
**Notes:** User previewed the mockup and confirmed

### Log Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Main container only | Primary dev container logs. Sidecars are noise. | :heavy_check_mark: |
| All containers with selector | Dropdown to switch between containers. More complete. | |
| Combined stream | All merged with prefixes. Can be noisy. | |

**User's choice:** Main container only
**Notes:** None

### Transport

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Socket.IO | Same server as terminal. Add logs namespace. No new infra. | :heavy_check_mark: |
| Server-Sent Events | One-way SSE from API route. Separate from terminal. | |
| Polling API | REST endpoint on interval. Not real-time. | |

**User's choice:** Reuse Socket.IO
**Notes:** None

---

## Preview URLs / Port Forwarding

### Proxy Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Path-based proxy | devdock.example.com/preview/{env-slug}/. No wildcard DNS. | :heavy_check_mark: |
| Subdomain-based proxy | my-project.devdock.example.com. Needs wildcard DNS + cert. | |
| Direct port exposure | Expose ports on VPS. Breaks INFRA-05. | |

**User's choice:** Path-based proxy
**Notes:** User previewed nginx config example

### Port Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| User specifies port at creation | Optional field, default 3000. Stored in DB. Predictable. | :heavy_check_mark: |
| Auto-detect exposed ports | Scan container for listening ports. May find multiple. | |
| You decide | Claude picks best approach. | |

**User's choice:** User specifies port at creation
**Notes:** None

### URL Surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Button on environment card | Preview button with external link icon, next to Terminal. New tab. | :heavy_check_mark: |
| Link in detail page | Preview URL on detail page. Less discoverable. | |
| Copy URL button | Copy button instead of direct link. Adds a step. | |

**User's choice:** Button on environment card
**Notes:** None

---

## Dashboard Layout Polish

### Section Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Two sections on one page | Dev Environments at top, Production Apps below. Same page. | :heavy_check_mark: |
| Tabs (Dev / Production) | Tab navigation. Clean but requires switching. | |
| Sidebar navigation | Left sidebar with section links. Heavier. | |

**User's choice:** Two sections on one page
**Notes:** User previewed the mockup and confirmed

### Card Density

| Option | Description | Selected |
|--------|-------------|----------|
| Add preview port + logs button | Keep current layout, add Preview and Logs buttons to footer. | :heavy_check_mark: |
| Current cards are fine | No changes. New buttons go elsewhere. | |
| Richer cards with more metadata | Add branch, sidecars, resources. Busier. | |

**User's choice:** Add preview port + logs button
**Notes:** None

### Card Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Same card, different badge | Reuse Card component with Production badge. No action buttons. | :heavy_check_mark: |
| Different card style | Distinct visual treatment. Two styles to maintain. | |
| You decide | Claude picks best approach. | |

**User's choice:** Same card, different badge
**Notes:** None

---

## Modularity & Edge Cases

### No Production Apps

| Option | Description | Selected |
|--------|-------------|----------|
| Hide section entirely | Section doesn't render. Dashboard shows only dev environments. | :heavy_check_mark: |
| Show empty state message | Section header with "No production apps detected" message. | |
| You decide | Claude picks natural approach. | |

**User's choice:** Hide section entirely
**Notes:** User emphasized modularity -- production monitoring should be opt-in

### Production Apps Path

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable via env var | PRODUCTION_APPS_DIR env var with default. Reusable on other setups. | :heavy_check_mark: |
| Hardcoded path | /home/murx/apps/ hardcoded. Simpler but ties to specific VPS. | |
| You decide | Claude picks most maintainable. | |

**User's choice:** Configurable via env var
**Notes:** None

---

## Claude's Discretion

- Nginx dynamic proxy rule management
- Log page UI controls (auto-scroll, search, clear)
- Log buffer size in browser
- Production app Docker discovery heuristics
- Preview port field placement in creation dialog
- Production card badge styling
- Socket.IO logs namespace structure
- Production app uptime calculation

## Deferred Ideas

- Additional sidecar types beyond Postgres/Redis (MongoDB, MySQL, Elasticsearch)
- Production app log viewing (currently strictly read-only)
- Resource usage metrics on production cards (CPU/memory)
