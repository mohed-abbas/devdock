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
- Docker Engine + Docker Compose v2 (user in the `docker` group, socket at `/var/run/docker.sock`)
- PostgreSQL 16+ running locally (or reachable via `DATABASE_URL`)
- `openssl`, `psql`, `createdb` on `PATH`

## 1. Install

```bash
git clone https://github.com/mohed-abbas/devdock.git
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

Create the database and the app role. Match the password you used in
`DATABASE_URL` inside `.env.local`:

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

Seed the first admin user (interactive prompt for username/password):

```bash
npm run seed-admin
```

## 4. Build the base dev-environment image

Every dev environment is spawned from `devdock-base:latest` (Ubuntu 24.04 +
Node 22 + Python 3 + Claude Code CLI). Build it once:

```bash
docker build -t devdock-base:latest docker/base/
```

Docker Compose will also auto-build if the image is missing, but pre-building
avoids a ~5 min stall on the first environment start.

## 5. Run

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

### Claude Code inside environments (optional)

For Claude Code CLI to work inside spawned containers, set either in `.env.local`:

- `CLAUDE_CONFIG_PATH=/home/you/.claude` — mounts your host `~/.claude` read-only
  so the container inherits your login, OR
- `ANTHROPIC_API_KEY=...` — passed into the container env directly.

## 6. Production build

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
- **Preview button not visible on a running env** — the environment has no
  preview port set. Click the pencil/edit icon and enter the port your app
  listens on inside the container (e.g. `3000` for Next, `5173` for Vite).
- **`docker.sock` permission denied** — add your user to the `docker` group
  and re-login, or run `sudo chmod 666 /var/run/docker.sock` for a quick local
  fix.
- **Environment fails to start: `image devdock-base:latest not found`** — run
  `docker build -t devdock-base:latest docker/base/`.
- **`drizzle-kit push` fails with password auth** — your `DATABASE_URL`
  password must match the `CREATE USER ... WITH PASSWORD` value from step 3.
- **GitHub callback returns `github_error`** — check all three GitHub vars are
  set and the callback URL in the OAuth App matches `${AUTH_URL}/api/github/callback`.
