import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createSignedToken } from '../../../../../server/terminal-auth';
import { findDevContainerId } from '@/lib/docker/docker-service';
import { z } from 'zod';

const requestSchema = z.object({
  environmentId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid environmentId' }, { status: 400 });
  }

  const { environmentId } = parsed.data;

  // Verify environment exists, belongs to user, and is running
  const [env] = await db
    .select()
    .from(environments)
    .where(and(
      eq(environments.id, environmentId),
      eq(environments.userId, session.user.id),
    ))
    .limit(1);

  if (!env) {
    return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
  }

  if (env.status !== 'running') {
    return NextResponse.json(
      { error: 'Environment is not running' },
      { status: 400 },
    );
  }

  // Find the dev container ID via compose labels (Pitfall 7)
  const containerId = await findDevContainerId(env.dockerProjectName!);
  if (!containerId) {
    return NextResponse.json(
      { error: 'Dev container not found' },
      { status: 500 },
    );
  }

  // Generate HMAC-signed token (D-05: 30s TTL, cross-process compatible)
  const token = createSignedToken({
    environmentId,
    userId: session.user.id,
    containerId,
    exp: Date.now() + 30_000,
  });

  return NextResponse.json({ token });
}
