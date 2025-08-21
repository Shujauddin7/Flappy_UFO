# Update World Developer Portal

Since you changed your Vercel team name, you need to update your World ID app configuration:

## Go to World Developer Portal:
https://developer.worldcoin.org/

## Find your app: `app_be50be72114b4758d4cbc0d2fce3aafa`

## Update redirect URL from:
- OLD: `https://flappyufo-git-dev-msshujauddin-gmailcoms-projects.vercel.app/api/auth/callback/credentials`

## To:
- NEW: `https://flappyufo-git-dev-shujauddin.vercel.app/api/auth/callback/credentials`

This is critical for the World App sign-in to work properly with your new URL!

## Testing Checklist:
1. ✅ Updated .env.local with new URLs
2. ✅ Updated supabase.ts URL detection 
3. ✅ Updated DevTools URL patterns
4. ✅ Direct sign-in flow (no intermediate modal)
5. ✅ Enhanced Supabase logging for debugging
6. 🔄 Update World Developer Portal redirect URL (do this now!)
7. 🔄 Test sign-in flow on dev URL
8. 🔄 Check browser console for Supabase debug logs
