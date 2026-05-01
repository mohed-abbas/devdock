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

  // AUTH_URL must be set so the OAuth redirect_uri matches exactly what's
  // registered in the GitHub OAuth app. The previous `http://localhost:3000`
  // fallback would silently send users to a port that Caddy doesn't publish
  // (Caddy listens on 8080) and break the callback round-trip without any
  // visible error.
  if (!config.AUTH_URL) {
    return new Response('AUTH_URL not configured', { status: 503 });
  }

  const state = generateState();
  const cookieStore = await cookies();
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    secure: config.AUTH_URL.startsWith('https://'),
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const redirectUri = `${config.AUTH_URL}/api/github/callback`;
  const url = buildAuthorizeUrl(config.GITHUB_CLIENT_ID, redirectUri, state);
  return Response.redirect(url);
}
