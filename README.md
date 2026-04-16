# DevDock

Self-hosted remote development platform. Web dashboard for managing isolated,
on-demand Docker dev environments (with Claude Code pre-configured) alongside
production app monitoring — so a Claude Code Max subscription isn't wasted
when you can't sit at your main machine.

Stack: Next.js 15 (App Router) · PostgreSQL + Drizzle · Auth.js v5 ·
dockerode + docker compose · xterm.js + Socket.IO · Caddy/nginx.

---

## Prerequisites

- Node.js 20+ and npm
- Docker Engine (user in the `docker` group, socket at `/var/run/docker.sock`)
- PostgreSQL 16+ running locally (or reachable via `DATABASE_URL`)
- `openssl` (for generating secrets)

## 1. Install

```bash
git clone <this-repo> devdock
cd devdock
npm install
```

## 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`. At minimum set:

```bash
# Required
AUTH_SECRET=$(openssl rand -base64 32)

# If you want GitHub repo cloning (optional)
GITHUB_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

See `.env.example` for the full list and explanations.

### Preview subdomain proxy

Running environments are exposed at `{env-id}.{PREVIEW_DOMAIN}`. The default
`.env.example` uses **nip.io** so `*.127.0.0.1.nip.io` resolves to `127.0.0.1`
with no DNS or nginx setup required locally:

```
PREVIEW_DOMAIN=127.0.0.1.nip.io:3000
NEXT_PUBLIC_PREVIEW_DOMAIN=127.0.0.1.nip.io:3000
```

For production, point a real wildcard DNS record at the VPS and configure
nginx wildcard vhost + TLS (see `nginx/` if present).

### GitHub OAuth (optional)

Create an OAuth App at <https://github.com/settings/developers>. Authorization
callback URL: `${AUTH_URL}/api/github/callback`. Copy the client id/secret
into `.env.local` and set `GITHUB_TOKEN_ENCRYPTION_KEY` (64 hex chars).

## 3. Database

Create the database and the app role:

```bash
createdb devdock
psql devdock -c "CREATE USER devdock_app WITH PASSWORD 'devdock_dev_password';"
psql devdock -c "GRANT ALL PRIVILEGES ON DATABASE devdock TO devdock_app;"
psql devdock -c "GRANT ALL ON SCHEMA public TO devdock_app;"
```

Push the schema:

```bash
npx drizzle-kit push
```

Seed the first admin user:

```bash
npm run seed-admin
```

## 4. Run

DevDock is two processes in dev:

```bash
# terminal A — Next.js dashboard + API on :3000
npm run dev

# terminal B — terminal WebSocket server on :3001
npm run terminal:dev
```

Open <http://localhost:3000> and log in with the admin credentials from
`seed-admin`. To test a preview, create an environment with a preview port,
start it, then click the preview button.

## 5. Production build

```bash
npm run build
npm start              # Next.js (+ middleware, API routes)
npm run terminal:dev   # run the terminal server under your process manager
```

On the VPS, wire both under systemd and put Caddy or nginx in front for HTTPS
and wildcard subdomain routing to the Next.js process.

---

## Troubleshooting

- **Preview button opens but page won't load** — confirm
  `NEXT_PUBLIC_PREVIEW_DOMAIN` matches `PREVIEW_DOMAIN` and that the dev server
  is running on the port embedded in the domain (e.g. `:3000` for nip.io).
  `NEXT_PUBLIC_*` is inlined at build time, so restart `npm run dev` after
  changing it.
- **`docker.sock` permission denied** — add your user to the `docker` group
  and re-login, or run `sudo chmod 666 /var/run/docker.sock` for a quick local
  fix.
- **GitHub callback returns `github_error`** — check all three GitHub vars are
  set and the callback URL in the OAuth App matches `${AUTH_URL}/api/github/callback`.
