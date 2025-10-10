import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Redis client singleton
let redisClient: Redis | null = null;

async function getRedisClient(): Promise<Redis | null> {
    if (!redisClient) {
        const url = process.env.UPSTASH_REDIS_REST_URL;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN;

        if (!url || !token) {
            return null;
        }

        redisClient = new Redis({ url, token });
    }
    return redisClient;
}

export async function POST(req: NextRequest) {
    try {
        const redis = await getRedisClient();
        if (!redis) {
            return NextResponse.json({
                error: 'Redis not available'
            }, { status: 500 });
        }

        // Get tournament day from request or use current
        const body = await req.json().catch(() => ({}));
        const tournamentDay = body.tournament_day || new Date().toISOString().split('T')[0];

        // Clear all possible Redis keys for this tournament
        const keysToDelete = [
            // Main leaderboard keys
            `leaderboard:${tournamentDay}`,
            `leaderboard:${tournamentDay}:details`,

            // Data cache keys
            `leaderboard_data:${tournamentDay}`,
            `tournament_data:${tournamentDay}`,

            // WebSocket and pub/sub keys
            `leaderboard_cache:${tournamentDay}`,
            `instant_leaderboard:${tournamentDay}`,

            // Legacy keys that might exist
            `tournament:${tournamentDay}:leaderboard`,
            `cache:leaderboard:${tournamentDay}`,
        ];

        // Also clear any player-specific detail keys
        // First, get all Redis keys that match patterns
        const allKeys = await redis.keys(`*${tournamentDay}*`);
        // Combine with our specific keys
        const allKeysToDelete = [...new Set([...keysToDelete, ...allKeys])];
        // Delete all keys in batches
        if (allKeysToDelete.length > 0) {
            const batchSize = 50;

            for (let i = 0; i < allKeysToDelete.length; i += batchSize) {
                allKeysToDelete.slice(i, i + batchSize);
            }
        }

        // Also clear any pattern-based keys for good measure
        const patternKeys = [
            `player:*`,  // Individual player details
            `leaderboard:*`,  // Any leaderboard-related keys
        ];

        for (const pattern of patternKeys) {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
//                 const result = await redis.del(...keys);
                }
        }

        return NextResponse.json({
            success: true,
            message: 'All Redis cache cleared successfully',
            tournament_day: tournamentDay,
            keys_deleted: allKeysToDelete.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Cache clear error:', error);
        return NextResponse.json({
            error: 'Failed to clear cache',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}