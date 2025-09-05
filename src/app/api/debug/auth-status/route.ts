import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const session = await auth();

        return NextResponse.json({
            success: true,
            hasSession: !!session,
            sessionData: session ? {
                userId: session.user?.id,
                walletAddress: session.user?.walletAddress,
                username: session.user?.username,
                profilePictureUrl: session.user?.profilePictureUrl
            } : null,
            timestamp: new Date().toISOString(),
            environment: {
                authUrl: process.env.AUTH_URL,
                nextAuthUrl: process.env.NEXTAUTH_URL,
                nodeEnv: process.env.NODE_ENV
            }
        });
    } catch (error) {
        console.error('Auth status check error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            hasSession: false,
            sessionData: null
        });
    }
}
