import { NextResponse } from 'next/server';

export async function GET() {
    // Check all environment variables and detection methods
    const envCheck = {
        NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_URL: process.env.VERCEL_URL,

        // Database URLs (don't expose the actual values, just check if they exist)
        SUPABASE_PROD_URL: process.env.SUPABASE_PROD_URL ? '✅ Set' : '❌ Missing',
        SUPABASE_DEV_URL: process.env.SUPABASE_DEV_URL ? '✅ Set' : '❌ Missing',
        SUPABASE_PROD_SERVICE_KEY: process.env.SUPABASE_PROD_SERVICE_KEY ? '✅ Set' : '❌ Missing',
        SUPABASE_DEV_SERVICE_KEY: process.env.SUPABASE_DEV_SERVICE_KEY ? '✅ Set' : '❌ Missing',

        // Current detection logic (following Plan.md specification)
        isProduction: process.env.NEXT_PUBLIC_ENV === 'production',

        // Which database would be used (following Plan.md specification)
        selectedDatabase: process.env.NEXT_PUBLIC_ENV === 'production' ? 'PRODUCTION' : 'DEVELOPMENT'
    };

    return NextResponse.json(envCheck);
}
