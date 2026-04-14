import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Docker from 'dockerode';
import { config } from '@/lib/config';

const docker = new Docker({ socketPath: config.DOCKER_SOCKET });

type Params = { params: Promise<{ id: string; path?: string[] }> };

// Headers to strip before forwarding to container (prevent session leakage)
const STRIP_HEADERS = ['cookie', 'authorization'];

async function proxyRequest(request: NextRequest, { params }: Params) {
  const { id, path: pathSegments } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Look up environment -- scoped to user (IDOR prevention, T-06-01)
  const [env] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, id), eq(environments.userId, session.user.id)))
    .limit(1);

  if (!env || env.status !== 'running' || !env.previewPort) {
    // Return 404 (not 403) to avoid information disclosure (T-06-03)
    return new NextResponse('Preview not available', { status: 404 });
  }

  // Find the dev container by compose labels
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

  // Get container IP via Docker inspect
  const inspection = await docker.getContainer(containers[0].Id).inspect();
  const networks = inspection.NetworkSettings.Networks;
  const networkName = Object.keys(networks)[0];
  const containerIp = networks[networkName]?.IPAddress;

  if (!containerIp) {
    return new NextResponse('Container IP unavailable', { status: 503 });
  }

  // Build target URL -- strip the /api/environments/[id]/preview/ prefix
  const targetPath = '/' + (pathSegments?.join('/') || '');
  const search = request.nextUrl.search || '';
  const targetUrl = `http://${containerIp}:${env.previewPort}${targetPath}${search}`;

  // Forward the request, stripping sensitive headers (T-06-02)
  const forwardHeaders = new Headers(request.headers);
  for (const header of STRIP_HEADERS) {
    forwardHeaders.delete(header);
  }
  // Set correct Host header for the container app
  forwardHeaders.set('host', `${containerIp}:${env.previewPort}`);

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      // @ts-expect-error -- duplex needed for streaming body
      duplex: 'half',
    });

    // Forward response, preserving status and headers
    const responseHeaders = new Headers(upstreamRes.headers);
    // Remove hop-by-hop headers
    responseHeaders.delete('transfer-encoding');

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
