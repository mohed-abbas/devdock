# Phase 2: Authentication - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers username/password authentication with secure JWT sessions, CSRF protection, logout, and route guarding. Users can log in, stay logged in across refreshes, and log out from any page. A placeholder dashboard page exists as the post-login landing. No user management UI, no GitHub OAuth, no role-based access enforcement beyond "authenticated or not."

</domain>

<decisions>
## Implementation Decisions

### Login Page Design
- **D-01:** Minimal centered card on dark background — username field, password field, "Sign In" button. Uses existing shadcn/ui Card and Button components.
- **D-02:** "DevDock" title text above the card with subtitle "Remote development platform." No custom logo, no icon, no illustration.
- **D-03:** No "Remember me" checkbox — sessions use a fixed 7-day duration.
- **D-04:** Login errors displayed as inline red text below the form: "Invalid username or password." Generic message only — never reveal which field is wrong.
- **D-05:** Use `frontend-design` skill and GSD UI skills/experts during design and implementation for high-quality visual output.

### Initial Admin Seeding
- **D-06:** First admin user created via CLI seed script (`npx devdock seed-admin`). Prompts for username and password interactively.
- **D-07:** Same CLI can create regular users too. No admin API endpoint or UI for user management in this phase.
- **D-08:** Password hashing: bcrypt.
- **D-09:** Minimum password requirement: 8 characters. No complexity rules.

### Session & Security Strategy
- **D-10:** JWT sessions via Auth.js v5 Credentials provider. No database session table needed.
- **D-11:** Session duration: 7 days. No "remember me" variation.
- **D-12:** CSRF protection: Auth.js built-in CSRF for its endpoints. Custom API routes verified via session token in Next.js middleware (same-origin check).
- **D-13:** Rate limiting: Simple in-memory delay after 5 failed login attempts — 30-second cooldown. Resets on server restart (acceptable for brute-force deterrence).

### Post-Login Experience
- **D-14:** After login, redirect to `/dashboard` — a placeholder page showing "Welcome, [username]" with a logout button. Real dashboard content comes in Phase 6.
- **D-15:** Next.js middleware protects all `/dashboard/*` and `/api/*` routes. Unauthenticated requests redirect to `/login` with return-to URL preserved.
- **D-16:** Authenticated users hitting `/login` or `/` are auto-redirected to `/dashboard`.
- **D-17:** Logout clears session and redirects to `/login`.

### Claude's Discretion
- Auth.js v5 configuration details (callback structure, JWT customization)
- Exact middleware matcher patterns
- Form validation UX (client-side vs server-side)
- Seed script implementation details (standalone script vs Next.js custom server command)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `.planning/research/ARCHITECTURE.md` — Component boundaries, data flow, coexistence strategy
- `.planning/research/STACK.md` — Technology choices (Auth.js v5, bcrypt, JWT sessions)

### Security
- `.planning/research/PITFALLS.md` — Critical pitfalls including credential leakage and auth bypass vectors

### Requirements
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-04 are this phase's scope

### Schema
- `src/lib/db/schema.ts` — Users table with username, passwordHash, role fields already defined

### Config
- `src/lib/config.ts` — NEXTAUTH_URL and NEXTAUTH_SECRET already validated via zod

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` — shadcn/ui Button component, ready for login form
- `src/components/ui/card.tsx` — shadcn/ui Card component, ready for login card layout
- `src/lib/db/schema.ts` — Users table with `username`, `passwordHash`, `role` (admin/user enum) already defined
- `src/lib/config.ts` — Environment config with `NEXTAUTH_URL` and `NEXTAUTH_SECRET` validation
- `src/lib/utils.ts` — Utility functions (likely includes `cn()` for className merging)

### Established Patterns
- Dark mode by default (`<html className="dark">`)
- Inter font as default sans-serif
- Tailwind CSS + shadcn/ui for styling
- Zod for runtime validation
- Drizzle ORM for database access

### Integration Points
- `src/app/layout.tsx` — Root layout needs session provider wrapping
- `src/app/api/` — Existing `/api/health` route; auth endpoints go here
- `src/lib/db/` — Database connection ready for user queries
- Next.js middleware (new file) — For route protection

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants the `frontend-design` skill and GSD UI skills used for the login page and dashboard placeholder — not just functional but visually polished
- CLI seed script should feel like a proper tool interaction (clear prompts, confirmation, success message)
- The placeholder dashboard should have a minimal header/nav pattern that Phase 6 can build on

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-authentication*
*Context gathered: 2026-04-09*
