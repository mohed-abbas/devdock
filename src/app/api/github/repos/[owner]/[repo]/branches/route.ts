import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { githubAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createOctokit } from '@/lib/github/client';
import { config } from '@/lib/config';

type Params = { params: Promise<{ owner: string; repo: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!config.GITHUB_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'GitHub not configured' }, { status: 503 });
  }

  const { owner, repo } = await params;

  const [account] = await db
    .select()
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, session.user.id))
    .limit(1);

  if (!account) {
    return NextResponse.json({ error: 'GitHub not connected' }, { status: 404 });
  }

  try {
    const octokit = createOctokit(account.encryptedAccessToken, config.GITHUB_TOKEN_ENCRYPTION_KEY);
    const branches = await octokit.paginate(
      octokit.rest.repos.listBranches,
      { owner, repo, per_page: 100 },
    );

    return NextResponse.json(
      branches.map((b) => ({ name: b.name, protected: b.protected })),
    );
  } catch (err: unknown) {
    const error = err as { status?: number };
    if (error.status === 401) {
      await db.delete(githubAccounts).where(eq(githubAccounts.userId, session.user.id));
      return NextResponse.json({ error: 'GitHub token expired', expired: true }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 502 });
  }
}
