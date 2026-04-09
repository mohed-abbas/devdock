# Phase 3: Environment Lifecycle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 03-environment-lifecycle
**Areas discussed:** Creation flow, Real-time status, Compose generation, Data directory layout

---

## Creation flow

| Option | Description | Selected |
|--------|-------------|----------|
| Name + manual repo URL | User enters a name and optionally pastes a Git repo URL. Phase 5 adds GitHub browse-and-select later. | ✓ |
| Name only, empty workspace | No repo cloning at all in Phase 3. | |
| Name + repo URL + branch | Also lets user specify a branch. | |

**User's choice:** Name + manual repo URL
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox selection | Simple checkboxes: PostgreSQL, Redis. Checked sidecars uncommented in Compose file. | ✓ |
| No sidecar choice | Always base template as-is. User edits manually. | |
| You decide | Claude picks. | |

**User's choice:** Checkbox selection
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog on dashboard | "New Environment" button opens a modal/sheet. Keeps user in context. | ✓ |
| Dedicated page | Full-page form at /dashboard/environments/new. | |
| You decide | Claude picks. | |

**User's choice:** Modal dialog on dashboard
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-start after creation | Environment created and immediately started. User sees transition from 'starting' to 'running'. | ✓ |
| Create as stopped | Created in 'stopped' state. User must explicitly click 'Start'. | |

**User's choice:** Auto-start after creation
**Notes:** None

---

## Real-time status

| Option | Description | Selected |
|--------|-------------|----------|
| Polling | Dashboard polls API every 3-5 seconds. Simple, stateless, works everywhere. | ✓ |
| Server-Sent Events (SSE) | Server pushes status updates via SSE. Lower latency than polling. | |
| PostgreSQL LISTEN/NOTIFY + SSE | DB triggers fire on status change, pushed to browser via SSE. Most reactive. | |

**User's choice:** Polling
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Status enum only | Existing status enum (stopped/starting/running/stopping/error) is sufficient. | ✓ |
| Status + progress steps | Show intermediate steps like 'Pulling image...', 'Creating network...'. | |
| You decide | Claude picks. | |

**User's choice:** Status enum only
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Status badge + tooltip | Red 'Error' badge with hover/click short error message. Error stored in DB column. | ✓ |
| Status badge only | Just show 'Error'. User checks Docker logs manually. | |
| You decide | Claude picks. | |

**User's choice:** Status badge + tooltip
**Notes:** None

---

## Compose generation

| Option | Description | Selected |
|--------|-------------|----------|
| String substitution | Read template, replace variables, uncomment sidecars. Simple and transparent. | ✓ |
| Programmatic YAML build | Parse template with 'yaml' library, manipulate object. More robust. | |
| You decide | Claude picks. | |

**User's choice:** String substitution
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| No editing in Phase 3 | Compose generated once. Power users edit via terminal in Phase 4. | ✓ |
| Simple editor in UI | Textarea or code editor in environment settings. | |
| You decide | Claude picks. | |

**User's choice:** No editing in Phase 3
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| docker compose CLI via child_process | Shell out to 'docker compose' for up/down/rm. Debuggable. dockerode for inspection only. | ✓ |
| dockerode only | Programmatic control for everything. Reimplements Compose logic. | |
| You decide | Claude picks. | |

**User's choice:** docker compose CLI via child_process
**Notes:** None

---

## Data directory layout

| Option | Description | Selected |
|--------|-------------|----------|
| Flat by slug | data/{env-slug}/docker-compose.yml + workspace/. Simple, one dir per environment. | ✓ |
| Nested by user ID | data/{user-id}/{env-slug}/... Separates by user. Extra directory level. | |
| You decide | Claude picks. | |

**User's choice:** Flat by slug
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Full cleanup | Delete removes containers, network, volumes, AND data directory. User warned. | ✓ |
| Keep workspace on disk | Delete removes Docker resources but leaves workspace as backup. | |
| You decide | Claude picks. | |

**User's choice:** Full cleanup
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation dialog | Modal: "Are you sure?" with Cancel/Delete buttons. | ✓ |
| Type name to confirm | Like GitHub's pattern. Extra safety. | |
| You decide | Claude picks. | |

**User's choice:** Confirmation dialog
**Notes:** None

---

## Claude's Discretion

- Exact polling interval (3-5 second range)
- Docker Compose project naming convention
- Error message extraction from Docker output
- Slug generation from environment name
- API route structure for environment CRUD
- Form validation approach
- How repo cloning is handled

## Deferred Ideas

None — discussion stayed within phase scope
