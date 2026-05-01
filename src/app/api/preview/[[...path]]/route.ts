/**
 * Preview subdomain proxy — Next.js fallback path.
 *
 * Phase 999.2 update (D-11, D-18): Caddy (inside DevDock's compose stack) now
 * handles preview routing FIRST via the Caddy Admin API. Plan 08 wires
 * addPreviewRoute/removePreviewRoute into the environment lifecycle routes.
 *
 * This Next.js route remains as a fallback for:
 *   1. Environments created before the 999.2 cutover whose Caddy route was
 *      never registered.
 *   2. Request paths that reach Next.js directly (e.g., if host nginx is
 *      ever reconfigured to bypass Caddy temporarily).
 *
 * Deprecation-in-place (D-18): do not remove this file in 999.2. A follow-up
 * phase will remove it and the middleware.ts subdomain rewrite after a grace
 * period confirms Caddy routing is the sole code path in production.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Docker from 'dockerode';
import { config } from '@/lib/config';

const docker = new Docker({ socketPath: config.DOCKER_SOCKET });

// Headers to strip before forwarding to container (prevent session leakage, T-06-06-01)
const STRIP_HEADERS = ['cookie', 'authorization'];

function extractEnvIdFromHost(host: string | null): string | null {
  if (!host) return null;
  // Host looks like: {env-id}.preview.devdock.example.com[:port]
  // Strip port first (e.g., ":3000" in local dev)
  const hostname = host.split(':')[0];
  const previewDomain = config.PREVIEW_DOMAIN.split(':')[0]; // Strip port from config too
  if (!previewDomain || !hostname.endsWith(previewDomain)) return null;
  const prefix = hostname.slice(0, hostname.length - previewDomain.length - 1); // -1 for the dot
  // Validate UUID format (basic check)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prefix)) {
    return null;
  }
  return prefix;
}

async function proxyRequest(request: NextRequest) {
  const host = request.headers.get('host');
  const envId = extractEnvIdFromHost(host);
  if (!envId) {
    return new NextResponse('Preview not available', { status: 404 });
  }

  // Look up environment -- no user auth needed, UUID is unguessable (T-06-06-02)
  const [env] = await db
    .select()
    .from(environments)
    .where(eq(environments.id, envId))
    .limit(1);

  if (!env || env.status !== 'running' || !env.previewPort) {
    return new NextResponse('Preview not available', { status: 404 });
  }

  // Find dev container by compose labels
  const containers = await docker.listContainers({
    filters: {
      label: [
        `com.docker.compose.project=${env.dockerProjectName}`,
        'com.docker.compose.service=dev',
      ],
    },
  });

  if (containers.length === 0) {
    return new NextResponse('Container not found', { status: 503 });
  }

  const inspection = await docker.getContainer(containers[0].Id).inspect();
  const networks = inspection.NetworkSettings.Networks;
  const networkName = Object.keys(networks)[0];
  const containerIp = networks[networkName]?.IPAddress;

  if (!containerIp) {
    return new NextResponse('Container IP unavailable', { status: 503 });
  }

  // Build target URL -- path is relative to subdomain root (no rewriting needed!)
  const url = new URL(request.url);
  const targetUrl = `http://${containerIp}:${env.previewPort}${url.pathname}${url.search}`;

  const forwardHeaders = new Headers(request.headers);
  for (const header of STRIP_HEADERS) {
    forwardHeaders.delete(header);
  }
  forwardHeaders.set('host', `${containerIp}:${env.previewPort}`);

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      // @ts-expect-error -- duplex needed for streaming body
      duplex: 'half',
    });

    const responseHeaders = new Headers(upstreamRes.headers);
    responseHeaders.delete('transfer-encoding');
    // fetch() auto-decompresses gzip/brotli -- strip content-encoding
    // so the browser doesn't try to decompress already-decoded body
    responseHeaders.delete('content-encoding');

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch {
    return new NextResponse('Upstream connection failed', { status: 502 });
  }
}

// Support all HTTP methods for full app proxying
export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
