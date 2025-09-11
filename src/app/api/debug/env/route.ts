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

        // Admin wallet configuration
        NEXT_PUBLIC_ADMIN_WALLET: process.env.NEXT_PUBLIC_ADMIN_WALLET ? '✅ Set' : '❌ Missing',
        NEXT_PUBLIC_BACKUP_ADMIN_WALLET: process.env.NEXT_PUBLIC_BACKUP_ADMIN_WALLET ? '✅ Set' : '❌ Missing',
        PRIMARY_WALLET: process.env.NEXT_PUBLIC_ADMIN_WALLET ? `${process.env.NEXT_PUBLIC_ADMIN_WALLET.slice(0, 6)}...${process.env.NEXT_PUBLIC_ADMIN_WALLET.slice(-4)}` : 'Not set',
        BACKUP_WALLET: process.env.NEXT_PUBLIC_BACKUP_ADMIN_WALLET ? `${process.env.NEXT_PUBLIC_BACKUP_ADMIN_WALLET.slice(0, 6)}...${process.env.NEXT_PUBLIC_BACKUP_ADMIN_WALLET.slice(-4)}` : 'Not set',

        // Current detection logic (following Plan.md specification)
        isProduction: process.env.NEXT_PUBLIC_ENV === 'prod',

        // Which database would be used (following Plan.md specification)
        selectedDatabase: process.env.NEXT_PUBLIC_ENV === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT'
    };

    return NextResponse.json(envCheck);
}
