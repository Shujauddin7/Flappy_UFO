export { auth as middleware } from '@/auth';

// Only protect specific routes, not the entire app
export const config = {
  matcher: [
    "/(protected)/:path*",  // Only protect the (protected) folder
  ]
};
