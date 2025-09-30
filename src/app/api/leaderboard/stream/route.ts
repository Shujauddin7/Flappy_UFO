import { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

// CRITICAL: Force dynamic rendering and Node.js runtime for SSE
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
            let lastLeaderboardUpdateTime = 0; // Track leaderboard updates separately
            let lastTournamentStatsUpdateTime = 0; // Track stats updates separately

            // Poll Redis for leaderboard changes every 500ms (MUCH FASTER for instant updates)
            const pollForUpdates = async () => {
                if (!isActive) return;

                try {
                    // Check for leaderboard updates
                    const updateKey = `leaderboard_updates:${tournamentDay}`;
                    const lastUpdate = await redis!.get(updateKey);

                    if (lastUpdate && typeof lastUpdate === 'string') {
                        const updateTime = parseInt(lastUpdate);
                        if (updateTime > lastLeaderboardUpdateTime) {
                            console.log('📡 INSTANT Broadcasting leaderboard update via SSE');

                            // � INSTANT FIX: Fetch fresh data IMMEDIATELY
                            try {
                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => controller.abort(), 2000); // Faster timeout

                                const baseUrl = process.env.NEXT_PUBLIC_ENV === 'prod'
                                    ? 'https://flappyufo.vercel.app'
                                    : 'https://flappyufo-git-dev-shujauddin.vercel.app';

                                const leaderboardResponse = await fetch(`${baseUrl}/api/tournament/leaderboard-data?bust=${Date.now()}`, {
                                    signal: controller.signal,
                                    cache: 'no-store' // Force fresh data
                                });

                                clearTimeout(timeoutId);
                                const leaderboardData = await leaderboardResponse.json();

                                if (leaderboardResponse.ok && leaderboardData?.players) {
                                    sendEvent('leaderboard_update', {
                                        players: leaderboardData.players,
                                        tournament_day: tournamentDay,
                                        timestamp: new Date().toISOString(),
                                        source: 'instant_sse_update',
                                        responseTime: 0,
                                        cached: false,
                                        update_id: `instant_${Date.now()}_${Math.random()}` // Force React re-render
                                    });

                                    lastLeaderboardUpdateTime = updateTime;
                                    console.log(`✅ INSTANT leaderboard update sent! Players: ${leaderboardData.players.length}`);
                                } else {
                                    console.warn('⚠️ Leaderboard API fetch failed - trying fallback');
                                }
                            } catch (leaderboardError) {
                                console.error('❌ Error fetching leaderboard data:', leaderboardError);
                            }
                        }
                    }

                    // Check for tournament stats updates (prize pool, total players)
                    const statsUpdateKey = `tournament_stats_updates:${tournamentDay}`;
                    const statsLastUpdate = await redis!.get(statsUpdateKey);

                    if (statsLastUpdate && typeof statsLastUpdate === 'string') {
                        const statsUpdateTime = parseInt(statsLastUpdate);
                        if (statsUpdateTime > lastTournamentStatsUpdateTime) {
                            console.log('📡 INSTANT Broadcasting tournament stats update via SSE');

                            // Fetch updated tournament stats with timeout
                            try {
                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => controller.abort(), 2000);

                                const baseUrl = process.env.NEXT_PUBLIC_ENV === 'prod'
                                    ? 'https://flappyufo.vercel.app'
                                    : 'https://flappyufo-git-dev-shujauddin.vercel.app';

                                const statsResponse = await fetch(`${baseUrl}/api/tournament/stats?bust=${Date.now()}`, {
                                    signal: controller.signal,
                                    cache: 'no-store'
                                });

                                clearTimeout(timeoutId);
                                const statsData = await statsResponse.json();

                                if (statsResponse.ok && statsData) {
                                    sendEvent('tournament_stats_update', {
                                        stats: statsData,
                                        tournament_day: tournamentDay,
                                        timestamp: new Date().toISOString(),
                                        source: 'instant_stats_sse'
                                    });

                                    lastTournamentStatsUpdateTime = statsUpdateTime;
                                    console.log('✅ INSTANT tournament stats update sent!');
                                } else {
                                    console.warn('⚠️ Tournament stats fetch returned non-OK response');
                                }
                            } catch (statsError) {
                                console.error('❌ Error fetching tournament stats for SSE:', statsError);
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ Error polling for updates:', error);
                    // Don't stop polling on individual errors
                }

                // Continue polling if connection is still active - ULTRA FAST (100ms for near real-time)
                if (isActive) {
                    setTimeout(pollForUpdates, 100); // Poll every 100ms for near-instant updates!
                }
            };

            // Start polling immediately with ultra-fast interval
            setTimeout(pollForUpdates, 50); // Start almost instantly

            // Send periodic heartbeat to keep connection alive (more frequent for mobile)
            const heartbeatInterval = setInterval(() => {
                if (!isActive) {
                    clearInterval(heartbeatInterval);
                    return;
                }

                try {
                    sendEvent('heartbeat', {
                        timestamp: new Date().toISOString(),
                        connection_status: 'active'
                    });
                } catch (heartbeatError) {
                    console.error('❌ Heartbeat failed, connection may be dead:', heartbeatError);
                    // Consider connection dead if heartbeat fails
                    isActive = false;
                }
            }, 15000); // Heartbeat every 15 seconds (better for mobile)

            // Cleanup function with proper error handling
            const cleanup = () => {
                console.log('🛑 SSE stream cleanup triggered for tournament:', tournamentDay);
                isActive = false;
                clearInterval(heartbeatInterval);

                // Send final disconnect message if possible
                try {
                    sendEvent('disconnected', {
                        message: 'Stream connection closed',
                        timestamp: new Date().toISOString()
                    });
                } catch {
                    // Ignore errors during cleanup
                }
            };

            // Handle client disconnect and connection errors
            request.signal.addEventListener('abort', () => {
                console.log('📱 Client disconnected from SSE stream');
                cleanup();
            });

            // Set up connection timeout as failsafe
            const connectionTimeout = setTimeout(() => {
                console.log('⏰ SSE connection timed out after 10 minutes');
                cleanup();
            }, 10 * 60 * 1000); // 10 minute max connection time

            // Return cleanup function that also clears timeout
            return () => {
                clearTimeout(connectionTimeout);
                cleanup();
            };
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