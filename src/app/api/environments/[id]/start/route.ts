import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { composeUp } from '@/lib/docker/docker-service';
import { PreviewRegistrationError, registerPreviewRoute } from '@/lib/docker/caddy-lifecycle';
import { config } from '@/lib/config';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/environments/[id]/start
 * Starts a stopped or errored environment. Returns 202, starts Docker in background.
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

  // Only stopped or error environments can be started
  if (env.status !== 'stopped' && env.status !== 'error') {
    return NextResponse.json(
      { error: 'Environment is not in a startable state.' },
      { status: 409 },
    );
  }

  // Check concurrent environment limit (T-03-08)
  const runningEnvs = await db
    .select({ id: environments.id })
    .from(environments)
    .where(
      and(
        eq(environments.userId, session.user.id),
        eq(environments.status, 'running'),
      ),
    );

  const startingEnvs = await db
    .select({ id: environments.id })
    .from(environments)
    .where(
      and(
        eq(environments.userId, session.user.id),
        eq(environments.status, 'starting'),
      ),
    );

  const activeCount = runningEnvs.length + startingEnvs.length;
  if (activeCount >= config.DEVDOCK_MAX_CONCURRENT_ENVS) {
    return NextResponse.json(
      { error: 'Maximum number of running environments reached. Stop one to start another.' },
      { status: 429 },
    );
  }

  // Update status to 'starting', clear previous error
  await db
    .update(environments)
    .set({ status: 'starting', errorMessage: null })
    .where(eq(environments.id, env.id));

  // Return 202 immediately
  const response = NextResponse.json({ success: true }, { status: 202 });

  // Fire background Docker start
  const envId = env.id;
  const dockerProjectName = env.dockerProjectName!;
  const composePath = path.join(config.DEVDOCK_DATA_DIR, env.slug, 'docker-compose.yml');

  Promise.resolve().then(async () => {
    try {
      const result = await composeUp(dockerProjectName, composePath);
      if (result.success) {
        await db
          .update(environments)
          .set({ status: 'running', lastActivityAt: new Date() })
          .where(eq(environments.id, envId));
        // Register preview route with Caddy (D-11, 999.2). No-op if PREVIEW_DOMAIN unset.
        // The env is already running at this point — a Caddy failure means the
        // container works but its preview URL won't route. Surface the failure
        // via errorMessage instead of flipping status to 'error'; the env card
        // still shows green, with a tooltip explaining preview is unavailable.
        try {
          await registerPreviewRoute({
            id: env.id,
            slug: env.slug,
            previewPort: env.previewPort,
          });
        } catch (err) {
          if (err instanceof PreviewRegistrationError) {
            await db
              .update(environments)
              .set({ errorMessage: err.message.slice(0, 500) })
              .where(eq(environments.id, envId));
          } else {
            throw err;
          }
        }
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
