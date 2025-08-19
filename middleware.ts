// Temporarily disable middleware - no authentication required for now
// export { auth as middleware } from '@/auth';

// Only protect specific routes when authentication is needed later
export const config = {
    matcher: [
        // No routes protected for now - uncomment when tournament auth is implemented
        // "/(protected)/:path*",
    ]
};
