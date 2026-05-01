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
  // AUTH_URL is required so all redirects pin to the canonical host the
  // GitHub OAuth app was registered against. Authorize already enforces
  // this; the same guard here keeps callback consistent and avoids
  // ?? request.url leaking 127.0.0.1:8080 / non-canonical hosts.
  if (!config.AUTH_URL) {
    return new Response('AUTH_URL not configured', { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) return Response.redirect(new URL('/login', config.AUTH_URL));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const settingsUrl = new URL('/dashboard/settings', config.AUTH_URL);

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

    // Upsert: delete old then insert within a transaction for atomicity
    await db.transaction(async (tx) => {
      await tx.delete(githubAccounts).where(eq(githubAccounts.userId, session.user.id));
      await tx.insert(githubAccounts).values({
        userId: session.user.id,
        githubUsername: ghUser.login,
        avatarUrl: ghUser.avatar_url,
        encryptedAccessToken: encryptedToken,
        scopes: tokenData.scope,
        connectedAt: new Date(),
      });
    });

    settingsUrl.searchParams.set('github_success', 'connected');
    return Response.redirect(settingsUrl);
  } catch {
    settingsUrl.searchParams.set('github_error', 'exchange_failed');
    return Response.redirect(settingsUrl);
  }
}
