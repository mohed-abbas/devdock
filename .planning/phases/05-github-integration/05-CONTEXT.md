# Phase 5: GitHub Integration - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can connect their GitHub account via OAuth and create dev environments directly from their repositories, including private ones. This phase delivers: GitHub OAuth connection/disconnection from a settings page, searchable repo dropdown in the creation dialog, branch selection, clone-on-create (host-side), and encrypted token storage. No dashboard polish (Phase 6), no resource limits (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### OAuth Connection Flow
- **D-01:** Dedicated `/dashboard/settings` page with a "Connect GitHub" button. This is the primary entry point for GitHub OAuth. Settings page can later hold other integrations.
- **D-02:** After OAuth completes, redirect back to `/dashboard/settings` with a success toast ("GitHub connected"). User sees their GitHub username/avatar displayed on the settings page.
- **D-03:** "Disconnect GitHub" button on the settings page. Deletes the stored encrypted token from the database. Existing environments keep their cloned code but lose GitHub API features.

### Repo Browsing UX
- **D-04:** Searchable combobox/dropdown inside the existing creation dialog. Replaces the manual URL field when GitHub is connected. Falls back to the original URL field if GitHub not connected, with a hint to connect.
- **D-05:** Fetch all accessible repos on dropdown open (paginated from GitHub API). Cache for ~5 minutes. Client-side filtering as user types. Works well for up to ~500 repos.
- **D-06:** Each repo displayed as `owner/repo` with a small lock icon for private repos. Sorted by most recently pushed. Minimal, scannable.

### Clone-on-Create Behavior
- **D-07:** When GitHub is connected, the creation dialog shows the repo dropdown instead of the manual URL field. A small "Enter URL manually" link below lets users switch back for non-GitHub repos (GitLab, Bitbucket).
- **D-08:** After selecting a repo, an optional branch dropdown appears with the default branch pre-selected. User can change or leave as default. The `branch` column already exists in the schema.
- **D-09:** Clone happens on the host before container start — into the environment's workspace directory. Uses the stored GitHub token for private repo authentication. Code is ready when the terminal opens.

### Token Encryption & Storage
- **D-10:** New `github_accounts` table: id, userId (FK to users), githubUsername, avatarUrl, encryptedAccessToken, scopes, connectedAt. Clean separation from users table, easy to delete on disconnect.
- **D-11:** `GITHUB_TOKEN_ENCRYPTION_KEY` env var (32-byte key). Encrypt/decrypt using Node.js `crypto` with AES-256-GCM (authenticated encryption). No external dependencies.
- **D-12:** OAuth scope: `repo` — grants full access to public and private repos. Standard for dev tools that need to clone private repos.

### Claude's Discretion
- Auth.js GitHub OAuth provider configuration details
- OAuth callback route structure (`/api/auth/callback/github` or custom)
- GitHub API pagination strategy for repo fetching
- Repo cache implementation (in-memory or lightweight)
- Settings page layout and component structure
- Combobox component choice (shadcn/ui Combobox or custom)
- Error handling for expired/revoked GitHub tokens
- Clone command construction (git clone with token in URL or credential helper)
- How the creation dialog detects GitHub connection state

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Stack
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, coexistence strategy
- `.planning/research/STACK.md` — Technology choices (Octokit, Auth.js GitHub provider, OAuth App approach)

### Security
- `.planning/research/PITFALLS.md` — Token storage, credential leakage vectors

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-05, GH-01 through GH-05 are this phase's scope

### Schema
- `src/lib/db/schema.ts` — Users table, environments table with `repoUrl` and `branch` columns already defined

### Auth
- `src/auth.ts` — Current Auth.js config with Credentials provider (GitHub provider will be added here)
- `src/auth.config.ts` — Edge-safe auth config (providers array populated in auth.ts)

### Config
- `src/lib/config.ts` — Existing env var validation via zod (GITHUB_TOKEN_ENCRYPTION_KEY will be added)

### Prior Phase Context
- `.planning/phases/02-authentication/02-CONTEXT.md` — Auth.js v5 patterns, JWT sessions, middleware route protection
- `.planning/phases/03-environment-lifecycle/03-CONTEXT.md` — Environment creation dialog, compose generation, data directory layout
- `.planning/phases/04-web-terminal-claude-code/04-CONTEXT.md` — Terminal integration, ANTHROPIC_API_KEY pattern in settings

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/auth.ts` — Auth.js NextAuth config, GitHub provider plugs in alongside Credentials
- `src/auth.config.ts` — Edge-safe auth config with callbacks and session strategy
- `src/lib/config.ts` — Zod-validated env vars, extend for GITHUB_TOKEN_ENCRYPTION_KEY and GitHub OAuth client ID/secret
- `src/lib/db/schema.ts` — Users and environments tables, extend with github_accounts table
- `src/app/dashboard/_components/create-environment-dialog.tsx` — Existing creation dialog with manual repo URL field (to be enhanced with repo dropdown)
- `src/hooks/use-environments.ts` — Polling/fetching hook pattern, can inform repo fetching hook
- `src/components/ui/` — shadcn/ui Button, Card, Badge, Input, Label components
- `src/middleware.ts` — Auth middleware protecting dashboard and API routes

### Established Patterns
- Dark mode by default, Inter font, Tailwind CSS + shadcn/ui
- Drizzle ORM for database access with zod validation
- Auth.js v5 JWT sessions with edge-safe config split
- API routes under `src/app/api/`
- Dashboard `_components/` directory for page-specific client components
- Server actions pattern (`src/lib/auth/actions.ts`)
- Docker operations via `execFile` for CLI, dockerode for inspection

### Integration Points
- `src/auth.ts` — Add GitHub OAuth provider alongside Credentials
- `src/lib/config.ts` — Add GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_TOKEN_ENCRYPTION_KEY
- `src/lib/db/schema.ts` — Add github_accounts table
- `src/app/dashboard/` — New `/dashboard/settings` page route
- `src/app/dashboard/_components/create-environment-dialog.tsx` — Enhance with repo dropdown and branch selector
- `src/app/api/` — New routes for GitHub repo listing, token management

</code_context>

<specifics>
## Specific Ideas

- The creation dialog enhancement should feel seamless — when GitHub is connected, the dropdown is the default experience, with manual URL as a secondary option via link
- Branch selection should be optional and non-intrusive — default branch pre-selected, user can change if they want
- Settings page is the single place for GitHub connection management — clean, no scattered UI

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-github-integration*
*Context gathered: 2026-04-14*
