export { auth as middleware } from '@/auth';

// Only protect specific routes, not the entire app
export const config = {
  matcher: [
    "/home/:path*",      // Protected routes only
    "/protected/:path*", // Any protected routes
  ]
};
