---
phase: 05-github-integration
reviewed: 2026-04-14T12:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src/lib/github/encryption.ts
  - src/lib/github/oauth.ts
  - src/lib/github/client.ts
  - src/lib/config.ts
  - src/lib/db/schema.ts
  - src/app/api/github/authorize/route.ts
  - src/app/api/github/callback/route.ts
  - src/app/api/github/disconnect/route.ts
  - src/app/api/github/connection/route.ts
  - src/app/api/github/repos/route.ts
  - src/app/api/github/repos/[owner]/[repo]/branches/route.ts
  - src/app/api/environments/route.ts
  - src/lib/docker/docker-service.ts
  - src/app/dashboard/settings/_components/github-connection-card.tsx
  - src/app/dashboard/settings/page.tsx
  - src/app/dashboard/_components/header-nav.tsx
  - src/app/dashboard/_components/branch-select.tsx
  - src/app/dashboard/_components/repo-combobox.tsx
  - src/app/dashboard/_components/create-environment-dialog.tsx
  - src/app/dashboard/layout.tsx
  - src/app/layout.tsx
  - src/hooks/use-github-branches.ts
  - src/hooks/use-github-connection.ts
  - src/hooks/use-github-repos.ts
  - src/lib/docker/__tests__/docker-service.test.ts
  - src/lib/github/__tests__/encryption.test.ts
  - src/lib/github/__tests__/oauth.test.ts
  - src/app/api/github/__tests__/repos.test.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-14T12:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 5 introduces GitHub OAuth integration: token encryption (AES-256-GCM), OAuth authorize/callback flow, repository listing with caching, branch listing, and UI components (connection card, repo combobox, branch select, create-environment dialog). The code is generally well-structured with good security practices (execFile over exec, token sanitization in error messages, CSRF state validation). However, there is one critical race condition in the callback upsert logic and several warnings around missing input validation and error handling.

## Critical Issues

### CR-01: Race condition in callback upsert -- delete + insert is not atomic

**File:** `src/app/api/github/callback/route.ts:57-65`
**Issue:** The upsert pattern uses a separate `DELETE` then `INSERT` without a transaction. If two concurrent OAuth callbacks arrive for the same user (e.g., double-click, or a retry), the sequence could be: delete(A), delete(B), insert(A), insert(B) -- resulting in a duplicate key violation on the `userId` unique constraint, or in a brief window where the user has no GitHub account row while the delete has committed but the insert hasn't.
**Fix:**
```typescript
await db.transaction(async (tx) => {
  await tx.delete(githubAccounts).where(eq(githubAccounts.userId, session.user.id));
  await tx.insert(githubAccounts).values({
    userId: session.user.id,
    githubUsername: ghUser.login,
    avatarUrl: ghUser.avatar_url,
    encryptedAccessToken: encryptedToken,
    scopes: tokenData.scope,
    connectedAt: new Date(),
  });
});
```
Alternatively, use Drizzle's `onConflictDoUpdate` for a true upsert in a single statement.

## Warnings

### WR-01: Decrypt decipher.update returns Buffer, concatenated with string via +

**File:** `src/lib/github/encryption.ts:25`
**Issue:** `decipher.update(encrypted)` returns a `Buffer` (no encoding specified), then `+ decipher.final('utf8')` concatenates it with a string. The `Buffer` will be implicitly converted via `.toString()` which defaults to UTF-8, so it works in most cases. However, this is fragile -- if the encrypted data contains partial multi-byte UTF-8 sequences split across the update/final boundary, the implicit Buffer-to-string conversion in `update` may produce a replacement character while `final` produces the trailing bytes, corrupting the output.
**Fix:**
```typescript
return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
```
Or use Buffer.concat:
```typescript
const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
return decrypted.toString('utf8');
```

### WR-02: Branches endpoint does not validate owner/repo path parameters

**File:** `src/app/api/github/repos/[owner]/[repo]/branches/route.ts:21`
**Issue:** The `owner` and `repo` path parameters are taken directly from the URL and passed to the Octokit API without any validation or sanitization. While Octokit will URL-encode them, a malicious user could craft requests to probe arbitrary GitHub repos using another user's token (the token belongs to the authenticated DevDock user, so the blast radius is limited to repos that token has access to). More importantly, there is no check that the authenticated user actually owns or has selected this repo.
**Fix:** Add basic validation for path parameters:
```typescript
const { owner, repo } = await params;
if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
  return NextResponse.json({ error: 'Invalid owner or repo' }, { status: 400 });
}
```

### WR-03: In-memory repo cache is never bounded and never cleaned up

**File:** `src/app/api/github/repos/route.ts:10-11`
**Issue:** The `repoCache` Map grows unboundedly as new users make requests. Old entries are only overwritten on re-request or deleted on 401. In a multi-user deployment, this leaks memory over time since expired entries are never purged. Each entry can hold up to 500 repo objects.
**Fix:** Add a periodic cleanup or use a bounded LRU cache. A simple approach:
```typescript
// Cleanup stale entries on each request
for (const [key, entry] of repoCache) {
  if (Date.now() >= entry.expiry) repoCache.delete(key);
}
```
Or use a library like `lru-cache` with a max size.

### WR-04: GitHub success toast condition does not match callback redirect

**File:** `src/app/dashboard/settings/_components/github-connection-card.tsx:56`
**Issue:** The component checks `searchParams.get('github_success') === 'true'` but the callback route sets `github_success=connected` (line 67 of callback/route.ts). These do not match, so the success toast will never fire after a successful OAuth connection.
**Fix:**
```typescript
if (success === 'connected') {
  toast.success('GitHub connected.');
```
Or change the callback to set `github_success=true`.

### WR-05: Paginate callback condition for 500-repo cap is incorrect

**File:** `src/app/api/github/repos/route.ts:56-58`
**Issue:** The `done()` callback is called when `response.data.length >= 500`, but `response.data.length` is the count of repos in the *current page* (max 100 per page), not the cumulative total. This means `done()` is never called (a single page can never have 500 items), and all pages are always fetched until GitHub returns no more. The `.slice(0, 500)` on line 62 still caps the final result, but unnecessary pages are fetched.
**Fix:** Track cumulative count:
```typescript
let total = 0;
const repos = await octokit.paginate(
  octokit.rest.repos.listForAuthenticatedUser,
  { sort: 'pushed', direction: 'desc', per_page: 100, type: 'all' },
  (response, done) => {
    total += response.data.length;
    if (total >= 500) done();
    return response.data;
  },
);
```

## Info

### IN-01: GitHub config env vars are all optional -- no validation when partially set

**File:** `src/lib/config.ts:15-18`
**Issue:** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_TOKEN_ENCRYPTION_KEY` are all independently optional. This means a user could set `GITHUB_CLIENT_ID` without `GITHUB_CLIENT_SECRET`, and the authorize route would return 503 while the callback route would also fail. Consider validating that either all three are set or none are set.
**Fix:** Add a `.refine()` to the schema:
```typescript
.refine((data) => {
  const ghVars = [data.GITHUB_CLIENT_ID, data.GITHUB_CLIENT_SECRET, data.GITHUB_TOKEN_ENCRYPTION_KEY];
  const set = ghVars.filter(Boolean).length;
  return set === 0 || set === 3;
}, 'GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_TOKEN_ENCRYPTION_KEY must all be set or all be unset');
```

### IN-02: Unused `beforeEach` import in oauth test

**File:** `src/lib/github/__tests__/oauth.test.ts:1`
**Issue:** `beforeEach` is imported from vitest but never used.
**Fix:** Remove `beforeEach` from the import.

### IN-03: `error` display in create-environment-dialog may render objects as `[object Object]`

**File:** `src/app/dashboard/_components/create-environment-dialog.tsx:128-129`
**Issue:** When the API returns status 400 or 409, `data.error` may be an object (field-level errors from zod, e.g., `{ name: ['...'] }`). The code assigns this directly to the `error` state (a string), which will render as `[object Object]` in the UI.
**Fix:** Extract a user-friendly message:
```typescript
if (res.status === 400 || res.status === 409 || res.status === 429) {
  const msg = typeof data.error === 'string'
    ? data.error
    : Object.values(data.error).flat().join(' ');
  setError(msg || 'Failed to create environment. Please try again.');
}
```

---

_Reviewed: 2026-04-14T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
