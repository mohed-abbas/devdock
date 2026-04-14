# Phase 5: GitHub Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 05-github-integration
**Areas discussed:** OAuth connection flow, Repo browsing UX, Clone-on-create behavior, Token encryption & storage

---

## OAuth Connection Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page (Recommended) | Dedicated /dashboard/settings page with "Connect GitHub" button | ✓ |
| Inline in creation dialog | "Connect GitHub" button inside environment creation dialog | |
| Both | Settings page primary + nudge in creation dialog | |

**User's choice:** Settings page
**Notes:** Clean separation — connect once, use everywhere.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Back to settings (Recommended) | Redirect to /dashboard/settings with success toast | ✓ |
| Back to dashboard | Redirect to main dashboard with success toast | |
| Stay on originating page | Return to whatever page initiated the OAuth flow | |

**User's choice:** Back to settings
**Notes:** Simple and predictable post-OAuth flow.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, from settings (Recommended) | "Disconnect GitHub" button on settings page, deletes stored token | ✓ |
| No disconnect in v1 | Skip disconnect, users revoke from GitHub directly | |

**User's choice:** Yes, from settings
**Notes:** Full lifecycle management on the settings page.

---

## Repo Browsing UX

| Option | Description | Selected |
|--------|-------------|----------|
| Searchable dropdown (Recommended) | Inside creation dialog, searchable combobox replaces manual URL when GitHub connected | ✓ |
| Standalone repo browser page | Dedicated /dashboard/repos page with full repo list | |
| Two-tab toggle in dialog | Creation dialog with "From GitHub" and "Manual URL" tabs | |

**User's choice:** Searchable dropdown
**Notes:** Compact and contextual, integrates into existing creation dialog.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch all on open (Recommended) | Fetch all repos paginated, cache ~5 min, client-side filtering | ✓ |
| Search-as-you-type via API | Each keystroke queries GitHub search API | |
| Hybrid | First page upfront, fallback to search API | |

**User's choice:** Fetch all on open
**Notes:** Works well for up to ~500 repos, simpler implementation.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name + visibility (Recommended) | "owner/repo" with lock icon for private, sorted by recent push | ✓ |
| Name + description + visibility | "owner/repo" with one-line description and lock icon | |
| Full card per repo | Name, description, language, stars, last updated | |

**User's choice:** Name + visibility
**Notes:** Minimal and scannable.

---

## Clone-on-Create Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Replace when connected (Recommended) | Show dropdown instead of URL field; "Enter URL manually" link below | ✓ |
| Always show both | Dropdown and manual URL field both visible | |
| Dropdown only when connected | Only dropdown, no manual URL fallback | |

**User's choice:** Replace when connected
**Notes:** Clean default with manual fallback for non-GitHub repos.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, optional dropdown (Recommended) | Second dropdown for branches, default branch pre-selected | ✓ |
| Default branch only | Always clone default branch, no selection UI | |
| You decide | Claude's discretion | |

**User's choice:** Yes, optional dropdown
**Notes:** Schema already has a `branch` column ready for this.

---

| Option | Description | Selected |
|--------|-------------|----------|
| On host before start (Recommended) | Clone into workspace dir on host, then start container with volume mount | ✓ |
| Inside the container | Start container first, then git clone inside | |
| You decide | Claude's discretion | |

**User's choice:** On host before start
**Notes:** Faster UX — code ready when terminal opens. Uses stored GitHub token for private repos.

---

## Token Encryption & Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Separate github_accounts table (Recommended) | New table with id, userId, githubUsername, avatarUrl, encryptedAccessToken, scopes, connectedAt | ✓ |
| Columns on users table | Add GitHub columns directly to users table | |
| You decide | Claude's discretion | |

**User's choice:** Separate github_accounts table
**Notes:** Clean separation, easy to extend for future providers, simple to delete on disconnect.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Env var with AES-256-GCM (Recommended) | GITHUB_TOKEN_ENCRYPTION_KEY env var (32-byte key), Node.js crypto | ✓ |
| Derive from AUTH_SECRET | Use HKDF to derive key from existing AUTH_SECRET | |
| You decide | Claude's discretion | |

**User's choice:** Env var with AES-256-GCM
**Notes:** Simple, no external dependencies. Key added to .env alongside AUTH_SECRET.

---

| Option | Description | Selected |
|--------|-------------|----------|
| repo (Recommended) | Full access to public and private repos (read/write) | ✓ |
| repo (read-only) | Same scope, document read-only intent | |
| You decide | Claude's discretion | |

**User's choice:** repo scope
**Notes:** Standard for dev tools that need to clone private repos.

---

## Claude's Discretion

- Auth.js GitHub OAuth provider configuration details
- OAuth callback route structure
- GitHub API pagination strategy
- Repo cache implementation
- Settings page layout and component structure
- Combobox component choice
- Error handling for expired/revoked tokens
- Clone command construction
- Creation dialog GitHub connection state detection

## Deferred Ideas

None — discussion stayed within phase scope
