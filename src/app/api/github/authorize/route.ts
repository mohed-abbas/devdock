import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { generateState, buildAuthorizeUrl } from '@/lib/github/oauth';
import { config } from '@/lib/config';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  if (!config.GITHUB_CLIENT_ID || !config.GITHUB_CLIENT_SECRET) {
    return new Response('GitHub integration not configured', { status: 503 });
  }

  const state = generateState();
  const cookieStore = await cookies();
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const redirectUri = `${config.AUTH_URL || 'http://localhost:3000'}/api/github/callback`;
  const url = buildAuthorizeUrl(config.GITHUB_CLIENT_ID, redirectUri, state);
  return Response.redirect(url);
}
