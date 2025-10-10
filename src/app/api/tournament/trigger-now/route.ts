import { NextResponse } from 'next/server';

export async function POST() {
    try {
        // Call the actual cron job endpoint internally
        const baseUrl = process.env.NEXTAUTH_URL;
        const cronSecret = process.env.CRON_SECRET;

        if (!baseUrl) {
            return NextResponse.json({
                error: 'NEXTAUTH_URL not configured - required for Vercel deployment'
            }, { status: 500 });
        }

        if (!cronSecret) {
            return NextResponse.json({
                error: 'CRON_SECRET not configured'
            }, { status: 500 });
        }

        // Call the real cron job with proper authorization
        const response = await fetch(`${baseUrl}/api/tournament/weekly-cron`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cronSecret}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('❌ Cron job failed:', result);
            return NextResponse.json({
                error: 'Failed to trigger cron job',
                details: result
            }, { status: response.status });
        }

        return NextResponse.json({
            success: true,
            message: 'Real cron job triggered successfully - tournament created with proper automation',
            cron_result: result
        });

    } catch (error) {
        console.error('❌ Manual trigger error:', error);
        return NextResponse.json({
            error: 'Failed to trigger cron job',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
