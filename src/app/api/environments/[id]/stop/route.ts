import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { composeStop } from '@/lib/docker/docker-service';
import { deregisterPreviewRoute } from '@/lib/docker/caddy-lifecycle';
import { config } from '@/lib/config';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/environments/[id]/stop
 * Stops a running environment. Returns 202, stops Docker in background.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [env] = await db
    .select()
    .from(environments)
    .where(and(eq(environments.id, id), eq(environments.userId, session.user.id)))
    .limit(1);

  if (!env) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }

  // Only running environments can be stopped
  if (env.status !== 'running') {
    return NextResponse.json(
      { error: 'Environment is not running.' },
      { status: 409 },
    );
  }

  // Update status to 'stopping'
  await db
    .update(environments)
    .set({ status: 'stopping' })
    .where(eq(environments.id, env.id));

  // Return 202 immediately
  const response = NextResponse.json({ success: true }, { status: 202 });

  // Fire background Docker stop
  const envId = env.id;
  const dockerProjectName = env.dockerProjectName!;
  const composePath = path.join(config.DEVDOCK_DATA_DIR, env.slug, 'docker-compose.yml');

  Promise.resolve().then(async () => {
    try {
      const result = await composeStop(dockerProjectName, composePath);
      if (result.success) {
        await db
          .update(environments)
          .set({ status: 'stopped' })
          .where(eq(environments.id, envId));
        // Deregister preview route from Caddy (D-11, 999.2). Idempotent no-op if unregistered.
        await deregisterPreviewRoute(env.slug);
      } else {
        await db
          .update(environments)
          .set({
            status: 'error',
            errorMessage: result.error?.slice(0, 500) ?? null,
          })
          .where(eq(environments.id, envId));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(environments)
        .set({
          status: 'error',
          errorMessage: message.slice(0, 500),
        })
        .where(eq(environments.id, envId));
    }
  });

  return response;
}
