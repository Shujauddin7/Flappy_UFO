// Redis implementation with proper @upstash/redis integration
// Handles both development and production environments safely

/* eslint-disable @typescript-eslint/no-explicit-any */
let Redis: any;
let devClient: any = null;
let prodClient: any = null;

// Initialize Redis class (lazy loading to avoid build issues)
async function initializeRedis() {
    if (!Redis) {
        try {
            const { Redis: RedisClient } = await import('@upstash/redis');
            Redis = RedisClient;
        } catch {
            return null;
        }
    }
    return Redis;
}

// Get environment-specific Redis client
async function getRedisClient() {
    const RedisClass = await initializeRedis();
    if (!RedisClass) return null;

    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
    if (isProduction) {
        if (!prodClient) {
            if (!process.env.UPSTASH_REDIS_PROD_URL || !process.env.UPSTASH_REDIS_PROD_TOKEN) {
                return null;
            }
            prodClient = new RedisClass({
                url: process.env.UPSTASH_REDIS_PROD_URL,
                token: process.env.UPSTASH_REDIS_PROD_TOKEN,
            });
        }
        return prodClient;
    } else {
        if (!devClient) {
            if (!process.env.UPSTASH_REDIS_DEV_URL || !process.env.UPSTASH_REDIS_DEV_TOKEN) {
                return null;
            }
            devClient = new RedisClass({
                url: process.env.UPSTASH_REDIS_DEV_URL,
                token: process.env.UPSTASH_REDIS_DEV_TOKEN,
            });
        }
        return devClient;
    }
}

// Cache key with environment prefix
function getEnvironmentKey(baseKey: string): string {
    // CRITICAL: Vercel sets NODE_ENV=production for ALL deployments!
    // Use VERCEL_ENV to detect dev vs production, fallback to NEXT_PUBLIC_ENV
    const vercelEnv = process.env.VERCEL_ENV; // 'production', 'preview', or 'development'
    const isProduction = vercelEnv === 'production' || process.env.NEXT_PUBLIC_ENV === 'prod';
    const environment = isProduction ? 'prod' : 'dev';
    const channel = `${environment}:${baseKey}`;
    return channel;
}

export async function getCached(key: string): Promise<any> {
    try {
        const redis = await getRedisClient();
        if (!redis) {
            return null;
        }

        const envKey = getEnvironmentKey(key);
        const cachedData = await redis.get(envKey);

        if (cachedData) {
            // Handle different data types returned by Upstash Redis
            if (typeof cachedData === 'string') {
                return JSON.parse(cachedData);
            } else if (typeof cachedData === 'object') {
                return cachedData;
            } else {
                return JSON.parse(String(cachedData));
            }
        }

        return null;
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
}

export async function setCached(key: string, data: any, ttlSeconds: number = 15): Promise<boolean> {
    try {
        const redis = await getRedisClient();
        if (!redis) {
            return false;
        }

        const envKey = getEnvironmentKey(key);
        const serializedData = JSON.stringify(data);

        await redis.setex(envKey, ttlSeconds, serializedData);
        return true;
    } catch (error) {
        console.error('Redis set error:', error);
        return false;
    }
}

export async function deleteCached(key: string): Promise<void> {
    try {
        const redis = await getRedisClient();
        if (!redis) {
            return;
        }

        const envKey = getEnvironmentKey(key);
        await redis.del(envKey);
    } catch (error) {
        console.error('❌ Redis deleteCached error:', error);
        // Gracefully fail - app continues to work
    }
}

export async function testRedisConnection(): Promise<boolean> {
    try {
        const redis = await getRedisClient();
        if (!redis) return false;

        await redis.ping();
        return true;
    } catch (error) {
        console.error('❌ Redis connection test failed:', error);
        return false;
    }
}

// 🚀 NEW: Check if cache needs warming (Professional Gaming Trick)
export function shouldWarmCache(cachedData: any, maxAgeSeconds: number): boolean {
    if (!cachedData || !cachedData.fetched_at) return true;

    const cacheAge = Date.now() - new Date(cachedData.fetched_at).getTime();
    const warmThreshold = maxAgeSeconds * 1000 * 0.7; // Warm at 70% of TTL

    return cacheAge > warmThreshold;
}

// 🔄 Redis Pub/Sub for Socket.IO Integration (Real-time push notifications)
export async function publishRealtimeUpdate(channel: string, message: any): Promise<boolean> {
    try {
        const redis = await getRedisClient();
        if (!redis) {
            console.error('❌ Redis client not available for publishing');
            return false;
        }

        // Format message according to LEADERBOARD.md specification
        const formattedMessage = {
            ...message,
            timestamp: Date.now() // Use numeric timestamp for easy comparison
        };

        // 🚨 CRITICAL: Do NOT use environment prefix for pub/sub channels
        // Railway Socket.IO server subscribes to 'tournament:updates' (no prefix)
        // Using environment prefix breaks cross-device real-time updates
        console.log('📡 Publishing to Redis:', { channel, type: message.type });

        // Publish to the channel directly without environment prefix
        await redis.publish(channel, JSON.stringify(formattedMessage));

        console.log('✅ Published successfully to:', channel);

        return true;
    } catch (error) {
        console.error('❌ Redis publish error:', error);
        return false;
    }
}

// 🎯 Specific realtime update functions for different event types
export async function publishScoreUpdate(tournamentId: string, data: {
    user_id: string;
    username: string;
    old_score: number;
    new_score: number;
    new_rank?: number;
}): Promise<boolean> {
    return publishRealtimeUpdate('tournament:updates', {
        tournament_id: tournamentId,
        type: 'score_update',
        data
    });
}

export async function publishPrizePoolUpdate(tournamentId: string, data: {
    new_prize_pool: number;
    total_players: number;
    increment_amount?: number;
}): Promise<boolean> {
    return publishRealtimeUpdate('tournament:updates', {
        tournament_id: tournamentId,
        type: 'prize_pool_update',
        data
    });
}

export async function publishPlayerJoined(tournamentId: string, data: {
    user_id: string;
    username: string;
    entry_type: 'verified' | 'standard';
}): Promise<boolean> {
    return publishRealtimeUpdate('tournament:updates', {
        tournament_id: tournamentId,
        type: 'player_joined',
        data
    });
}

// 🚀 OPTIMIZATION: Combined score update (1 Redis command instead of 2)
// Replaces: updateLeaderboardScore + publishScoreUpdate
export async function publishCombinedScoreUpdate(
    tournamentDay: string,
    tournamentId: string,
    userId: string,
    score: number,
    playerDetails: {
        username?: string | null;
        wallet?: string;
        old_score: number
    }
): Promise<boolean> {
    // Use the EXACT same format as publishScoreUpdate for compatibility
    return publishRealtimeUpdate('tournament:updates', {
        tournament_id: tournamentId,
        type: 'score_update',
        data: {
            user_id: userId,
            username: playerDetails.username || `Player ${userId.slice(0, 8)}`,
            old_score: playerDetails.old_score,
            new_score: score,
            new_rank: undefined
        }
    });
}