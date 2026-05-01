# syntax=docker/dockerfile:1.7
# DevDock multi-stage Dockerfile
# Targets:
#   - app-runner      → Next.js standalone server (default if no --target)
#   - terminal-runner → Socket.IO terminal server via tsx
# Base: node:22-slim (Debian) — REQUIRED for bcrypt native addon (RESEARCH.md Pitfall 6)

# ---------- Stage 1: deps — install all production + dev deps for build ----------
FROM node:22-slim AS deps
WORKDIR /app
# Build-essential + python are needed transiently for bcrypt's node-gyp on first install.
# git is also needed at *runtime* by docker-compose.override.yml's dev mode, which
# re-uses this stage as the running app container. docker-service.ts shells out
# to `git clone` (env launch) and `docker compose ...` (env start/stop). The
# production app-runner stage installs the same tooling separately for prod runs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      make \
      g++ \
      git \
      wget \
    && rm -rf /var/lib/apt/lists/*

# wget above is also required by the compose-level healthcheck
# (`wget -qO- http://localhost:3000/api/health`) which runs against this stage
# in dev mode (docker-compose.override.yml uses target: deps).

# Docker CLI + Compose v2 plugin — required for dev override which runs the app
# Next.js dev server out of this stage. See app-runner stage for rationale.
COPY --from=docker:28-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:28-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose

COPY package.json package-lock.json ./
# `npm ci` uses lockfile — reproducible, faster than install.
RUN npm ci

# ---------- Stage 2: builder — compile Next.js standalone output ----------
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_PREVIEW_DOMAIN is inlined by Next.js at build time (RESEARCH.md Pitfall 7).
ARG NEXT_PUBLIC_PREVIEW_DOMAIN=""
ENV NEXT_PUBLIC_PREVIEW_DOMAIN=${NEXT_PUBLIC_PREVIEW_DOMAIN}
ENV NEXT_TELEMETRY_DISABLED=1
# GAP-2 fix (phase 999.2.1): Next.js 15 page-data collection at build time
# evaluates src/lib/config.ts:loadConfig() which throws on missing DATABASE_URL
# / AUTH_SECRET. These placeholders are scoped to the builder stage ONLY and
# are obviously fake. Real values flow at runtime via compose env_file: .env.
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}
ARG AUTH_SECRET=build-time-placeholder-32chars-min-padding
ENV AUTH_SECRET=${AUTH_SECRET}
RUN npm run build

# ---------- Stage 3: app-runner — Next.js standalone runtime ----------
FROM node:22-slim AS app-runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Runtime tools:
#   - gosu       → privilege drop after GID fixup (RESEARCH.md Pitfall 5)
#   - postgresql-client → pg_isready, used by entrypoint (RESEARCH.md §2)
#   - wget       → healthcheck probe (compose healthcheck uses `wget -qO- ...`)
#   - ca-certificates → outbound HTTPS (Caddy admin calls are plain HTTP, but GitHub/Anthropic APIs may be called from the app)
#   - git        → used by docker-service.ts to clone GitHub repos when launching envs
RUN apt-get update && apt-get install -y --no-install-recommends \
      gosu \
      postgresql-client \
      wget \
      ca-certificates \
      git \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI + Compose v2 plugin from the official `docker:28-cli` image.
# We need ONLY the client — the daemon lives on the host and is reached via
# /var/run/docker.sock (mounted by docker-compose.yml). Multi-stage COPY is
# ~30MB lighter than wiring the download.docker.com apt repo and avoids
# pulling repo+key state into this image. docker-service.ts shells out to
# `docker compose -p ... up -d` (subcommand form), so the compose plugin is
# required — installing it under /usr/local/libexec/docker/cli-plugins/ is
# the canonical location the docker CLI auto-discovers.
COPY --from=docker:28-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:28-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose

# Non-root user — GID fixup happens at runtime in the entrypoint (Plan 04).
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs

# Copy Next.js standalone output. All three lines are required (public/ and .next/static/
# are NOT auto-copied — RESEARCH.md §"Next.js Standalone Output" critical caveat).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# drizzle-kit runtime resolution requires its transitive dependency tree
# (esbuild, jiti, @drizzle-team/brocli, hanji, etc.) — not just the drizzle-kit
# package itself. Copying ONLY `/node_modules/drizzle-kit` leaves those deps
# unresolvable and `npx --no-install drizzle-kit push` fails at boot
# (RESEARCH.md Pitfall 1 + gap-closure learning).
#
# SIMPLEST FIX: copy the entire deps-stage node_modules. Image-size cost is
# accepted (tens of MB) in exchange for guaranteed runtime resolution of
# drizzle-kit, tsx, and their transitive graph. This also covers tsx needed
# to run src/scripts/seed-admin-boot.ts from the entrypoint.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# drizzle.config.ts + the schema file the config references at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db/schema.ts ./src/lib/db/schema.ts
# seed-admin-boot.ts + the drizzle/pg pieces it imports (run via tsx from entrypoint).
COPY --from=builder --chown=nextjs:nodejs /app/src/scripts/seed-admin-boot.ts ./src/scripts/seed-admin-boot.ts

# Entrypoint script (authored in Plan 04). The COPY reference below is part of
# the Dockerfile contract; it will resolve once Plan 04 ships the real
# `scripts/entrypoint-app.sh`. Plan 03 does NOT create stub entrypoints — those
# files belong to Plan 04 (exclusive file ownership; see files_modified).
# This plan does NOT attempt `docker build`; build verification is Plan 10.
COPY --chmod=0755 scripts/entrypoint-app.sh /entrypoint.sh

EXPOSE 3000
# ENTRYPOINT runs as root so the script can perform GID fixup + exec gosu nextjs.
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]

# ---------- Stage 4: terminal-runner — Socket.IO terminal server ----------
FROM node:22-slim AS terminal-runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
      gosu \
      wget \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --shell /bin/bash --create-home termuser

# Terminal runs TypeScript directly via tsx — no build step, matches the existing
# `npm run terminal:dev` contract but production-flavored.
COPY --from=deps --chown=termuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=termuser:nodejs /app/server ./server
COPY --from=builder --chown=termuser:nodejs /app/src/lib/docker ./src/lib/docker
COPY --from=builder --chown=termuser:nodejs /app/src/lib/config.ts ./src/lib/config.ts
COPY --from=builder --chown=termuser:nodejs /app/src/lib/db/schema.ts ./src/lib/db/schema.ts
COPY --from=builder --chown=termuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=termuser:nodejs /app/tsconfig.json ./tsconfig.json

# Entrypoint (authored in Plan 04). Same contract as app-runner above.
COPY --chmod=0755 scripts/entrypoint-terminal.sh /entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["/entrypoint.sh"]
CMD ["tsx", "server/terminal-server.ts"]
