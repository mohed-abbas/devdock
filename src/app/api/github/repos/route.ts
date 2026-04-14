import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { githubAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createOctokit } from '@/lib/github/client';
import { config } from '@/lib/config';

// In-memory cache per user, 5 minute TTL (D-05, RESEARCH Pattern 5)
const repoCache = new Map<string, { data: unknown[]; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000;

interface RepoItem {
  id: number;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  cloneUrl: string;
  pushedAt: string | null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!config.GITHUB_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.json({ error: 'GitHub not configured' }, { status: 503 });
  }

  // Check cache first
  const cached = repoCache.get(session.user.id);
  if (cached && Date.now() < cached.expiry) {
    return NextResponse.json(cached.data);
  }

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

    // Paginate up to 500 repos (5 pages of 100), sorted by pushed_at desc (D-06)
    const repos = await octokit.paginate(
      octokit.rest.repos.listForAuthenticatedUser,
      { sort: 'pushed', direction: 'desc', per_page: 100, type: 'all' },
      (response, done) => {
        if (response.data.length >= 500) done();
        return response.data;
      },
    );

    const mapped: RepoItem[] = repos.slice(0, 500).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      private: r.private,
      defaultBranch: r.default_branch,
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      pushedAt: r.pushed_at,
    }));

    // Cache for 5 minutes
    repoCache.set(session.user.id, { data: mapped, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json(mapped);
  } catch (err: unknown) {
    // If 401 from GitHub, token is expired/revoked (Pitfall 6)
    const error = err as { status?: number };
    if (error.status === 401) {
      await db.delete(githubAccounts).where(eq(githubAccounts.userId, session.user.id));
      repoCache.delete(session.user.id);
      return NextResponse.json({ error: 'GitHub token expired', expired: true }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 502 });
  }
}
