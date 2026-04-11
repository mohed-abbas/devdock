---
phase: 03-environment-lifecycle
reviewed: 2026-04-10T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/lib/docker/types.ts
  - src/lib/docker/compose-generator.ts
  - src/lib/docker/docker-service.ts
  - src/lib/docker/slug.ts
  - src/lib/db/schema.ts
  - src/lib/config.ts
  - src/app/api/environments/route.ts
  - src/app/api/environments/[id]/route.ts
  - src/app/api/environments/[id]/start/route.ts
  - src/app/api/environments/[id]/stop/route.ts
  - src/hooks/use-environments.ts
  - src/app/dashboard/_components/status-badge.tsx
  - src/app/dashboard/_components/environment-card.tsx
  - src/app/dashboard/_components/create-environment-dialog.tsx
  - src/app/dashboard/_components/delete-environment-dialog.tsx
  - src/app/dashboard/_components/environment-list.tsx
  - src/app/dashboard/page.tsx
  - next.config.ts
findings:
  critical: 0
  warning: 7
  info: 6
  total: 13
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-10
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 03 delivers the environment lifecycle backend and dashboard UI. Overall quality is good: `execFile` is consistently used (no shell injection), auth and IDOR are properly enforced on every route via `userId` scoping, zod validates input, slug is validated before filesystem/Docker use, and error messages are truncated to 500 chars per D-07. Tests exist for the core Docker modules.

No **Critical** security or correctness issues were found. Seven **Warning**-level issues concern reconciliation gaps, fire-and-forget promise rejection handling, TOCTOU in concurrent limits, defense-in-depth against git-argument injection, and dead error state in the polling hook. Six **Info** items cover minor quality issues.

The most consequential finding is **WR-01** (the pre-flagged reconciliation bug): an environment whose DB state is `error` is never reconciled to `running` even if Docker has recovered, because the reconciler only fires for `status in ('running','starting')`.

## Warnings

### WR-01: Reconciliation does not recover from `error` state (pre-flagged bug)

**Files:**
- `src/app/api/environments/route.ts:39-62` (GET list)
- `src/app/api/environments/[id]/route.ts:35-58` (GET single)

**Issue:** The Docker-state reconciler runs only when `env.status === 'running' || env.status === 'starting'`. If the DB is `error` (e.g. a container exited with non-zero code during startup) but Docker has subsequently recovered the containers to `running` (for example, `restart: unless-stopped` succeeded on a later attempt), the DB `status` and `errorMessage` are never cleared. The UI will permanently show "Error" with the stale message until the user clicks Start (which does clear `errorMessage`). This directly contradicts the review focus area and D-07 intent.

Additionally, when an environment transitions `starting → running` via reconciliation the code writes `errorMessage: actual.errorMessage ?? null`, which does clear a stale message — but only on that path. The broader gap remains for the `error` branch.

**Fix:** Include `'error'` in the reconcile guard and clear `errorMessage` whenever the reconciled actual status is `running`/`stopped`:

```ts
if (
  (env.status === 'running' || env.status === 'starting' || env.status === 'error') &&
  env.dockerProjectName
) {
  try {
    const actual = await getProjectStatus(env.dockerProjectName);
    if (actual.status !== env.status) {
      const nextErrorMessage =
        actual.status === 'error' ? (actual.errorMessage ?? null) : null;
      await db
        .update(environments)
        .set({ status: actual.status, errorMessage: nextErrorMessage })
        .where(eq(environments.id, env.id));
      return { ...env, status: actual.status, errorMessage: nextErrorMessage };
    }
  } catch {
    // keep DB state
  }
}
```

Apply the same change in both the list route and the single-environment route.

---

### WR-02: Fire-and-forget background promises have no `.catch()` — unhandled rejection risk

**Files:**
- `src/app/api/environments/route.ts:185-245`
- `src/app/api/environments/[id]/start/route.ts:85-112`
- `src/app/api/environments/[id]/stop/route.ts:56-83`

**Issue:** All three background operations use `Promise.resolve().then(async () => { ... })` without a trailing `.catch()`. The inner function is wrapped in try/catch that updates the DB to `error` — but if the DB update itself throws inside the catch block (connection drop, transient failure), that throw escapes as an unhandled promise rejection. Depending on Node's `unhandledRejection` policy this can crash the server process or silently leave the env in `starting`/`stopping` forever.

**Fix:** Add a terminal `.catch()` on the detached promise so rejections are always observed:

```ts
Promise.resolve()
  .then(async () => { /* existing body */ })
  .catch((err) => {
    console.error('Background environment operation failed', { envId, err });
  });
```

This is purely a safety net — the inner try/catch should still attempt DB updates.

---

### WR-03: TOCTOU race in `DEVDOCK_MAX_CONCURRENT_ENVS` enforcement

**Files:**
- `src/app/api/environments/route.ts:123-150` (POST create)
- `src/app/api/environments/[id]/start/route.ts:42-69` (POST start)

**Issue:** The concurrent-env check reads counts, then issues `INSERT` / `UPDATE` in a separate statement. Two concurrent requests from the same user can both see `activeCount < MAX` and both proceed, exceeding the limit (T-03-08 partial mitigation). On a single-user VPS this is low-impact but the threat model claims full mitigation.

**Fix:** Either wrap the count + write in a serializable transaction, or use a single conditional `INSERT ... WHERE (SELECT count(*) ... ) < MAX`. Alternatively, add a DB-level CHECK via a trigger. Lowest-effort mitigation: perform both operations inside `db.transaction(async (tx) => { ... })` with `SERIALIZABLE` isolation.

---

### WR-04: `cloneRepo` allows git-argument smuggling via `repoUrl` (defense in depth)

**File:** `src/lib/docker/docker-service.ts:148-160`

**Issue:** `execFile('git', ['clone', '--depth', '1', repoUrl, targetDir])` is safe from shell injection, but `git clone` parses positional args for flags if they start with `-`. While `zod.string().url()` should reject most option-like strings, the WHATWG URL parser is permissive and URLs that begin with `-` are rejected — this is likely fine in practice. Still, per OWASP defense-in-depth, add a `--` separator so nothing after it is interpreted as a flag.

**Fix:**

```ts
await execFile('git', ['clone', '--depth', '1', '--', repoUrl, targetDir]);
```

Same applies if any future code passes user-controlled values to `execFile('docker', [...])` — always terminate option parsing with `--` before positional user input.

---

### WR-05: `env.dockerProjectName!` non-null assertion in start/stop routes

**Files:**
- `src/app/api/environments/[id]/start/route.ts:82`
- `src/app/api/environments/[id]/stop/route.ts:53`

**Issue:** `dockerProjectName` is a nullable column (`varchar ... NULL` in schema). Creation always sets it, but if a row ever exists without it (manual DB edit, future migration, creation path that inserts a row before setting the name), the `!` assertion passes an `undefined` string into `execFile('docker', [..., undefined, ...])` which throws a `TypeError` inside the background task.

**Fix:** Guard explicitly and mark the row as `error` if missing:

```ts
if (!env.dockerProjectName) {
  await db.update(environments)
    .set({ status: 'error', errorMessage: 'Missing docker project name' })
    .where(eq(environments.id, env.id));
  return NextResponse.json({ error: 'Environment is misconfigured.' }, { status: 500 });
}
```

---

### WR-06: `slug` read from DB is not re-validated before path join (defense in depth)

**Files:**
- `src/app/api/environments/[id]/route.ts:101` (DELETE composePath)
- `src/app/api/environments/[id]/start/route.ts:83`
- `src/app/api/environments/[id]/stop/route.ts:54`
- `src/lib/docker/docker-service.ts:167` (`removeDataDir`)

**Issue:** `slug` is validated at creation via `isValidSlug`, but downstream code trusts the DB value without re-validation. If a slug were ever poisoned (future migration bug, manual DB edit, rollback), `path.join(config.DEVDOCK_DATA_DIR, slug)` could escape the data dir (e.g. slug of `../etc`). T-03-01 claims mitigation via `path.join`, but `path.join` alone does not prevent traversal — only concatenation within a prefix + subsequent `startsWith` check does.

**Fix:** Add a cheap re-check before filesystem use, and assert the resolved path stays under `DEVDOCK_DATA_DIR`:

```ts
import { isValidSlug } from '@/lib/docker/slug';

function resolveEnvPath(slug: string, ...rest: string[]): string {
  if (!isValidSlug(slug)) throw new Error('Invalid slug');
  const resolved = path.resolve(config.DEVDOCK_DATA_DIR, slug, ...rest);
  if (!resolved.startsWith(path.resolve(config.DEVDOCK_DATA_DIR) + path.sep)) {
    throw new Error('Path traversal blocked');
  }
  return resolved;
}
```

Use it in `removeDataDir`, all composePath constructions, and `generateComposeFile`.

---

### WR-07: `useEnvironments` hook tracks `error` state that is never set

**File:** `src/hooks/use-environments.ts:23,35-38`

**Issue:** The hook declares `const [error, setError] = useState<string | null>(null);` and returns `error`, but the catch block is empty (`catch {}`) — only `setError(null)` ever runs on the success path. Consumers (including `environment-list.tsx`) never surface the error, so a broken API call fails silently. This contradicts the stated "silent retry" UX: silent retry is fine for transient failures, but a persistent auth failure (401) or network outage leaves the user staring at a stale list forever.

**Fix:** Either (a) remove the dead `error` state entirely, or (b) actually populate it in the catch branch and surface it as a non-blocking banner:

```ts
} catch (err) {
  setError(err instanceof Error ? err.message : 'Failed to fetch environments');
}
```

Pick one and apply consistently; the current half-implementation is misleading.

---

## Info

### IN-01: Concurrent-limit check uses two queries instead of one

**Files:** `src/app/api/environments/route.ts:124-144`, `src/app/api/environments/[id]/start/route.ts:43-63`

**Issue:** Two separate `SELECT` queries (one for `running`, one for `starting`) are issued then length-summed. A single query with `inArray(environments.status, ['running', 'starting'])` is simpler and halves round-trips.

**Fix:**
```ts
const active = await db.select({ id: environments.id })
  .from(environments)
  .where(and(
    eq(environments.userId, session.user.id),
    inArray(environments.status, ['running', 'starting']),
  ));
```

---

### IN-02: `uncommentSection` regex uses unescaped sectionName

**File:** `src/lib/docker/compose-generator.ts:21`

**Issue:** `new RegExp(`^  # ${sectionName}:`)` interpolates `sectionName` directly into a regex. Current callers pass literal strings (`'postgres'`, `'redis'`), so it's safe today, but any future caller passing a name with regex metacharacters would break. Cheap fix: escape or prefer `String#startsWith`.

**Fix:**
```ts
if (!inSection && line.startsWith(`  # ${sectionName}:`)) { ... }
```

---

### IN-03: `generateComposeFile` reads template from `process.cwd()` — fragile under `output: standalone`

**File:** `src/lib/docker/compose-generator.ts:107`

**Issue:** `path.join(process.cwd(), 'docker/templates/base-compose.yml')` depends on the process working directory at runtime. With `next.config.ts` using `output: 'standalone'`, the deployed server's cwd may not include the `docker/` directory. This is a latent deployment bug that won't surface in dev.

**Fix:** Resolve from a known anchor (e.g. a constant pointing at `process.env.DEVDOCK_TEMPLATE_DIR` with a cwd default, or bundle the template as a string import). At minimum, add the template path to `outputFileTracingIncludes` in `next.config.ts`.

---

### IN-04: `environments.branch` column declared but never written or read

**File:** `src/lib/db/schema.ts:39`

**Issue:** The `branch` column exists but no code in Phase 03 writes or reads it. Either dead schema or planned for a later phase — if the latter, add a TODO comment; if not, remove to keep the schema tight.

---

### IN-05: `formatRelativeTime` is recomputed on every render but does not trigger updates

**File:** `src/app/dashboard/_components/environment-card.tsx:52-63`

**Issue:** The card shows "just now" / "2m ago" but only updates when the parent polls (every 3s). At 3s cadence this happens to be fine for minute-resolution, but future refactors (e.g. slowing polling) would leave labels stale. Consider `date-fns` `formatDistanceToNow` + a dedicated 60s tick; purely a quality suggestion.

---

### IN-06: `DialogTrigger render={<Button />}` prop pattern is unusual

**Files:** `src/app/dashboard/_components/create-environment-dialog.tsx:106-111`, `delete-environment-dialog.tsx:55-67`

**Issue:** Using `<DialogTrigger render={<Button ... />}>children</DialogTrigger>` is an unusual shadcn pattern — the standard is `<DialogTrigger asChild><Button>...</Button></DialogTrigger>`. If the project uses a fork of shadcn that supports `render`, fine; otherwise this may silently drop props on re-render. Verify against the installed dialog primitive and align with the house pattern.

---

_Reviewed: 2026-04-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
