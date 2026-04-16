import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);
const PREVIEW_DOMAIN = process.env.PREVIEW_DOMAIN || '';

function getPreviewDomainHost(): string {
  if (!PREVIEW_DOMAIN) return '';
  return PREVIEW_DOMAIN.split(':')[0];
}

function isPreviewSubdomain(host: string | null): boolean {
  const domain = getPreviewDomainHost();
  if (!host || !domain) return false;
  const hostname = host.split(':')[0];
  return hostname.endsWith(`.${domain}`);
}

// Auth.js middleware wrapped to handle preview subdomain rewrites
export default auth((request) => {
  const host = request.headers.get('host');

  // Preview subdomain: rewrite to /api/preview/... (auth already passed — authorized callback allows it)
  if (isPreviewSubdomain(host)) {
    const url = request.nextUrl.clone();
    const path = url.pathname === '/' ? '' : url.pathname;
    url.pathname = `/api/preview${path}`;
    return NextResponse.rewrite(url);
  }

  // Non-preview: auth.config.ts authorized callback already handled auth decisions
}) as unknown as (request: NextRequest) => Promise<NextResponse>;

export const config = {
  // Match all paths — preview subdomain needs _next/static and _next/image proxied too.
  // DevDock's own static assets still work because non-preview requests pass through
  // to Next.js's built-in static file serving.
  matcher: ['/(.*)',],
};
