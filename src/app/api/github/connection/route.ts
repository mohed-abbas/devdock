import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { githubAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [account] = await db
    .select({
      githubUsername: githubAccounts.githubUsername,
      avatarUrl: githubAccounts.avatarUrl,
      connectedAt: githubAccounts.connectedAt,
    })
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, session.user.id))
    .limit(1);

  if (!account) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    username: account.githubUsername,
    avatarUrl: account.avatarUrl,
    connectedAt: account.connectedAt,
  });
}
