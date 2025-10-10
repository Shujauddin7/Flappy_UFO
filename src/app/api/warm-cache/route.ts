import { NextResponse } from 'next/server';

/**
 * SIMPLIFIED CACHE WARMING API ENDPOINT
 * Directly calls leaderboard endpoint to warm cache for instant performance
 */
export async function POST(request: Request) {
    const startTime = Date.now();
    try {
        // Get the origin from the request
        const url = new URL(request.url);
        const baseUrl = url.origin;

        const leaderboardResponse = await fetch(`${baseUrl}/api/tournament/leaderboard-data`, {
            method: 'GET',
            headers: {
                'User-Agent': 'Cache-Warmer/1.0'
            }
        });

        const leaderboardData = await leaderboardResponse.json();
        const totalTime = Date.now() - startTime;

        if (leaderboardResponse.ok) {
            return NextResponse.json({
                success: true,
                message: 'Leaderboard cache warmed successfully',
                performance: {
                    total_time_ms: totalTime,
                    players_cached: leaderboardData.total_players || 0,
                    ready_for_instant_loading: true
                },
                timestamp: new Date().toISOString()
            });
        } else {
            throw new Error(`Leaderboard warming failed: ${leaderboardData.error || 'Unknown error'}`);
        }

    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error('❌ Cache warming API failed:', error);

        return NextResponse.json({
            success: false,
            message: 'Cache warming failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            performance: {
                total_time_ms: totalTime,
                ready_for_instant_loading: false
    },
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}

/**
 * GET endpoint to check cache status
 */
export async function GET() {
    try {
        // You could implement cache status checking here
        // For now, just return a simple status
        return NextResponse.json({
            message: 'Cache warming endpoint ready',
            instructions: 'POST to this endpoint to warm all caches',
            performance_target: '<50ms response time like professional mobile games',
            supported_operations: ['POST /api/warm-cache - Warm all caches'],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Cache status check failed:', error);

        return NextResponse.json({
            error: 'Failed to check cache status',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}