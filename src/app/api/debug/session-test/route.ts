import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Simple test: Can we get session server-side?
        const session = await auth();

        if (session) {
            return NextResponse.json({
                success: true,
                message: "Session working as per Plan.md",
                sessionData: {
                    walletAddress: session.user?.walletAddress,
                    username: session.user?.username,
                    userId: session.user?.id
                }
            });
        } else {
            return NextResponse.json({
                success: false,
                message: "No session - sign in required",
                sessionData: null
            });
        }
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: "Session test failed",
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
