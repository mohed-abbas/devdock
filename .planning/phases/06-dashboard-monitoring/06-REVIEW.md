---
phase: 06-dashboard-monitoring
reviewed: 2026-04-16T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - deploy/nginx/devdock-preview.conf
  - server/terminal-server.ts
  - src/app/api/environments/[id]/logs/token/route.ts
  - src/app/api/environments/route.ts
  - src/app/api/preview/[[...path]]/route.ts
  - src/app/api/production-apps/route.ts
  - src/app/dashboard/_components/create-environment-dialog.tsx
  - src/app/dashboard/_components/environment-card.tsx
  - src/app/dashboard/_components/environment-list.tsx
  - src/app/dashboard/_components/production-app-card.tsx
  - src/app/dashboard/_components/production-app-list.tsx
  - src/app/dashboard/env/[id]/logs/_components/logs-client.tsx
  - src/app/dashboard/env/[id]/logs/_components/logs-loader.tsx
  - src/app/dashboard/env/[id]/logs/page.tsx
  - src/app/dashboard/page.tsx
  - src/auth.config.ts
  - src/hooks/use-environments.ts
  - src/hooks/use-production-apps.ts
  - src/lib/config.ts
  - src/lib/db/schema.ts
  - src/lib/docker/production-discovery.ts
  - src/middleware.ts
  - tsconfig.json
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-16  
**Depth:** standard  
**Files Reviewed:** 22  
**Status:** issues_found

## Summary

Phase 06 adds unified dashboard with production app monitoring, container log streaming via Socket.IO, subdomain preview proxy, and an Edit Environment dialog. The overall architecture is solid — auth is applied consistently at the token endpoint, the preview proxy strips session headers, ANSI stripping is implemented in the log viewer, and the demux pattern for Docker log streams is correct.

One critical bug exists: the `EditEnvironmentDialog` submits a PATCH request to `/api/environments/[id]` but no PATCH handler is exported from that route file — the edit button silently fails for all users.

Two warnings cover the unauthenticated preview proxy design and a polling-continues-after-error issue.

---

## Critical Issues

### CR-01: PATCH handler missing — Edit Environment silently fails

**File:** `src/app/dashboard/_components/edit-environment-dialog.tsx:83`  
**Issue:** `EditEnvironmentDialog` submits `PATCH /api/environments/${environment.id}` to update name and previewPort. `src/app/api/environments/[id]/route.ts` only exports `GET` and `DELETE`. The PATCH request hits Next.js, receives a 405 Method Not Allowed, and the dialog shows the generic error `"Failed to update environment."` — the edit feature is entirely non-functional.

**Fix:** Add a PATCH handler to `src/app/api/environments/[id]/route.ts`:

```typescript
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const patchSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    previewPort: z.number().int().min(1).max(65535).nullable().optional(),
  });

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const [env] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, id), eq(environments.userId, session.user.id)))
    .limit(1);

  if (!env) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }

  const updates: Partial<typeof env> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if ('previewPort' in parsed.data) updates.previewPort = parsed.data.previewPort;

  await db.update(environments).set(updates).where(eq(environments.id, id));
  return NextResponse.json({ success: true });
}
```

---

## Warnings

### WR-01: Preview proxy serves content without user authentication

**File:** `src/app/api/preview/[[...path]]/route.ts:35`  
**Issue:** The comment `// no user auth needed, UUID is unguessable` is intentional by design, but the auth exemption in `src/auth.config.ts:14` (`!nextUrl.pathname.startsWith('/api/preview')`) means **anyone** who knows or guesses a running environment's UUID can proxy arbitrary HTTP requests through the DevDock server to internal Docker containers. If an environment UUID is ever exposed (shared URL, logs, referer header leak), the container app is fully accessible without login.

This is a conscious trade-off and may be acceptable for a single-person self-hosted tool. However it should be documented as a known risk, and if the preview URL is ever shared it cannot be revoked without stopping the environment.

**Fix (minimal):** Add an optional token-in-query-string check that requires a signed preview token, or at minimum add a comment to `auth.config.ts` explicitly acknowledging the security posture:

```typescript
// SECURITY: Preview proxy is intentionally unauthenticated — UUID acts as capability token.
// Do not share preview URLs publicly. Stopping the environment invalidates access.
!nextUrl.pathname.startsWith('/api/preview');
```

If stricter access is required later, add session cookie validation inside `proxyRequest()` before the DB lookup.

---

### WR-02: Polling continues indefinitely after API error in `useProductionApps`

**File:** `src/hooks/use-production-apps.ts:22-34`  
**Issue:** When `/api/production-apps` returns a non-2xx response, `setEnabled(false)` is called and `fetchApps` returns. The `ProductionAppList` correctly hides itself, but the `setInterval` registered in `useEffect` keeps firing every 5 seconds for the entire lifetime of the dashboard page. Each failed poll creates a pending `fetch` and a state update cycle — this is low-impact but unnecessary load.

```typescript
// Current: interval keeps running even after disabled
if (!res.ok) {
  setEnabled(false);
  return; // interval still fires
}
```

**Fix:** Stop the interval when the feature is determined to be non-functional:

```typescript
if (!res.ok) {
  setEnabled(false);
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
  return;
}
```

---

## Info

### IN-01: `chunk.toString('utf-8')` called twice per data event in terminal-server.ts

**File:** `server/terminal-server.ts:88-96`  
**Issue:** In the `stream.on('data', ...)` handler inside `exec:create`, `chunk.toString('utf-8')` is called once at line 88 (assigned to `data` in the emit) and again at line 96 (assigned to `text`). The result at line 88 is not stored in a variable — it is inlined directly in the emit object literal — so the conversion runs twice.

```typescript
// Line 88: chunk.toString('utf-8') used in emit
socket.emit('exec:output', { sessionIndex, data: chunk.toString('utf-8') });

// Line 96: chunk.toString('utf-8') again
const text = chunk.toString('utf-8');
```

**Fix:** Assign once:

```typescript
const text = chunk.toString('utf-8');
socket.emit('exec:output', { sessionIndex, data: text });
// then use `text` below for log buffering
```

---

### IN-02: `logs-loader.tsx` dynamic import wraps component but passes props directly — SSR disabled is redundant

**File:** `src/app/dashboard/env/[id]/logs/_components/logs-loader.tsx:8`  
**Issue:** `LogsLoader` uses `dynamic()` with `ssr: false` to load `LogsClient`, which is correct. However `LogsLoader` itself is a client component (`'use client'`) so it is never server-rendered. The `dynamic()` import only buys a code-split chunk, not SSR protection. The `ssr: false` option has no effect on a component that is already client-only.

The real benefit here is code splitting for the Socket.IO dependency, which is valid. The `ssr: false` is harmless but misleading — either add a comment explaining the purpose is code splitting, or use a lazy import directly in the parent.

```typescript
// Add clarifying comment:
// ssr: false is redundant (parent is 'use client') but kept for explicit documentation.
// The primary benefit is code splitting Socket.IO out of the initial bundle.
```

---

_Reviewed: 2026-04-16_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
