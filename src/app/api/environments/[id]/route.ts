import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { composeDown, removeDataDir, getProjectStatus } from '@/lib/docker/docker-service';
import { config } from '@/lib/config';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/environments/[id]
 * Returns a single environment for the authenticated user with Docker state reconciliation.
 */
export async function GET(request: NextRequest, { params }: Params) {
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

  // Reconcile Docker state for running/starting environments
  if (
    (env.status === 'running' || env.status === 'starting') &&
    env.dockerProjectName
  ) {
    try {
      const actual = await getProjectStatus(env.dockerProjectName);
      if (actual.status !== env.status) {
        await db
          .update(environments)
          .set({
            status: actual.status,
            errorMessage: actual.errorMessage ?? null,
          })
          .where(eq(environments.id, env.id));
        return NextResponse.json({
          ...env,
          status: actual.status,
          errorMessage: actual.errorMessage ?? null,
        });
      }
    } catch {
      // If Docker query fails, return DB state as-is
    }
  }

  return NextResponse.json(env);
}

/**
 * DELETE /api/environments/[id]
 * Removes containers, volumes, data directory, and DB record (D-12 full cleanup).
 */
export async function DELETE(request: NextRequest, { params }: Params) {
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

  // Prevent deletion during transitions (T-03-09)
  if (env.status === 'starting' || env.status === 'stopping') {
    return NextResponse.json(
      { error: 'Cannot delete environment while it is transitioning. Wait for it to finish.' },
      { status: 409 },
    );
  }

  // Visual feedback: set status to 'stopping'
  await db
    .update(environments)
    .set({ status: 'stopping' })
    .where(eq(environments.id, env.id));

  // Tear down Docker resources (ignore errors -- resources may not exist if creation failed)
  if (env.dockerProjectName) {
    const composePath = path.join(config.DEVDOCK_DATA_DIR, env.slug, 'docker-compose.yml');
    try {
      await composeDown(env.dockerProjectName, composePath);
    } catch {
      // Ignore -- compose project may not exist
    }
  }

  // Remove data directory (D-12)
  try {
    await removeDataDir(env.slug);
  } catch {
    // Ignore -- directory may not exist
  }

  // Delete DB record
  await db.delete(environments).where(eq(environments.id, id));

  return NextResponse.json({ success: true });
}
