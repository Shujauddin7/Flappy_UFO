import { NextResponse } from 'next/server';
import { warmAllCaches } from '@/utils/cache-warming';

/**
 * CACHE WARMING API ENDPOINT
 * Manually trigger cache warming for instant performance
 * Can be called by cron jobs, webhooks, or manual testing
 */
export async function POST() {
    const startTime = Date.now();
    console.log('🔥 MANUAL CACHE WARMING TRIGGERED - API Endpoint');

    try {
        const result = await warmAllCaches();
        const totalTime = Date.now() - startTime;

        if (result.success) {
            console.log(`✅ Cache warming completed successfully in ${totalTime}ms`);
            console.log('🎮 Ready for professional mobile game performance!');

            return NextResponse.json({
                success: true,
                message: 'All caches warmed successfully',
                performance: {
                    total_time_ms: totalTime,
                    ready_for_instant_loading: true
                },
                cache_status: result.details,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log(`⚠️ Cache warming completed with some failures in ${totalTime}ms`);

            return NextResponse.json({
                success: false,
                message: 'Some caches failed to warm',
                performance: {
                    total_time_ms: totalTime,
                    ready_for_instant_loading: false
                },
                cache_status: result.details,
                timestamp: new Date().toISOString()
            }, { status: 207 }); // Multi-status response
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
    console.log('📊 CACHE STATUS CHECK - API Endpoint');

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