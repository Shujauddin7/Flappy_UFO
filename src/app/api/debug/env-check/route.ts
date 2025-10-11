import { NextResponse } from 'next/server';

export async function GET() {
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
    const vercelEnv = process.env.VERCEL_ENV;

    return NextResponse.json({
        environment: {
            NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV || 'NOT SET',
            VERCEL_ENV: vercelEnv || 'NOT SET',
            isProduction: isProduction,
            NODE_ENV: process.env.NODE_ENV,
        },
        databaseUsed: {
            supabaseUrl: isProduction ? 'PROD DATABASE' : 'DEV DATABASE',
            hasSupabaseProdUrl: !!process.env.SUPABASE_PROD_URL,
            hasSupabaseDevUrl: !!process.env.SUPABASE_DEV_URL,
        },
        redisUsed: {
            redisUrl: isProduction ? 'PROD REDIS' : 'DEV REDIS',
            hasRedisProdUrl: !!process.env.UPSTASH_REDIS_PROD_URL,
            hasRedisDevUrl: !!process.env.UPSTASH_REDIS_DEV_URL,
        },
        socketUrl: isProduction
            ? (process.env.NEXT_PUBLIC_SOCKETIO_PROD_URL || 'https://flappy-ufo-socketio-server-production.up.railway.app')
            : (process.env.NEXT_PUBLIC_SOCKETIO_DEV_URL || 'https://flappy-ufo-socketio-server-dev.up.railway.app'),
        timestamp: new Date().toISOString()
    });
}
