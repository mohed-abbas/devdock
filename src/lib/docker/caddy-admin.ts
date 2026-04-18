/**
 * Caddy Admin API client — idempotent preview route management (Phase 999.2, D-11).
 *
 * Wire-level contract:
 *   - addPreviewRoute: DELETE /id/preview-{slug} (best-effort), then POST to routes array
 *     (RESEARCH.md §6; Pitfall 4 — the routes array has no native upsert, so we delete-then-post)
 *   - removePreviewRoute: DELETE /id/preview-{slug}; 404 is success (idempotent)
 *   - getServerKey: GET /config/apps/http/servers/ → first key (RESEARCH.md Pitfall 8 —
 *     "srv0" is convention but not guaranteed, so we discover at runtime + cache)
 *
 * Security:
 *   - All inputs validated against allow-list regexes before URL interpolation
 *   - Errors truncated to 500 chars (pattern match with docker-service.ts)
 *   - No retries — upstream callers decide retry policy
 */

import type { AddPreviewRouteInput, CaddyRoute } from './caddy-admin.types';

// Read from process.env rather than config.CADDY_ADMIN_URL to keep this module
// import-safe when config validation is not desired (e.g. unit tests that stub env).
// In production, config.ts has already validated CADDY_ADMIN_URL is a URL.
function adminUrl(): string {
  return process.env.CADDY_ADMIN_URL || 'http://caddy:2019';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTAINER_NAME_RE = /^devdock-[a-z0-9-]+-dev$/;
const SLUG_RE = /^[a-z0-9-]+$/;

let cachedServerKey: string | null = null;

function truncate(s: string): string {
  return s.length > 500 ? s.slice(0, 500) : s;
}

export async function getServerKey(): Promise<string> {
  if (cachedServerKey) return cachedServerKey;
  const url = `${adminUrl()}/config/apps/http/servers/`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(truncate(`caddy admin GET servers failed: ${res.status} ${body}`));
  }
  const servers = (await res.json()) as Record<string, unknown>;
  const keys = Object.keys(servers);
  if (keys.length === 0) {
    throw new Error('caddy admin: no servers configured (expected at least "srv0")');
  }
  // Prefer srv0 if present (Caddyfile default), else fall back to first key.
  cachedServerKey = keys.includes('srv0') ? 'srv0' : keys[0];
  return cachedServerKey;
}

// Exposed for tests so they can reset between loadModule() calls if needed.
export function __resetServerKeyCacheForTests(): void {
  cachedServerKey = null;
}

function validateInput(input: AddPreviewRouteInput): void {
  if (!SLUG_RE.test(input.envSlug)) {
    throw new Error(`invalid envSlug: must match ${SLUG_RE}`);
  }
  if (!UUID_RE.test(input.envId)) {
    throw new Error(`invalid envId: must be a UUID`);
  }
  if (!CONTAINER_NAME_RE.test(input.containerName)) {
    throw new Error(`invalid container name: must match ${CONTAINER_NAME_RE}`);
  }
  if (!Number.isInteger(input.previewPort) || input.previewPort < 1 || input.previewPort > 65535) {
    throw new Error(`invalid port: must be 1..65535`);
  }
  // previewDomain is a user-controlled config value — allow typical domains + optional port for local dev.
  if (!/^[a-z0-9.\-:]+$/i.test(input.previewDomain)) {
    throw new Error(`invalid previewDomain`);
  }
}

export async function addPreviewRoute(input: AddPreviewRouteInput): Promise<void> {
  validateInput(input);
  const serverKey = await getServerKey();
  const routeId = `preview-${input.envSlug}`;
  const hostname = `${input.envId}.${input.previewDomain}`;

  const route: CaddyRoute = {
    '@id': routeId,
    match: [{ host: [hostname] }],
    handle: [
      {
        handler: 'reverse_proxy',
        upstreams: [{ dial: `${input.containerName}:${input.previewPort}` }],
      },
    ],
    terminal: true,
  };

  // Step 1: best-effort delete (ignore 404, ignore network errors — POST will surface real problems).
  try {
    await fetch(`${adminUrl()}/id/${routeId}`, { method: 'DELETE' });
  } catch {
    /* swallow — delete is best-effort */
  }

  // Step 2: POST the new route to the server's routes array.
  const res = await fetch(`${adminUrl()}/config/apps/http/servers/${serverKey}/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(route),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(truncate(`caddy admin POST route failed: ${res.status} ${body}`));
  }
}

export async function removePreviewRoute(envSlug: string): Promise<void> {
  if (!SLUG_RE.test(envSlug)) {
    throw new Error(`invalid envSlug: must match ${SLUG_RE}`);
  }
  const routeId = `preview-${envSlug}`;
  const res = await fetch(`${adminUrl()}/id/${routeId}`, { method: 'DELETE' });
  if (res.status === 404) return; // idempotent delete
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(truncate(`caddy admin DELETE route failed: ${res.status} ${body}`));
  }
}
