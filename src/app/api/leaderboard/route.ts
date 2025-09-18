import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDay } from '@/utils/database';
import { getLeaderboardData } from '@/utils/leaderboard-queries';

// Redis client for leaderboard optimization (using existing Redis lib)
let Redis: typeof import('@upstash/redis').Redis | null = null;
let redisClient: import('@upstash/redis').Redis | null = null;

// Initialize Redis client
async function getRedisClient() {
    if (!Redis) {
        try {
            const { Redis: RedisClient } = await import('@upstash/redis');
            Redis = RedisClient;
        } catch {
            console.warn('⚠️ Redis not available, falling back to database');
            return null;
        }
    }

    if (!redisClient) {
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const redisUrl = isProduction ? process.env.UPSTASH_REDIS_PROD_URL : process.env.UPSTASH_REDIS_DEV_URL;
        const redisToken = isProduction ? process.env.UPSTASH_REDIS_PROD_TOKEN : process.env.UPSTASH_REDIS_DEV_TOKEN;

        if (!redisUrl || !redisToken) {
            console.warn('⚠️ Redis credentials missing');
            return null;
        }

        redisClient = new Redis({
            url: redisUrl,
            token: redisToken,
        });
    }

    return redisClient;
}

// Get leaderboard from Redis Sorted Set (ultra-fast)
async function getLeaderboardFromRedis(tournamentDay: string, offset: number = 0, limit: number = 20) {
    const redis = await getRedisClient();
    if (!redis) return null;

    try {
        const key = `leaderboard:${tournamentDay}`;

        // Get top players with scores from Redis Sorted Set
        const results = await redis.zrange(key, offset, offset + limit - 1, {
            rev: true,
            withScores: true
        });

        if (!results || results.length === 0) return null;

        // Convert Redis results to player objects
        const players = [];
        for (let i = 0; i < results.length; i += 2) {
            const userId = results[i] as string;
            const score = parseInt(results[i + 1] as string);
            players.push({
                user_id: userId,
                score: score,
                rank: offset + (i / 2) + 1
            });
        }

        return players;
    } catch (error) {
        console.error('❌ Redis leaderboard query failed:', error);
        return null;
    }
}

// Get player details from Supabase (minimal query)
async function getPlayerDetails(userIds: string[], tournamentDay: string) {
    try {
        // Use shared utilities
        const players = await getLeaderboardData(tournamentDay, { limit: 0 });
        
        // Filter to only the requested user IDs
        const filteredPlayers = players.filter(player => userIds.includes(player.user_id));
        
        return filteredPlayers.map(player => ({
            user_id: player.user_id,
            username: player.username,
            wallet: player.wallet
        }));
    } catch (error) {
        console.error('❌ Failed to get player details:', error);
        return [];
    }
}

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    console.log('🏁 Optimized Leaderboard API called');

    try {
        const { searchParams } = req.nextUrl;
        const offset = parseInt(searchParams.get('offset') || '0');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 per request
        const tournamentDay = searchParams.get('tournament_day');

        // Get current tournament day if not provided using shared utility
        const currentTournamentDay = await getTournamentDay(tournamentDay);

        let players = [];
        let source = 'database';

        // Try Redis first (ultra-fast)
        const redisPlayers = await getLeaderboardFromRedis(currentTournamentDay, offset, limit);

        if (redisPlayers) {
            // Get user details for Redis players
            const userIds = redisPlayers.map(p => p.user_id);
            const playerDetails = await getPlayerDetails(userIds, currentTournamentDay);

            // Merge Redis scores with user details
            players = redisPlayers.map(redisPlayer => {
                const details = playerDetails.find(p => p.user_id === redisPlayer.user_id);
                return {
                    ...redisPlayer,
                    username: details?.username || null,
                    wallet: details?.wallet || 'Unknown'
                };
            });

            source = 'redis';
        } else {
            // Fallback to database query using shared utilities
            console.log('📊 Redis miss - using database fallback');
            players = await getLeaderboardData(currentTournamentDay, {
                limit,
                offset,
                includeZeroScores: false
            });
            
            // Add missing properties for compatibility
            players = players.map(player => ({
                ...player,
                score: player.highest_score // Map highest_score to score for compatibility
            }));
        }

        const responseTime = Date.now() - startTime;

        console.log(`🚀 Leaderboard loaded: ${players.length} players from ${source} in ${responseTime}ms`);

        return NextResponse.json({
            success: true,
            players,
            pagination: {
                offset,
                limit,
                hasMore: players.length === limit, // Simple check
                nextOffset: offset + limit
            },
            performance: {
                source,
                responseTime: responseTime,
                cached: source === 'redis'
            },
            tournament_day: currentTournamentDay,
            fetched_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Optimized leaderboard error:', error);
        return NextResponse.json({
            error: 'Failed to load leaderboard',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}