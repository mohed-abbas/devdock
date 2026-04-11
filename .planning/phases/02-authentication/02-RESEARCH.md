# Phase 2: Authentication - Research

**Researched:** 2026-04-09
**Domain:** Authentication (Auth.js v5 + Credentials provider + JWT sessions + bcrypt + Next.js 15 middleware)
**Confidence:** HIGH

## Summary

This phase implements username/password authentication for DevDock using Auth.js v5 (next-auth@beta) with the Credentials provider, JWT sessions stored in HTTP-only cookies, CSRF protection via Auth.js built-in double-submit cookie pattern, and Next.js 15 middleware for route protection. The codebase already has the users table schema (Drizzle), shadcn/ui Card and Button components, environment config with NEXTAUTH_SECRET validation, and a dark-mode-first layout.

The most critical architectural finding is the **Edge Runtime split pattern**: Auth.js v5 middleware runs in Edge Runtime by default, which cannot use Node.js-native modules like `bcrypt` or `pg`. The solution is to split auth config into two files: `auth.config.ts` (edge-safe, no DB/bcrypt) for middleware, and `auth.ts` (full Node.js, with Credentials provider + bcrypt + DB queries) for API routes and server components. This is the officially recommended pattern from Auth.js documentation.

A secondary finding is that the current `.env.local` has `NEXTAUTH_SECRET=dev-secret-change-in-production` which is only 31 characters, while `src/lib/config.ts` validates it must be at least 32. This must be fixed. Auth.js v5 also prefers `AUTH_SECRET` over `NEXTAUTH_SECRET`, though the old name is aliased for backward compatibility.

**Primary recommendation:** Use the two-file auth config split pattern (`auth.config.ts` + `auth.ts`), bcrypt (native, not bcryptjs -- since bcrypt only runs in Node.js authorize function, never in Edge middleware), and server actions for sign-in/sign-out.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Minimal centered card on dark background -- username field, password field, "Sign In" button. Uses existing shadcn/ui Card and Button components.
- **D-02:** "DevDock" title text above the card with subtitle "Remote development platform." No custom logo, no icon, no illustration.
- **D-03:** No "Remember me" checkbox -- sessions use a fixed 7-day duration.
- **D-04:** Login errors displayed as inline red text below the form: "Invalid username or password." Generic message only -- never reveal which field is wrong.
- **D-05:** Use `frontend-design` skill and GSD UI skills/experts during design and implementation for high-quality visual output.
- **D-06:** First admin user created via CLI seed script (`npx devdock seed-admin`). Prompts for username and password interactively.
- **D-07:** Same CLI can create regular users too. No admin API endpoint or UI for user management in this phase.
- **D-08:** Password hashing: bcrypt.
- **D-09:** Minimum password requirement: 8 characters. No complexity rules.
- **D-10:** JWT sessions via Auth.js v5 Credentials provider. No database session table needed.
- **D-11:** Session duration: 7 days. No "remember me" variation.
- **D-12:** CSRF protection: Auth.js built-in CSRF for its endpoints. Custom API routes verified via session token in Next.js middleware (same-origin check).
- **D-13:** Rate limiting: Simple in-memory delay after 5 failed login attempts -- 30-second cooldown. Resets on server restart (acceptable for brute-force deterrence).
- **D-14:** After login, redirect to `/dashboard` -- a placeholder page showing "Welcome, [username]" with a logout button. Real dashboard content comes in Phase 6.
- **D-15:** Next.js middleware protects all `/dashboard/*` and `/api/*` routes. Unauthenticated requests redirect to `/login` with return-to URL preserved.
- **D-16:** Authenticated users hitting `/login` or `/` are auto-redirected to `/dashboard`.
- **D-17:** Logout clears session and redirects to `/login`.

### Claude's Discretion
- Auth.js v5 configuration details (callback structure, JWT customization)
- Exact middleware matcher patterns
- Form validation UX (client-side vs server-side)
- Seed script implementation details (standalone script vs Next.js custom server command)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with username and password | Auth.js v5 Credentials provider with authorize function, bcrypt password verification, server action form submission |
| AUTH-02 | Sessions are secured with HTTP-only cookies and CSRF protection | Auth.js v5 JWT strategy uses HTTP-only cookies by default; built-in double-submit cookie CSRF pattern protects auth endpoints; middleware validates session for custom API routes |
| AUTH-03 | User can log out from any page | Auth.js v5 signOut server action clears session cookie, redirects to /login; logout button in dashboard header |
| AUTH-04 | User session persists across browser refresh | JWT stored in HTTP-only cookie persists across page reloads; auth() function reads session from cookie on each request; 7-day maxAge |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Framework:** Next.js 15 (App Router) with TypeScript
- **Database:** PostgreSQL + Drizzle ORM (users table already defined in schema.ts)
- **Auth:** Auth.js v5 (next-auth@beta) with Credentials provider, JWT sessions
- **Password hashing:** bcrypt (D-08 locked decision)
- **UI:** Tailwind CSS + shadcn/ui (dark mode default, base-nova style)
- **Validation:** zod for runtime validation (pinned to v3.25.76)
- **Do NOT use:** Prisma, Lucia, Redis, MongoDB, GraphQL, tRPC
- **Config:** Environment variables validated via zod in src/lib/config.ts
- **Existing patterns:** Inter font, dark mode (`<html className="dark">`), standalone output mode

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | 5.0.0-beta.30 (beta tag) | Auth framework for Next.js | Official Auth.js v5 for App Router. Handles JWT sessions, CSRF, Credentials provider. Install via `next-auth@beta`. [VERIFIED: npm registry] |
| bcrypt | 6.0.0 | Password hashing | Native Node.js binding, battle-tested. Only runs in Node.js authorize function, never in Edge middleware. D-08 locked decision. [VERIFIED: npm registry] |
| @types/bcrypt | 6.0.0 | TypeScript types for bcrypt | Matching major version for bcrypt 6.x. [VERIFIED: npm registry] |

### Already Installed (from Phase 1)
| Library | Version | Purpose |
|---------|---------|---------|
| next | 15.5.15 | Full-stack framework |
| react / react-dom | 19.1.0 | UI library |
| drizzle-orm | 0.45.2 | Database ORM |
| pg | 8.20.0 | PostgreSQL driver |
| zod | 3.25.76 | Validation |
| shadcn | 4.2.0 | Component CLI |
| lucide-react | 1.8.0 | Icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcrypt (native) | bcryptjs (pure JS) | bcryptjs is Edge-compatible but slower. Since bcrypt only runs in server-side authorize function (never middleware), native bcrypt is fine and faster. |
| next-auth@beta | @auth/nextjs | @auth/nextjs is 0.0.0-380f8d56 -- extremely early. next-auth@beta is the established v5 path with more community usage. |
| Server actions for login | Client-side fetch to API | Server actions are the Auth.js v5 recommended pattern for App Router. Avoids manual CSRF token handling. |

**Installation:**
```bash
npm install next-auth@beta bcrypt
npm install -D @types/bcrypt
```

**Version verification:**
- `next-auth@beta`: 5.0.0-beta.30, peer deps: next ^14.0.0-0 || ^15.0.0 || ^16.0.0 [VERIFIED: npm registry 2026-04-09]
- `bcrypt`: 6.0.0, engines: node >= 18 [VERIFIED: npm registry 2026-04-09]
- `@types/bcrypt`: 6.0.0 [VERIFIED: npm registry 2026-04-09]

## Architecture Patterns

### Recommended Project Structure
```
src/
  auth.config.ts          # Edge-safe auth config (NO DB, NO bcrypt)
  auth.ts                 # Full auth config (Credentials + bcrypt + DB)
  middleware.ts            # Route protection (imports auth.config.ts only)
  app/
    api/
      auth/
        [...nextauth]/
          route.ts        # Auth.js API route handler
      health/
        route.ts          # Existing health endpoint
    login/
      page.tsx            # Login page (client component with form)
    dashboard/
      page.tsx            # Protected placeholder dashboard
      layout.tsx          # Dashboard layout with header/nav
    layout.tsx            # Root layout (add SessionProvider)
    page.tsx              # Root redirect (-> /dashboard or /login)
  components/
    ui/
      button.tsx          # Existing
      card.tsx            # Existing
      input.tsx           # NEW: shadcn/ui Input (add via CLI)
      label.tsx           # NEW: shadcn/ui Label (add via CLI)
    auth/
      login-form.tsx      # Login form client component
      logout-button.tsx   # Logout button component
  lib/
    auth/
      actions.ts          # Server actions for signIn/signOut
      rate-limit.ts       # In-memory rate limiter
    db/
      index.ts            # Existing DB connection
      schema.ts           # Existing schema (users table ready)
  scripts/
    seed-admin.ts         # CLI seed script
```

### Pattern 1: Edge Runtime Split (CRITICAL)
**What:** Separate auth configuration into edge-safe and full-Node.js files.
**When to use:** Always with Auth.js v5 when using Credentials provider with bcrypt/DB access.
**Why:** Middleware runs in Edge Runtime by default. Edge cannot use `bcrypt` (native bindings) or `pg` (TCP sockets). The authorize function with bcrypt + DB lookup must stay in Node.js-only code path.

```typescript
// src/auth.config.ts -- EDGE SAFE (no bcrypt, no pg, no drizzle)
// Source: https://authjs.dev/getting-started/migrating-to-v5
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnApi = nextUrl.pathname.startsWith('/api') && 
                      !nextUrl.pathname.startsWith('/api/auth');
      
      if (isOnDashboard || isOnApi) {
        if (isLoggedIn) return true;
        return false; // Redirect to /login
      }
      
      // Redirect logged-in users away from /login
      if (isLoggedIn && (nextUrl.pathname === '/login' || nextUrl.pathname === '/')) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      
      return true;
    },
  },
  providers: [], // Providers added in auth.ts (not edge-safe)
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days (D-11)
  },
} satisfies NextAuthConfig;
```

```typescript
// src/auth.ts -- FULL CONFIG (Node.js only, NOT imported by middleware)
// Source: https://authjs.dev/getting-started/migrating-to-v5
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { authConfig } from './auth.config';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, credentials.username as string))
          .limit(1);
        
        if (!user) return null;
        
        const passwordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );
        
        if (!passwordValid) return null;
        
        return {
          id: user.id,
          name: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
});
```

```typescript
// src/middleware.ts -- imports ONLY edge-safe config
// Source: https://authjs.dev/getting-started/migrating-to-v5
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Match all paths except static files and images
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Pattern 2: Server Actions for Sign-In/Sign-Out
**What:** Use Next.js server actions to call Auth.js signIn/signOut.
**When to use:** For form submissions in App Router.

```typescript
// src/lib/auth/actions.ts
// Source: https://authjs.dev/getting-started/session-management/login
'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';

export async function login(
  prevState: { error: string | null },
  formData: FormData
) {
  try {
    await signIn('credentials', {
      username: formData.get('username'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Invalid username or password.' }; // D-04: generic message
    }
    throw error; // Re-throw for redirect errors (signIn throws on redirect)
  }
}

export async function logout() {
  await signOut({ redirectTo: '/login' });
}
```

### Pattern 3: Client-Side Login Form with useActionState
**What:** React form using useActionState for server action integration.
**When to use:** Login form component.

```typescript
// src/components/auth/login-form.tsx
'use client';

import { useActionState } from 'react';
import { login } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, { error: null });

  return (
    <Card>
      <CardHeader>
        <CardTitle>DevDock</CardTitle>
        <CardDescription>Remote development platform</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" type="text" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

### Pattern 4: API Route Handler
**What:** The [...nextauth] catch-all route that Auth.js needs.
**When to use:** Required for Auth.js v5 to work.

```typescript
// src/app/api/auth/[...nextauth]/route.ts
// Source: https://authjs.dev/getting-started/installation
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

### Pattern 5: Session Provider in Root Layout
**What:** Wrap the app with SessionProvider for client-side session access.
**When to use:** Required if any client component needs useSession().

```typescript
// src/app/layout.tsx
import { SessionProvider } from 'next-auth/react';
// ... rest of layout
<SessionProvider>{children}</SessionProvider>
```

### Pattern 6: Seed Script
**What:** Interactive CLI script to create admin/user accounts.
**When to use:** Initial setup and user management (D-06, D-07).

```typescript
// src/scripts/seed-admin.ts
// Run via: npx tsx src/scripts/seed-admin.ts
import bcrypt from 'bcrypt';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import * as readline from 'readline/promises';

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8; // D-09

async function seedAdmin() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  const username = await rl.question('Username: ');
  const password = await rl.question('Password (min 8 chars): ');
  
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  
  await db.insert(users).values({
    username,
    passwordHash,
    role: 'admin',
  });
  
  console.log(`Admin user "${username}" created.`);
  rl.close();
  process.exit(0);
}
```

### Anti-Patterns to Avoid
- **Importing auth.ts in middleware.ts:** This pulls bcrypt and pg into Edge Runtime, causing build failures. Always import auth.config.ts in middleware.
- **Using bcryptjs "for safety":** Since bcrypt only runs in the authorize function (Node.js), native bcrypt is correct. bcryptjs is slower and only needed if you must hash in Edge.
- **Exposing password hash fields in JWT token:** The authorize function should return only { id, name, role }, never the passwordHash.
- **Using getServerSession (v4 pattern):** In v5, use the `auth()` function exported from auth.ts.
- **Setting AUTH_URL manually in development:** Auth.js v5 auto-detects the URL from request headers. Only set it in production behind a reverse proxy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSRF protection | Custom token generation/validation | Auth.js built-in double-submit cookie | Auth.js already implements this correctly for all its endpoints. Custom API routes are protected by JWT session check in middleware. |
| JWT encoding/decoding | Manual jsonwebtoken calls | Auth.js JWT strategy | Auth.js handles signing, encryption, and cookie management. Manual JWT is error-prone. |
| Session cookie management | Manual Set-Cookie headers | Auth.js session config | HttpOnly, Secure, SameSite flags handled by Auth.js. One `maxAge` config controls everything. |
| Password hashing | Custom hash functions | bcrypt library | bcrypt handles salt generation, cost factor, and timing-safe comparison. |
| Route protection | Custom middleware logic from scratch | Auth.js authorized callback | The authorized callback in auth.config.ts handles the common patterns. |

**Key insight:** Auth.js v5's value is that it handles the security-sensitive parts (CSRF, JWT, cookie flags, session rotation) so you only write the authorize function and the route protection logic.

## Common Pitfalls

### Pitfall 1: Edge Runtime Import Chain
**What goes wrong:** Build fails with "Edge Runtime does not support Node.js 'crypto' module" or similar errors.
**Why it happens:** middleware.ts imports auth.ts, which imports bcrypt and pg. Edge Runtime cannot use these.
**How to avoid:** Use the two-file split: auth.config.ts (edge-safe) and auth.ts (full). Middleware imports only auth.config.ts.
**Warning signs:** Any build error mentioning "Edge Runtime" and Node.js modules.

### Pitfall 2: NEXTAUTH_SECRET Too Short
**What goes wrong:** Config validation fails on startup because NEXTAUTH_SECRET is under 32 characters.
**Why it happens:** Current `.env.local` has `NEXTAUTH_SECRET=dev-secret-change-in-production` which is 31 characters. [VERIFIED: codebase inspection]
**How to avoid:** Update `.env.local` to use a 32+ character secret. Generate with `openssl rand -base64 32`. Also consider renaming to `AUTH_SECRET` for v5 convention.
**Warning signs:** Zod validation error on app startup.

### Pitfall 3: signIn Throwing on Redirect
**What goes wrong:** Login server action catches the redirect as an error, preventing successful login redirect.
**Why it happens:** Auth.js signIn() throws a NEXT_REDIRECT error internally to trigger Next.js redirect. If you catch all errors, you swallow the redirect.
**How to avoid:** In the catch block, only handle AuthError instances. Re-throw everything else (including redirect errors).
**Warning signs:** Login succeeds (session created) but user stays on login page.

### Pitfall 4: Missing TypeScript Type Augmentation
**What goes wrong:** `session.user.id` and `session.user.role` show TypeScript errors because Auth.js default types don't include these fields.
**Why it happens:** Auth.js has default type definitions for Session, JWT, and User that only include email, name, image.
**How to avoid:** Create a `types/next-auth.d.ts` file that augments the module types:
```typescript
import 'next-auth';

declare module 'next-auth' {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      role: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
  }
}
```
**Warning signs:** TypeScript errors on `token.role` or `session.user.id`.

### Pitfall 5: SessionProvider Missing or Misplaced
**What goes wrong:** `useSession()` returns undefined or throws "SessionProvider not found."
**Why it happens:** SessionProvider must wrap the component tree. In App Router, it goes in the root layout.
**How to avoid:** Add SessionProvider to `src/app/layout.tsx`. Note: SessionProvider is a client component, so it needs to be in a separate client wrapper component or the layout itself.
**Warning signs:** Client components can't access session data.

### Pitfall 6: Health Endpoint Blocked by Auth Middleware
**What goes wrong:** `/api/health` returns 401 or redirects to login.
**Why it happens:** Middleware matcher includes `/api/*` routes.
**How to avoid:** In the authorized callback, explicitly allow `/api/health` (and `/api/auth/*`) without authentication. The matcher regex or callback logic must exclude these paths.
**Warning signs:** Health checks from monitoring fail after auth is added.

### Pitfall 7: Seed Script Cannot Connect to Database
**What goes wrong:** Running the seed script outside of Next.js doesn't load .env.local.
**Why it happens:** Next.js auto-loads .env.local, but standalone scripts (run via tsx) don't.
**How to avoid:** Use dotenv to load .env.local at the top of the seed script, or use the same pattern as drizzle.config.ts (which already solves this).
**Warning signs:** "DATABASE_URL is not defined" when running seed script.

## Code Examples

### Session Access in Server Component
```typescript
// Source: https://authjs.dev/getting-started/session-management/protecting
import { auth } from '@/auth';

export default async function DashboardPage() {
  const session = await auth();
  // session is guaranteed non-null here (middleware redirects if not authenticated)
  return <div>Welcome, {session.user.name}</div>;
}
```

### Logout Button Component
```typescript
// Source: https://authjs.dev/getting-started/session-management/login
'use client';
import { logout } from '@/lib/auth/actions';
import { Button } from '@/components/ui/button';

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button variant="ghost" type="submit">Sign Out</Button>
    </form>
  );
}
```

### Rate Limiter (In-Memory)
```typescript
// src/lib/auth/rate-limit.ts
// D-13: 5 failed attempts -> 30-second cooldown, resets on restart
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30 * 1000;

export function checkRateLimit(username: string): { allowed: boolean; retryAfter?: number } {
  const record = failedAttempts.get(username);
  if (!record) return { allowed: true };
  
  const elapsed = Date.now() - record.lastAttempt;
  if (record.count >= MAX_ATTEMPTS && elapsed < COOLDOWN_MS) {
    return { allowed: false, retryAfter: Math.ceil((COOLDOWN_MS - elapsed) / 1000) };
  }
  
  if (elapsed >= COOLDOWN_MS) {
    failedAttempts.delete(username);
    return { allowed: true };
  }
  
  return { allowed: true };
}

export function recordFailedAttempt(username: string): void {
  const record = failedAttempts.get(username) || { count: 0, lastAttempt: 0 };
  record.count += 1;
  record.lastAttempt = Date.now();
  failedAttempts.set(username, record);
}

export function clearFailedAttempts(username: string): void {
  failedAttempts.delete(username);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getServerSession()` from `next-auth/next` | `auth()` from `@/auth` | Auth.js v5 (2024) | Single universal function for all server-side session access |
| `middleware.ts` | `proxy.ts` | Next.js 16 (2025) | DevDock uses Next.js 15, so still use `middleware.ts` |
| `NEXTAUTH_SECRET` env var | `AUTH_SECRET` env var | Auth.js v5 (2024) | Both work (aliased), but AUTH_SECRET is preferred going forward |
| `pages/api/auth/[...nextauth].ts` | `app/api/auth/[...nextauth]/route.ts` | Next.js App Router | Same catch-all, different file convention |
| `useSession()` for server access | `auth()` for server, `useSession()` for client | Auth.js v5 | Clear server/client boundary |

**Deprecated/outdated:**
- `getServerSession()`: Replaced by `auth()` in v5. [CITED: https://authjs.dev/guides/upgrade-to-v5]
- `next-auth/middleware` import: Replaced by exporting auth from config. [CITED: https://authjs.dev/guides/upgrade-to-v5]
- `NEXTAUTH_URL` env var: Auto-detected in v5. Only needed in production behind proxy. [CITED: https://authjs.dev/guides/upgrade-to-v5]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | bcrypt salt rounds of 12 is appropriate for this use case | Code Examples (seed script) | LOW -- 10-12 is standard. 10 is the bcrypt default, 12 adds marginal security at marginal cost. |
| A2 | `useActionState` is the correct React 19 hook for form actions (replaces `useFormState`) | Architecture Patterns | LOW -- React 19 renamed useFormState to useActionState. Next.js 15 + React 19 should have it. |
| A3 | Auth.js v5 signIn throws NEXT_REDIRECT that must be re-thrown | Common Pitfalls | MEDIUM -- This is the established pattern from community reports and Auth.js docs, but specific error type handling may vary between beta versions. |

## Open Questions

1. **AUTH_SECRET vs NEXTAUTH_SECRET migration**
   - What we know: Auth.js v5 aliases NEXTAUTH_SECRET to AUTH_SECRET. Both work.
   - What's unclear: Whether to migrate config.ts validation to AUTH_SECRET now or keep NEXTAUTH_SECRET for consistency with existing .env files.
   - Recommendation: Rename to AUTH_SECRET in config.ts and .env files. Clean break for v5 convention. Update the zod schema accordingly.

2. **Seed script invocation pattern**
   - What we know: D-06 says `npx devdock seed-admin`. This implies a package.json bin entry or a custom script.
   - What's unclear: Whether to use a package.json bin field (requires build step) or a simpler `npx tsx src/scripts/seed-admin.ts` approach.
   - Recommendation: Use a package.json scripts entry: `"seed-admin": "tsx src/scripts/seed-admin.ts"` invoked via `npm run seed-admin`. Simpler than bin entries. The D-06 naming is aspirational; the planner can adapt.

3. **SessionProvider necessity**
   - What we know: SessionProvider is needed for useSession() in client components. The dashboard placeholder shows username.
   - What's unclear: Whether the dashboard should use server component `auth()` or client component `useSession()`.
   - Recommendation: Use server component `auth()` for the dashboard page (simpler, no client bundle). Only add SessionProvider if client components need live session data later. Keep it minimal for this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently installed |
| Config file | None -- see Wave 0 |
| Quick run command | TBD after framework selection |
| Full suite command | TBD after framework selection |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Login with valid credentials returns session | integration | `npx vitest run tests/auth/login.test.ts` | No -- Wave 0 |
| AUTH-01 | Login with invalid credentials returns error | integration | `npx vitest run tests/auth/login.test.ts` | No -- Wave 0 |
| AUTH-02 | Session cookie is HTTP-only and has CSRF protection | integration | `npx vitest run tests/auth/session.test.ts` | No -- Wave 0 |
| AUTH-03 | Logout clears session and redirects | integration | `npx vitest run tests/auth/logout.test.ts` | No -- Wave 0 |
| AUTH-04 | Session persists across requests | integration | `npx vitest run tests/auth/session.test.ts` | No -- Wave 0 |
| AUTH-01 | Rate limiting blocks after 5 failures | unit | `npx vitest run tests/auth/rate-limit.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** Full test suite
- **Phase gate:** All auth tests green before verification

### Wave 0 Gaps
- [ ] Install vitest + @testing-library/react (or equivalent) [ASSUMED: vitest is the standard for Next.js 15 + Vite/Turbopack]
- [ ] `vitest.config.ts` -- framework config
- [ ] `tests/auth/login.test.ts` -- covers AUTH-01
- [ ] `tests/auth/session.test.ts` -- covers AUTH-02, AUTH-04
- [ ] `tests/auth/logout.test.ts` -- covers AUTH-03
- [ ] `tests/auth/rate-limit.test.ts` -- covers AUTH-01 (rate limiting)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Auth.js v5 Credentials provider + bcrypt (12 rounds) |
| V3 Session Management | yes | Auth.js JWT with 7-day maxAge, HTTP-only cookies |
| V4 Access Control | yes (basic) | Middleware-based route protection (authenticated/not) |
| V5 Input Validation | yes | zod validation on login form inputs, minimum password length |
| V6 Cryptography | yes | bcrypt for passwords, Auth.js for JWT signing (AUTH_SECRET) |

### Known Threat Patterns for Auth

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential stuffing | Spoofing | In-memory rate limiting (D-13: 5 attempts, 30s cooldown) |
| CSRF on login form | Tampering | Auth.js built-in double-submit cookie CSRF |
| Session fixation | Elevation of Privilege | Auth.js regenerates session on login by default |
| Username enumeration | Information Disclosure | Generic error message (D-04: "Invalid username or password") |
| JWT token theft | Spoofing | HTTP-only cookie (not accessible via JS), Secure flag in production |
| Password brute force | Spoofing | bcrypt cost factor (12 rounds) + rate limiting |

## Sources

### Primary (HIGH confidence)
- [npm registry] -- next-auth@beta 5.0.0-beta.30, bcrypt 6.0.0, @types/bcrypt 6.0.0 version verification
- [Codebase inspection] -- schema.ts, config.ts, package.json, layout.tsx, .env.local analysis
- [Auth.js official docs: installation](https://authjs.dev/getting-started/installation) -- Setup pattern
- [Auth.js official docs: upgrade to v5](https://authjs.dev/guides/upgrade-to-v5) -- Migration patterns, Edge split
- [Auth.js official docs: protecting routes](https://authjs.dev/getting-started/session-management/protecting) -- Middleware, server component, API route patterns
- [Auth.js official docs: login/logout](https://authjs.dev/getting-started/session-management/login) -- Server action patterns

### Secondary (MEDIUM confidence)
- [Auth.js migration guide](https://authjs.dev/getting-started/migrating-to-v5) -- Verified against official docs
- [Auth.js environment variables](https://authjs.dev/guides/environment-variables) -- AUTH_SECRET naming
- [GitHub discussion #9949](https://github.com/nextauthjs/next-auth/discussions/9949) -- Authorize function runs in Edge context (confirms need for split)
- [GitHub discussion #11394](https://github.com/nextauthjs/next-auth/discussions/11394) -- Edge runtime confirmation
- [GitHub issue #69002](https://github.com/vercel/next.js/issues/69002) -- bcrypt in middleware incompatibility

### Tertiary (LOW confidence)
- [Various Medium articles] -- Community patterns for Auth.js v5 credentials setup (cross-verified with official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified on npm registry, peer deps confirmed compatible
- Architecture: HIGH -- Edge split pattern is officially documented by Auth.js team
- Pitfalls: HIGH -- each pitfall verified via official docs, GitHub issues, or codebase inspection
- Security: HIGH -- CSRF and session handling are built into Auth.js; bcrypt is industry standard

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days -- Auth.js v5 is beta but patterns are stable)
