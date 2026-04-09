# Phase 2: Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 02-authentication
**Areas discussed:** Login page design, Initial admin seeding, Session & security strategy, Post-login experience

---

## Login Page Design

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal centered card | Dark background, centered card with username/password fields, DevDock title above | ✓ |
| Split layout | Left: branding panel. Right: login form | |
| Full-page form | No card, just centered fields on dark background | |
| You decide | Claude picks | |

**User's choice:** Minimal centered card
**Notes:** Matches existing dark theme and reuses Card component from shadcn/ui

---

| Option | Description | Selected |
|--------|-------------|----------|
| No remember me | Fixed session duration, keep it simple | ✓ |
| Yes, with longer session | Checked = 30-day, unchecked = browser session | |
| You decide | Claude picks | |

**User's choice:** No remember me — fixed session duration
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error below form | Red text below form: "Invalid username or password." | ✓ |
| Toast notification | Error as toast/snackbar in corner | |
| You decide | Claude picks | |

**User's choice:** Inline error below form
**Notes:** Generic error message only — security best practice

---

| Option | Description | Selected |
|--------|-------------|----------|
| Title only | "DevDock" text with subtitle, no icon/logo | ✓ |
| Simple icon + title | Lucide icon next to title | |
| You decide | Claude picks | |

**User's choice:** Title only
**Notes:** None

---

## Initial Admin Seeding

| Option | Description | Selected |
|--------|-------------|----------|
| CLI seed script | `npx devdock seed-admin` prompts for username/password | ✓ |
| Environment variables | Auto-create admin from env vars on first boot | |
| First-run setup wizard | UI-based setup if no users exist | |
| You decide | Claude picks | |

**User's choice:** CLI seed script
**Notes:** Run once after deployment

---

| Option | Description | Selected |
|--------|-------------|----------|
| CLI only for now | Same CLI creates admin or regular users | ✓ |
| Admin API endpoint now | POST /api/admin/users for future dashboard | |
| You decide | Claude picks | |

**User's choice:** CLI only for now
**Notes:** Admin dashboard for user management is Phase 6+ territory

---

| Option | Description | Selected |
|--------|-------------|----------|
| bcrypt | Battle-tested, Auth.js examples use it | ✓ |
| argon2 | OWASP-recommended, native binding needed | |
| You decide | Claude picks | |

**User's choice:** bcrypt
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum 8 characters only | Simple length check, no complexity rules | ✓ |
| Length + complexity | 8 chars + uppercase + number | |
| You decide | Claude picks | |

**User's choice:** Minimum 8 characters only
**Notes:** Self-hosted tool — user sets own passwords

---

## Session & Security Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| JWT sessions | Stateless tokens in HTTP-only cookies, no session table | ✓ |
| Database sessions | Session in PostgreSQL, instant revocation possible | |
| You decide | Claude picks | |

**User's choice:** JWT sessions
**Notes:** Aligned with CLAUDE.md recommendation

---

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days | Good balance for personal dev tool | ✓ |
| 30 days | Longer convenience, less secure | |
| 24 hours | Must log in daily | |
| You decide | Claude picks | |

**User's choice:** 7 days
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auth.js built-in CSRF | Built-in for Auth.js endpoints, middleware for custom routes | ✓ |
| Double-submit cookie | Custom CSRF token in cookie + header | |
| You decide | Claude picks | |

**User's choice:** Auth.js built-in CSRF
**Notes:** Minimal custom code needed

---

| Option | Description | Selected |
|--------|-------------|----------|
| Simple delay after failures | 5 failed attempts → 30s cooldown, in-memory | ✓ |
| No rate limiting | Skip for now | |
| You decide | Claude picks | |

**User's choice:** Simple delay after failures
**Notes:** Resets on server restart, acceptable for deterrence

---

## Post-Login Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder dashboard | /dashboard with "Welcome, [username]" and logout button | ✓ |
| Redirect to root / | Just go to home page | |
| You decide | Claude picks | |

**User's choice:** Placeholder dashboard
**Notes:** Real dashboard content comes in Phase 6

---

| Option | Description | Selected |
|--------|-------------|----------|
| Middleware redirect to /login | Checks all /dashboard/* and /api/*, preserves return-to URL | ✓ |
| Middleware redirect, no return-to | Always goes to /dashboard after login | |
| You decide | Claude picks | |

**User's choice:** Middleware redirect with return-to URL
**Notes:** Standard Auth.js middleware pattern

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-redirect to /dashboard | Authenticated users on /login or / go to /dashboard | ✓ |
| Show login page anyway | Always show login at / | |
| You decide | Claude picks | |

**User's choice:** Auto-redirect to /dashboard
**Notes:** Standard behavior

---

| Option | Description | Selected |
|--------|-------------|----------|
| Back to /login | Clear session, redirect to login | ✓ |
| Back to / with message | Public landing page with logout confirmation | |
| You decide | Claude picks | |

**User's choice:** Back to /login
**Notes:** None

---

## Claude's Discretion

- Auth.js v5 configuration details (callback structure, JWT customization)
- Exact middleware matcher patterns
- Form validation UX (client-side vs server-side)
- Seed script implementation details

## Deferred Ideas

None — discussion stayed within phase scope
