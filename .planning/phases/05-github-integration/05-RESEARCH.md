# Phase 5: GitHub Integration - Research

**Researched:** 2026-04-14
**Domain:** GitHub OAuth, Octokit API, AES-256-GCM encryption, Next.js API routes
**Confidence:** HIGH

## Summary

Phase 5 adds GitHub account linking (not GitHub login) to an existing Credentials-based auth system, plus repo browsing/selection in the environment creation dialog. The critical architectural decision is that Auth.js's built-in GitHub provider is designed for *authentication* (sign-in via GitHub), but this phase needs *account linking* (already-authenticated user connects GitHub for API access). The cleanest approach is a **manual OAuth flow** via custom Next.js API routes, completely separate from Auth.js, storing encrypted tokens in a new `github_accounts` table.

The phase touches four distinct areas: (1) OAuth flow with CSRF protection, (2) encrypted token storage with AES-256-GCM, (3) GitHub API integration via Octokit for repo/branch listing, and (4) UI enhancements to the settings page and creation dialog. The existing `cloneRepo` function in `docker-service.ts` needs modification to accept an auth token for private repo cloning.

**Primary recommendation:** Implement a manual OAuth flow (custom `/api/github/authorize` and `/api/github/callback` routes) rather than using Auth.js's GitHub provider. Use `@octokit/rest` for API calls. Encrypt tokens with Node.js `crypto` AES-256-GCM. No external encryption libraries needed.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dedicated `/dashboard/settings` page with a "Connect GitHub" button
- **D-02:** After OAuth, redirect back to `/dashboard/settings` with success toast. Show GitHub username/avatar
- **D-03:** "Disconnect GitHub" button deletes encrypted token from database
- **D-04:** Searchable combobox/dropdown in creation dialog replaces manual URL field when GitHub connected
- **D-05:** Fetch all repos on dropdown open (paginated), cache ~5 minutes, client-side filtering
- **D-06:** Repos displayed as `owner/repo` with lock icon for private, sorted by recently pushed
- **D-07:** When connected, repo dropdown is default; "Enter URL manually" link for non-GitHub repos
- **D-08:** Optional branch dropdown after repo selected, default branch pre-selected
- **D-09:** Clone happens on host before container start, uses stored token for private repos
- **D-10:** New `github_accounts` table: id, userId, githubUsername, avatarUrl, encryptedAccessToken, scopes, connectedAt
- **D-11:** `GITHUB_TOKEN_ENCRYPTION_KEY` env var (32-byte key), AES-256-GCM via Node.js `crypto`
- **D-12:** OAuth scope: `repo` for full access to public and private repos

### Claude's Discretion
- Auth.js GitHub OAuth provider configuration details
- OAuth callback route structure
- GitHub API pagination strategy for repo fetching
- Repo cache implementation (in-memory or lightweight)
- Settings page layout and component structure
- Combobox component choice (shadcn/ui Combobox or custom)
- Error handling for expired/revoked GitHub tokens
- Clone command construction (git clone with token in URL or credential helper)
- How the creation dialog detects GitHub connection state

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-05 | User can connect their GitHub account via OAuth for repo access | Manual OAuth flow via custom API routes; `github_accounts` table stores encrypted tokens |
| GH-01 | User can connect their GitHub account via OAuth | `/api/github/authorize` redirects to GitHub; `/api/github/callback` exchanges code for token |
| GH-02 | User can browse their accessible repositories from the dashboard | `@octokit/rest` `repos.listForAuthenticatedUser()` with pagination; cached in-memory ~5min |
| GH-03 | User can select a repo to clone when creating an environment | Enhanced creation dialog with Popover+Command combobox; selected repo URL passed to existing create API |
| GH-04 | GitHub OAuth tokens are stored encrypted at rest | AES-256-GCM via Node.js `crypto`, 32-byte key from env var, random 12-byte IV per encryption |
| GH-05 | Private repositories are accessible with proper OAuth scopes | `repo` scope grants full read/write on public and private repos |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @octokit/rest | ^22.0.1 | GitHub REST API client | Official GitHub SDK. Type-safe. Handles pagination, rate limiting headers. [VERIFIED: npm registry] |
| Node.js crypto | built-in | AES-256-GCM encryption | No external deps. Standard for authenticated encryption. [VERIFIED: Node.js docs] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^2.0.7 | Toast notifications | OAuth success/error feedback. UI-SPEC requires toasts. [VERIFIED: npm registry] |

### Not Using (Deliberate Omissions)
| Library | Why Not |
|---------|---------|
| @octokit/auth-oauth-app | Only needed for server-to-server OAuth. The manual flow (redirect + code exchange via fetch) is simpler for this use case. |
| Auth.js GitHub provider | Designed for *login via GitHub*, not *account linking*. Using it would fight the Credentials-based auth pattern already in place. The manual flow gives full control over token storage and avoids Auth.js adapter complexity. [ASSUMED -- based on Auth.js architecture analysis] |

**Installation:**
```bash
npm install @octokit/rest sonner
npx shadcn@latest add popover command avatar select
```

**Version verification:**
- @octokit/rest: 22.0.1 [VERIFIED: npm registry 2026-04-14]
- sonner: 2.0.7 [VERIFIED: npm registry 2026-04-14]
- next-auth installed: 5.0.0-beta.30 [VERIFIED: local package.json]

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    api/
      github/
        authorize/route.ts      # Redirects to GitHub OAuth
        callback/route.ts        # Exchanges code for token, stores encrypted
        repos/route.ts           # GET: lists user repos (paginated, cached)
        repos/[owner]/[repo]/branches/route.ts  # GET: lists branches
        disconnect/route.ts      # POST: deletes github_accounts row
        connection/route.ts      # GET: returns connection status
    dashboard/
      settings/
        page.tsx                 # Server component: settings page shell
        _components/
          github-connection-card.tsx  # Client component: connect/disconnect
  lib/
    github/
      encryption.ts              # AES-256-GCM encrypt/decrypt functions
      oauth.ts                   # OAuth URL builder, token exchange
      client.ts                  # Octokit instance factory from decrypted token
  hooks/
    use-github-connection.ts     # Client hook: GitHub connection state
    use-github-repos.ts          # Client hook: repo list with cache
    use-github-branches.ts       # Client hook: branch list for selected repo
  lib/db/
    schema.ts                    # Add github_accounts table
```

### Pattern 1: Manual OAuth Flow (Not Auth.js Provider)
**What:** Custom API routes handle the full GitHub OAuth authorization code flow
**When to use:** When OAuth is for *account linking* (connecting an external service), not for *authentication* (logging in)
**Why not Auth.js:** Auth.js GitHub provider is designed to authenticate users. Here, the user is already authenticated via Credentials. Using Auth.js's built-in linking requires a database adapter (not JWT sessions), and the complexity of account linking callbacks. A manual flow is ~50 lines total and gives full control. [CITED: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps]

**Example:**
```typescript
// src/lib/github/oauth.ts
import crypto from 'crypto';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'repo',
    state,
  });
  return `${GITHUB_AUTHORIZE_URL}?${params}`;
}

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<{ access_token: string; scope: string }> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) throw new Error('Token exchange failed');
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}
```
[CITED: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps]

### Pattern 2: AES-256-GCM Token Encryption
**What:** Encrypt GitHub access tokens before storing, decrypt on use
**When to use:** Any time secrets are stored in the database (D-11)
**Example:**
```typescript
// src/lib/github/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits, recommended for GCM
const TAG_LENGTH = 16; // 128 bits

export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex'); // 32 bytes from 64-char hex
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as: iv:tag:ciphertext (all hex-encoded)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(stored: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const [ivHex, tagHex, encHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```
[CITED: https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81, https://nodejs.org/api/crypto.html]

### Pattern 3: CSRF State via HTTP-only Cookie
**What:** Store OAuth state parameter in an HTTP-only cookie to prevent CSRF
**When to use:** OAuth authorize/callback flows
**Example:**
```typescript
// In /api/github/authorize/route.ts
import { cookies } from 'next/headers';
import { generateState, buildAuthorizeUrl } from '@/lib/github/oauth';
import { config } from '@/lib/config';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const state = generateState();
  const cookieStore = await cookies();
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const url = buildAuthorizeUrl(
    config.GITHUB_CLIENT_ID,
    `${config.AUTH_URL}/api/github/callback`,
    state,
  );
  return Response.redirect(url);
}
```
[CITED: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps]

### Pattern 4: Octokit Instance from Decrypted Token
**What:** Create an authenticated Octokit instance on-demand for each API request
**When to use:** Any GitHub API call (repo listing, branch listing)
**Example:**
```typescript
// src/lib/github/client.ts
import { Octokit } from '@octokit/rest';
import { decrypt } from './encryption';
import { config } from '@/lib/config';

export function createOctokit(encryptedToken: string): Octokit {
  const token = decrypt(encryptedToken, config.GITHUB_TOKEN_ENCRYPTION_KEY);
  return new Octokit({ auth: token });
}
```

### Pattern 5: In-Memory Repo Cache
**What:** Simple Map-based cache with TTL for repo listings per user
**When to use:** Avoid hitting GitHub API on every combobox open (D-05: cache ~5 minutes)
**Example:**
```typescript
// In-memory cache, acceptable for single-server deployment
const repoCache = new Map<string, { data: Repo[]; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedRepos(userId: string): Repo[] | null {
  const entry = repoCache.get(userId);
  if (!entry || Date.now() > entry.expiry) {
    repoCache.delete(userId);
    return null;
  }
  return entry.data;
}
```
[ASSUMED -- standard pattern for single-server in-memory caching]

### Pattern 6: Clone with Token Authentication
**What:** Modify `cloneRepo` to embed token in HTTPS URL for private repos
**When to use:** D-09: clone on host before container start
**Example:**
```typescript
// Modified cloneRepo signature
export async function cloneRepo(
  repoUrl: string,
  targetDir: string,
  branch?: string,
  token?: string,
): Promise<DockerServiceResult> {
  let authUrl = repoUrl;
  if (token && repoUrl.startsWith('https://github.com/')) {
    // Embed token in URL: https://x-access-token:TOKEN@github.com/owner/repo.git
    authUrl = repoUrl.replace('https://github.com/', `https://x-access-token:${token}@github.com/`);
  }

  const args = ['clone', '--depth', '1'];
  if (branch) args.push('--branch', branch);
  args.push(authUrl, targetDir);

  try {
    await execFile('git', args);
    return { success: true };
  } catch (err: unknown) {
    const error = err as Error & { stderr?: string };
    // Sanitize error to never leak token
    const message = (error.stderr || error.message).replace(token ?? '', '***');
    return { success: false, error: message.slice(0, 500) };
  }
}
```
[CITED: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps -- token-in-URL pattern is standard for GitHub HTTPS auth]

### Anti-Patterns to Avoid
- **Using Auth.js GitHub provider for account linking:** Auth.js expects GitHub to be a login method. Using it for "connect your GitHub" alongside Credentials requires a database adapter, account linking callbacks, and session juggling that is unnecessary complexity.
- **Storing tokens in plaintext:** Even in a single-user tool, encrypted at rest is a hard requirement (GH-04).
- **Leaking tokens in error messages:** The `cloneRepo` modification must sanitize stderr output to remove any embedded tokens.
- **Storing the encryption key in the database:** The `GITHUB_TOKEN_ENCRYPTION_KEY` must only exist in env vars, never persisted alongside the encrypted data.
- **Reusing IVs:** Every encryption call must generate a fresh random IV. Never use a static IV.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub API client | Custom fetch wrapper for repos/branches | @octokit/rest | Handles pagination, rate limits, types, error handling |
| Searchable dropdown | Custom dropdown with filter | shadcn Popover + Command | Accessible, keyboard-navigable, battle-tested |
| Branch selector | Custom select | shadcn Select | Accessible, consistent styling |
| Toast notifications | Custom notification system | sonner | Required by UI-SPEC, lightweight, one import |
| Encryption | Custom cipher chaining | Node.js crypto AES-256-GCM | Standard, audited, no external deps |

**Key insight:** The OAuth flow itself is simple enough to hand-roll (it is just two HTTP requests). But the GitHub API interaction and UI components are not -- use Octokit and shadcn.

## Common Pitfalls

### Pitfall 1: Auth.js Conflicting with Manual OAuth
**What goes wrong:** Adding GitHub as an Auth.js provider creates a `/api/auth/callback/github` route that intercepts OAuth callbacks, creating conflicts with the manual flow.
**Why it happens:** Auth.js auto-registers callback routes for all configured providers.
**How to avoid:** Do NOT add GitHub to the Auth.js providers array. Keep GitHub OAuth entirely in custom `/api/github/*` routes.
**Warning signs:** Unexpected redirects to `/api/auth/callback/github`.

### Pitfall 2: Token Leakage in Git Clone Errors
**What goes wrong:** If `git clone` fails, stderr output contains the full URL including the embedded token.
**Why it happens:** Git includes the remote URL in error messages.
**How to avoid:** Always sanitize error messages by replacing the token with `***` before storing in the database or returning to the client.
**Warning signs:** Error messages containing `x-access-token:ghp_...` strings.

### Pitfall 3: OAuth State Cookie Not Available in Callback
**What goes wrong:** The state cookie set before redirect is not present when GitHub calls back.
**Why it happens:** Cookie `sameSite` set to `strict` blocks it on cross-origin redirects. Or cookie `path` doesn't match callback URL.
**How to avoid:** Use `sameSite: 'lax'` (allows cookies on top-level navigations) and `path: '/'`.
**Warning signs:** State mismatch errors on every OAuth attempt.

### Pitfall 4: GitHub API Rate Limiting
**What goes wrong:** Authenticated GitHub API has a 5000 req/hour limit. Rapid combobox opens without caching can burn through this.
**Why it happens:** No caching of repo/branch listings.
**How to avoid:** Cache repo list for 5 minutes per D-05. Cache branch list per repo for the session.
**Warning signs:** 403 responses from GitHub API with `X-RateLimit-Remaining: 0`.

### Pitfall 5: Encryption Key Format Mismatch
**What goes wrong:** Encryption/decryption fails silently or throws cryptic errors.
**Why it happens:** The 32-byte key must be provided as 64-character hex string. Users might provide a 32-character ASCII string instead.
**How to avoid:** Validate key format in config.ts: `z.string().regex(/^[0-9a-f]{64}$/i)`. Document key generation: `openssl rand -hex 32`.
**Warning signs:** "Invalid key length" errors from Node.js crypto.

### Pitfall 6: GitHub Token Revocation / Expiry
**What goes wrong:** User revokes the OAuth app on GitHub, but DevDock still thinks it is connected.
**Why it happens:** OAuth access tokens can be revoked at any time from GitHub settings.
**How to avoid:** When any GitHub API call returns 401, automatically mark the connection as invalid (delete from `github_accounts`) and show a toast: "GitHub connection expired. Please reconnect."
**Warning signs:** 401 responses from Octokit calls.

## Code Examples

### Database Schema Extension
```typescript
// Addition to src/lib/db/schema.ts
export const githubAccounts = pgTable('github_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  githubUsername: varchar('github_username', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  scopes: text('scopes'),  // Comma-separated scopes granted
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
});
```
[ASSUMED -- follows existing schema patterns from codebase]

### Config Extension
```typescript
// Additions to envSchema in src/lib/config.ts
GITHUB_CLIENT_ID: z.string().min(1).optional(),
GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
GITHUB_TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 
  'Must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32').optional(),
```
Note: All three are optional so DevDock works without GitHub integration configured. API routes check for their presence before proceeding. [ASSUMED -- follows existing optional config pattern like ANTHROPIC_API_KEY]

### Octokit Repo Listing with Pagination
```typescript
// src/app/api/github/repos/route.ts (simplified)
import { createOctokit } from '@/lib/github/client';

// Fetch all repos, paginated, sorted by pushed_at
const octokit = createOctokit(account.encryptedAccessToken);
const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
  sort: 'pushed',
  direction: 'desc',
  per_page: 100,
  type: 'all',  // includes private repos with 'repo' scope
});

// Return minimal data to client
return repos.map(r => ({
  id: r.id,
  fullName: r.full_name,          // owner/repo
  private: r.private,
  defaultBranch: r.default_branch,
  htmlUrl: r.html_url,
  cloneUrl: r.clone_url,
  pushedAt: r.pushed_at,
}));
```
[CITED: https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user]

### Branch Listing
```typescript
const octokit = createOctokit(account.encryptedAccessToken);
const branches = await octokit.paginate(octokit.repos.listBranches, {
  owner,
  repo,
  per_page: 100,
});
```
[CITED: https://docs.github.com/en/rest/branches/branches#list-branches]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auth.js v4 with GitHub + Credentials | Auth.js v5 (beta) -- still beta as of 2026 | 2024-2025 | Account linking still requires database adapter; manual OAuth avoids this entirely |
| @octokit/rest v20 | @octokit/rest v22 | 2025 | ESM-first, better TypeScript types |
| crypto.createCipher (deprecated) | crypto.createCipheriv (current) | Node 10+ | Must use createCipheriv; old API is removed |
| GitHub personal access tokens for cloning | OAuth app tokens (fine-grained or classic) | 2023+ | OAuth tokens are scoped and revocable |

**Deprecated/outdated:**
- `crypto.createCipher`: Removed. Use `createCipheriv` with explicit IV.
- GitHub OAuth token format: Now returns tokens starting with `gho_` prefix for OAuth apps.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Manual OAuth flow is cleaner than Auth.js GitHub provider for account linking | Architecture Patterns | If Auth.js v5 has clean account-linking support without database adapter, we do unnecessary custom work. Low risk -- the manual flow is ~50 lines and simpler regardless. |
| A2 | In-memory Map cache is sufficient for repo listings | Architecture Patterns | If the Next.js server restarts frequently, cache invalidation is aggressive. Acceptable for single-server. |
| A3 | `x-access-token:TOKEN@github.com` URL pattern works for cloning | Code Examples | Well-documented pattern, but if GitHub changes auth URL format, clones break. Low risk. |
| A4 | GitHub OAuth config vars should be optional (not required) | Code Examples | If required, DevDock would fail to start without GitHub configured. Optional is better for development/testing. |

## Open Questions (RESOLVED)

1. **GitHub OAuth App Registration** — RESOLVED: Setup instructions included in Plan 04 user_setup; callback URL documented as `https://{domain}/api/github/callback`
   - What we know: Need a GitHub OAuth App with client ID and secret
   - What is unclear: Whether the user has already created one, or if documentation for setup is needed
   - Recommendation: Include setup instructions in env var documentation. Callback URL will be `https://{domain}/api/github/callback`

2. **Repo Pagination Cap** — RESOLVED: Cap at 500 repos via `octokit.paginate` with `done()` callback in Plan 02
   - What we know: D-05 says "works well for up to ~500 repos". GitHub API returns 100 per page.
   - What is unclear: Whether to cap at 500 or fetch all (could be thousands for org members)
   - Recommendation: Use `octokit.paginate` but cap at 500 repos (5 pages). Most users will have fewer. Display a note if capped.

3. **Environment Creation API Modification** — RESOLVED: Pass cloneUrl from client, add branch to schema, resolve token server-side in Plan 02 Task 1
   - What we know: The creation dialog needs to pass `repoUrl` and `branch` to the existing POST /api/environments
   - What is unclear: Whether the API should also accept a `githubRepoFullName` and resolve the clone URL server-side
   - Recommendation: Pass the clone URL directly from the client (already selected from repo list). The API already accepts `repoUrl`. Add `branch` to the create schema. Resolve the auth token server-side from `github_accounts`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.4 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GH-04 | AES-256-GCM encrypt/decrypt roundtrip | unit | `npx vitest run src/lib/github/__tests__/encryption.test.ts -t "roundtrip"` | No -- Wave 0 |
| GH-04 | Decrypt with wrong key fails | unit | `npx vitest run src/lib/github/__tests__/encryption.test.ts -t "wrong key"` | No -- Wave 0 |
| GH-04 | Each encryption produces unique ciphertext (random IV) | unit | `npx vitest run src/lib/github/__tests__/encryption.test.ts -t "unique IV"` | No -- Wave 0 |
| AUTH-05 | OAuth state validation rejects mismatched state | unit | `npx vitest run src/lib/github/__tests__/oauth.test.ts -t "state mismatch"` | No -- Wave 0 |
| GH-01 | Authorize URL includes correct params | unit | `npx vitest run src/lib/github/__tests__/oauth.test.ts -t "authorize URL"` | No -- Wave 0 |
| GH-02 | Repo list API returns mapped data | unit | `npx vitest run src/app/api/github/__tests__/repos.test.ts` | No -- Wave 0 |
| GH-05 | Clone command includes token for private repos | unit | `npx vitest run src/lib/docker/__tests__/docker-service.test.ts -t "clone with token"` | No -- Wave 0 |
| GH-05 | Error messages sanitize token | unit | `npx vitest run src/lib/docker/__tests__/docker-service.test.ts -t "sanitize token"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/github/__tests__/encryption.test.ts` -- covers GH-04
- [ ] `src/lib/github/__tests__/oauth.test.ts` -- covers AUTH-05, GH-01
- [ ] `src/app/api/github/__tests__/repos.test.ts` -- covers GH-02
- [ ] Extended docker-service tests for clone-with-token -- covers GH-05

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Manual OAuth flow with CSRF state parameter (not for login, for account linking) |
| V3 Session Management | no | Existing JWT sessions unchanged |
| V4 Access Control | yes | GitHub API routes require authenticated session; each user can only access their own github_accounts row |
| V5 Input Validation | yes | Zod validation on all API inputs; OAuth callback params validated |
| V6 Cryptography | yes | AES-256-GCM via Node.js crypto; never hand-roll; random IV per encryption; key in env var only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSRF on OAuth flow | Spoofing | Random state parameter stored in HTTP-only cookie, validated on callback |
| Token leakage in logs/errors | Information Disclosure | Sanitize all error messages; never log decrypted tokens |
| Token theft from database | Information Disclosure | AES-256-GCM encryption at rest; key separate from data |
| Replay of OAuth callback | Spoofing | State parameter is one-use (deleted from cookie after validation) |
| Expired/revoked token usage | Elevation of Privilege | Detect 401 from GitHub API, auto-disconnect, prompt re-auth |

## Project Constraints (from CLAUDE.md)

- **Framework:** Next.js 15 App Router with TypeScript
- **ORM:** Drizzle ORM (not Prisma)
- **Auth:** Auth.js v5 (next-auth ^5.0.0-beta.30) with JWT sessions
- **UI:** Tailwind CSS + shadcn/ui (base-nova style) + Lucide icons
- **Database:** PostgreSQL 16
- **GitHub client:** @octokit/rest (per CLAUDE.md recommended stack)
- **OAuth type:** OAuth App (not GitHub App) per CLAUDE.md
- **Validation:** zod ^3.25.76 (NOT v4)
- **Do NOT use:** Prisma, MongoDB, GraphQL, Redis (for platform), tRPC
- **Conventions:** Dark mode default, Inter font, `_components/` directory pattern for page-specific components

## Sources

### Primary (HIGH confidence)
- [GitHub OAuth Authorization Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) -- OAuth flow, token exchange, state parameter
- [GitHub OAuth Scopes Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) -- `repo` scope grants full private repo access
- [Node.js crypto API](https://nodejs.org/api/crypto.html) -- AES-256-GCM implementation
- npm registry -- @octokit/rest v22.0.1, sonner v2.0.7

### Secondary (MEDIUM confidence)
- [AES-256-GCM Gist](https://gist.github.com/rjz/15baffeab434b8125ca4d783f4116d81) -- Encrypt/decrypt pattern reference
- [Auth.js Migration Guide](https://authjs.dev/getting-started/migrating-to-v5) -- Confirmed v5 architecture constraints

### Tertiary (LOW confidence)
- None -- all claims verified or cited

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @octokit/rest is the official GitHub SDK, crypto is built-in
- Architecture: HIGH -- Manual OAuth flow is well-documented, existing codebase patterns are clear
- Pitfalls: HIGH -- CSRF, token leakage, encryption key format are well-known concerns
- UI integration: HIGH -- UI-SPEC is comprehensive, shadcn components are specified

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable domain, 30 days)
