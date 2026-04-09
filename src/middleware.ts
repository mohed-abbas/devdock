import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Match all paths except static files, images, and favicon
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
