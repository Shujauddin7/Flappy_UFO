import { NextResponse } from 'next/server';

export async function GET() {
    // Environment-specific database configuration (matches your frontend pattern)
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

    const supabaseUrl = isProduction
        ? process.env.SUPABASE_PROD_URL
        : process.env.SUPABASE_DEV_URL;

    const supabaseServiceKey = isProduction
        ? process.env.SUPABASE_PROD_SERVICE_KEY
        : process.env.SUPABASE_DEV_SERVICE_KEY;

    return NextResponse.json({
        environment_check: {
            environment: isProduction ? 'PRODUCTION' : 'DEVELOPMENT',
            envFlag: process.env.NEXT_PUBLIC_ENV,
            supabaseUrl: supabaseUrl ? '✅ Set (' + supabaseUrl.substring(0, 30) + '...)' : '❌ Missing',
            serviceKey: supabaseServiceKey ? '✅ Set (length: ' + supabaseServiceKey.length + ')' : '❌ Missing',
            nodeEnv: process.env.NODE_ENV,
            vercelEnv: process.env.VERCEL_ENV
        }
    });
}