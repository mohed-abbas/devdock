import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import path from 'path';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { config } from '@/lib/config';
import { generateSlug, isValidSlug } from '@/lib/docker/slug';
import { generateComposeFile } from '@/lib/docker/compose-generator';
import { composeUp, cloneRepo, getProjectStatus } from '@/lib/docker/docker-service';
import { githubAccounts } from '@/lib/db/schema';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100),
  repoUrl: z.string().url('Please enter a valid URL.').optional().or(z.literal('')),
  branch: z.string().max(255).optional(),
  enablePostgres: z.boolean().default(false),
  enableRedis: z.boolean().default(false),
});

/**
 * GET /api/environments
 * Returns all environments for the authenticated user with current Docker status.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const envs = await db
    .select()
    .from(environments)
    .where(eq(environments.userId, session.user.id))
    .orderBy(desc(environments.createdAt));

  // Reconcile Docker state for running/starting environments
  const reconciled = await Promise.all(
    envs.map(async (env) => {
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
            return {
              ...env,
              status: actual.status as typeof env.status,
              errorMessage: actual.errorMessage ?? null,
            };
          }
        } catch {
          // If Docker query fails, return DB state as-is
        }
      }
      return env;
    }),
  );

  return NextResponse.json(reconciled);
}

/**
 * POST /api/environments
 * Creates a new environment. Returns 202 immediately, starts Docker in background.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse and validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // Generate and validate slug
  const slug = generateSlug(parsed.data.name);
  if (!isValidSlug(slug)) {
    return NextResponse.json(
      { error: { name: ['Name must contain at least one letter or number.'] } },
      { status: 400 },
    );
  }

  // Check uniqueness: same slug + same user
  const [existing] = await db
    .select({ id: environments.id })
    .from(environments)
    .where(and(eq(environments.slug, slug), eq(environments.userId, session.user.id)))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: { name: ['An environment with this name already exists.'] } },
      { status: 409 },
    );
  }

  // Check concurrent environment limit (T-03-08)
  // Count running + starting environments separately
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

  const dockerProjectName = `devdock-${slug}`;
  const networkName = `devdock-${slug}-net`;
  const hostUid = process.getuid?.() ?? 1000;
  const hostGid = process.getgid?.() ?? 1000;

  // Insert DB record with status 'starting'
  const [newEnv] = await db
    .insert(environments)
    .values({
      userId: session.user.id,
      name: parsed.data.name,
      slug,
      repoUrl: parsed.data.repoUrl || null,
      branch: parsed.data.branch || null,
      status: 'starting',
      composeConfig: {
        enablePostgres: parsed.data.enablePostgres,
        enableRedis: parsed.data.enableRedis,
      },
      dockerProjectName,
      networkName,
    })
    .returning();

  // Return 202 immediately -- Docker operations happen in background (D-04)
  const response = NextResponse.json(newEnv, { status: 202 });

  // Fire background Docker operations (non-blocking)
  const envId = newEnv.id;
  const repoUrl = parsed.data.repoUrl;
  const enablePostgres = parsed.data.enablePostgres;
  const enableRedis = parsed.data.enableRedis;
  const envName = parsed.data.name;

  Promise.resolve().then(async () => {
    try {
      // Generate compose file
      const composePath = await generateComposeFile(
        {
          projectSlug: slug,
          projectName: envName,
          baseImage: 'devdock-base:latest',
          hostUid,
          hostGid,
          enablePostgres,
          enableRedis,
          claudeConfigPath: config.CLAUDE_CONFIG_PATH || '',
          anthropicApiKey: config.ANTHROPIC_API_KEY || '',
        },
        config.DEVDOCK_DATA_DIR,
      );

      // Clone repo if URL provided
      if (repoUrl && repoUrl !== '') {
        // Look up GitHub token for private repo auth
        let ghToken: string | undefined;
        const [ghAccount] = await db
          .select({ encryptedAccessToken: githubAccounts.encryptedAccessToken })
          .from(githubAccounts)
          .where(eq(githubAccounts.userId, session.user.id))
          .limit(1);

        if (ghAccount && config.GITHUB_TOKEN_ENCRYPTION_KEY) {
          const { decrypt } = await import('@/lib/github/encryption');
          ghToken = decrypt(ghAccount.encryptedAccessToken, config.GITHUB_TOKEN_ENCRYPTION_KEY);
        }

        const cloneResult = await cloneRepo(
          repoUrl,
          path.join(config.DEVDOCK_DATA_DIR, slug, 'workspace'),
          parsed.data.branch || undefined,
          ghToken,
        );
        if (!cloneResult.success) {
          await db
            .update(environments)
            .set({
              status: 'error',
              errorMessage: `Clone failed: ${cloneResult.error?.slice(0, 480)}`,
            })
            .where(eq(environments.id, envId));
          return;
        }
      }

      // Start Docker Compose
      const result = await composeUp(dockerProjectName, composePath);
      if (result.success) {
        await db
          .update(environments)
          .set({ status: 'running', lastActivityAt: new Date() })
          .where(eq(environments.id, envId));
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
