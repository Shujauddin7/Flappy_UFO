import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    console.log('🧪 Manual tournament trigger called');
    
    try {
        // Get the base URL for the current request
        const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
        
        // Call the cron endpoint with proper authorization
        const cronResponse = await fetch(`${baseUrl}/api/tournament/daily-cron`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        const cronData = await cronResponse.json();

        if (!cronResponse.ok) {
            throw new Error(`Cron call failed: ${cronData.error}`);
        }

        return NextResponse.json({
            success: true,
            message: 'Tournament created successfully via manual trigger',
            data: cronData
        });

    } catch (error) {
        console.error('❌ Manual tournament trigger failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
