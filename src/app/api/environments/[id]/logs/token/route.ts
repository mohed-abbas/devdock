import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { createSignedToken } from '../../../../../../../server/terminal-auth';
import { findDevContainerId } from '@/lib/docker/docker-service';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate id format
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid environment ID' }, { status: 400 });
  }

  // Verify environment exists, belongs to user, and is running (T-06-07: IDOR prevention)
  const [env] = await db
    .select()
    .from(environments)
    .where(and(
      eq(environments.id, id),
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

  // Find dev container ID via compose labels (Pitfall 5: always fresh lookup)
  const containerId = await findDevContainerId(env.dockerProjectName!);
  if (!containerId) {
    return NextResponse.json(
      { error: 'Dev container not found' },
      { status: 500 },
    );
  }

  // Generate HMAC-signed token (30s TTL, same as terminal)
  const token = createSignedToken({
    environmentId: id,
    userId: session.user.id,
    containerId,
    exp: Date.now() + 30_000,
  });

  return NextResponse.json({ token });
}
