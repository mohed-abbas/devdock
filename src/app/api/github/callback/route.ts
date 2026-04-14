import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { config } from '@/lib/config';
import { exchangeCodeForToken } from '@/lib/github/oauth';
import { encrypt } from '@/lib/github/encryption';
import { db } from '@/lib/db';
import { githubAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Octokit } from '@octokit/rest';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.redirect(new URL('/login', request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const settingsUrl = new URL('/dashboard/settings', request.url);

  if (error) {
    settingsUrl.searchParams.set('github_error', 'oauth_denied');
    return Response.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set('github_error', 'missing_params');
    return Response.redirect(settingsUrl);
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('github_oauth_state')?.value;
  cookieStore.delete('github_oauth_state');

  if (!storedState || storedState !== state) {
    settingsUrl.searchParams.set('github_error', 'state_mismatch');
    return Response.redirect(settingsUrl);
  }

  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET || !config.GITHUB_TOKEN_ENCRYPTION_KEY) {
    settingsUrl.searchParams.set('github_error', 'not_configured');
    return Response.redirect(settingsUrl);
  }

  try {
    const tokenData = await exchangeCodeForToken(code, config.GITHUB_CLIENT_ID, config.GITHUB_CLIENT_SECRET);

    const octokit = new Octokit({ auth: tokenData.access_token });
    const { data: ghUser } = await octokit.users.getAuthenticated();

    const encryptedToken = encrypt(tokenData.access_token, config.GITHUB_TOKEN_ENCRYPTION_KEY);

    // Upsert: delete old then insert (userId is unique)
    await db.delete(githubAccounts).where(eq(githubAccounts.userId, session.user.id));
    await db.insert(githubAccounts).values({
      userId: session.user.id,
      githubUsername: ghUser.login,
      avatarUrl: ghUser.avatar_url,
      encryptedAccessToken: encryptedToken,
      scopes: tokenData.scope,
      connectedAt: new Date(),
    });

    settingsUrl.searchParams.set('github_success', 'connected');
    return Response.redirect(settingsUrl);
  } catch {
    settingsUrl.searchParams.set('github_error', 'exchange_failed');
    return Response.redirect(settingsUrl);
  }
}
