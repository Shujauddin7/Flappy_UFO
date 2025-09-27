import { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis client for pub/sub
const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
const redisUrl = isProduction ? process.env.UPSTASH_REDIS_PROD_URL : process.env.UPSTASH_REDIS_DEV_URL;
const redisToken = isProduction ? process.env.UPSTASH_REDIS_PROD_TOKEN : process.env.UPSTASH_REDIS_DEV_TOKEN;

let redis: Redis | null = null;
if (redisUrl && redisToken) {
    redis = new Redis({
        url: redisUrl,
        token: redisToken,
    });
}

// SSE headers for browser compatibility
const SSE_HEADERS = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: NextRequest) {
    console.log('🔥 SSE leaderboard stream requested');

    // Check if Redis is available
    if (!redis) {
        console.error('❌ Redis not configured for SSE streaming');
        return new Response('Redis not available', { status: 500 });
    }

    // Get tournament day from query params
    const { searchParams } = new URL(request.url);
    const tournamentDay = searchParams.get('tournament_day');

    if (!tournamentDay) {
        return new Response('tournament_day parameter required', { status: 400 });
    }

    console.log(`⚡ Starting SSE stream for tournament: ${tournamentDay}`);

    // Create ReadableStream for SSE
    const stream = new ReadableStream({
        start(controller) {
            console.log('🚀 SSE stream started, setting up Redis subscription...');

            // Send initial connection message
            const sendEvent = (event: string, data: Record<string, unknown>) => {
                const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                try {
                    controller.enqueue(new TextEncoder().encode(message));
                } catch (error) {
                    console.error('❌ Error sending SSE message:', error);
                }
            };

            // Send connection established message
            sendEvent('connected', {
                message: 'Leaderboard stream connected',
                tournament_day: tournamentDay,
                timestamp: new Date().toISOString()
            });

            // Set up polling for leaderboard updates
            // Note: Using polling approach that's compatible with Upstash Redis

            let isActive = true;
            let lastUpdateTime = Date.now();

            // Poll Redis for leaderboard changes every 2 seconds
            const pollForUpdates = async () => {
                if (!isActive) return;

                try {
                    // Check if there are any new updates in Redis
                    const updateKey = `leaderboard_updates:${tournamentDay}`;
                    const lastUpdate = await redis!.get(updateKey);

                    if (lastUpdate && typeof lastUpdate === 'string' && lastUpdate !== lastUpdateTime.toString()) {
                        console.log('📡 Broadcasting leaderboard update via SSE');

                        // Fetch updated leaderboard data from Redis cache
                        const { getTopPlayers } = await import('@/lib/leaderboard-redis');
                        const updatedPlayers = await getTopPlayers(tournamentDay, 0, 20);

                        if (updatedPlayers && updatedPlayers.length > 0) {
                            sendEvent('leaderboard_update', {
                                players: updatedPlayers,
                                tournament_day: tournamentDay,
                                timestamp: new Date().toISOString(),
                                source: 'redis_sse'
                            });

                            const updateTime = typeof lastUpdate === 'string' ? parseInt(lastUpdate) : Date.now();
                            lastUpdateTime = updateTime;
                        }
                    }
                } catch (error) {
                    console.error('❌ Error polling for updates:', error);
                }

                // Continue polling if connection is still active
                if (isActive) {
                    setTimeout(pollForUpdates, 2000); // Poll every 2 seconds
                }
            };

            // Start polling
            pollForUpdates();

            // Send periodic heartbeat to keep connection alive
            const heartbeatInterval = setInterval(() => {
                if (!isActive) {
                    clearInterval(heartbeatInterval);
                    return;
                }

                sendEvent('heartbeat', {
                    timestamp: new Date().toISOString()
                });
            }, 30000); // Heartbeat every 30 seconds

            // Cleanup function
            const cleanup = () => {
                console.log('🛑 SSE stream cleanup triggered');
                isActive = false;
                clearInterval(heartbeatInterval);
            };

            // Handle client disconnect
            request.signal.addEventListener('abort', cleanup);

            return cleanup;
        },

        cancel() {
            console.log('🔚 SSE stream cancelled by client');
        }
    });

    return new Response(stream, { headers: SSE_HEADERS });
}

// Handle preflight requests for CORS
export async function OPTIONS() {
    return new Response(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}