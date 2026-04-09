import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnApi = nextUrl.pathname.startsWith('/api') &&
                      !nextUrl.pathname.startsWith('/api/auth') &&
                      !nextUrl.pathname.startsWith('/api/health');

      if (isOnDashboard || isOnApi) {
        if (isLoggedIn) return true;
        return false; // Redirects to signIn page (/login)
      }

      // Redirect authenticated users away from /login and / to /dashboard (D-16)
      if (isLoggedIn && (nextUrl.pathname === '/login' || nextUrl.pathname === '/')) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      return true;
    },
  },
  providers: [], // Populated in auth.ts (Credentials not edge-safe)
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days per D-11
  },
} satisfies NextAuthConfig;
