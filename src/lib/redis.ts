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
        } catch (error) {
            console.warn('⚠️ Redis package not available, caching disabled:', error);
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
    console.log('🔧 Redis client request - Environment:', isProduction ? 'PROD' : 'DEV');

    if (isProduction) {
        if (!prodClient) {
            console.log('🔑 Checking PROD Redis credentials...');
            console.log('- UPSTASH_REDIS_PROD_URL:', process.env.UPSTASH_REDIS_PROD_URL ? 'Present' : 'MISSING');
            console.log('- UPSTASH_REDIS_PROD_TOKEN:', process.env.UPSTASH_REDIS_PROD_TOKEN ? 'Present' : 'MISSING');

            if (!process.env.UPSTASH_REDIS_PROD_URL || !process.env.UPSTASH_REDIS_PROD_TOKEN) {
                console.warn('⚠️ Production Redis credentials missing');
                return null;
            }
            prodClient = new RedisClass({
                url: process.env.UPSTASH_REDIS_PROD_URL,
                token: process.env.UPSTASH_REDIS_PROD_TOKEN,
            });
            console.log('🚀 Connected to PRODUCTION Redis');
        }
        return prodClient;
    } else {
        if (!devClient) {
            console.log('🔑 Checking DEV Redis credentials...');
            console.log('- UPSTASH_REDIS_DEV_URL:', process.env.UPSTASH_REDIS_DEV_URL ? 'Present' : 'MISSING');
            console.log('- UPSTASH_REDIS_DEV_TOKEN:', process.env.UPSTASH_REDIS_DEV_TOKEN ? 'Present' : 'MISSING');

            if (!process.env.UPSTASH_REDIS_DEV_URL || !process.env.UPSTASH_REDIS_DEV_TOKEN) {
                console.warn('⚠️ Development Redis credentials missing');
                return null;
            }
            devClient = new RedisClass({
                url: process.env.UPSTASH_REDIS_DEV_URL,
                token: process.env.UPSTASH_REDIS_DEV_TOKEN,
            });
            console.log('🧪 Connected to DEVELOPMENT Redis');
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
    console.log('🔧 Redis channel:', channel, '(VERCEL_ENV:', vercelEnv, 'NEXT_PUBLIC_ENV:', process.env.NEXT_PUBLIC_ENV, ')');
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
            console.log('No Redis client available for caching');
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
            console.warn(`⚠️ Redis not available, skipping cache delete for: ${key}`);
            return;
        }

        const envKey = getEnvironmentKey(key);
        await redis.del(envKey);

        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        console.log(`🗑️ Deleted cache for ${envKey} (${isProduction ? 'PROD' : 'DEV'})`);
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
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        console.log(`✅ Redis connection test successful (${isProduction ? 'PROD' : 'DEV'})`);
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
            console.warn('⚠️ Redis not available, skipping realtime update publish');
            return false;
        }

        // Format message according to LEADERBOARD.md specification
        const formattedMessage = {
            ...message,
            timestamp: Date.now() // Use numeric timestamp for easy comparison
        };

        // Use environment-specific channel names for pub/sub
        const envChannel = getEnvironmentKey(channel);

        // Use RPUSH to add message to end of list (FIFO queue)
        await redis.publish(envChannel, JSON.stringify(formattedMessage));

        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        console.log(`📡 Published to ${envChannel} (${isProduction ? 'PROD' : 'DEV'}):`, formattedMessage);

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
    const redis = await getRedisClient();
    if (!redis) {
        console.warn('⚠️ Redis not available, skipping score update publish');
        return false;
    }

    try {
        // Combine leaderboard update + score update into ONE message
        const combinedMessage = {
            type: 'score_update_combined',
            tournament_day: tournamentDay,
            tournament_id: tournamentId,
            user_id: userId,
            username: playerDetails.username,
            wallet: playerDetails.wallet,
            old_score: playerDetails.old_score,
            new_score: score,
            timestamp: Date.now(),
            source: 'optimized_batch'
        };

        // Use environment-specific channel
        const envChannel = getEnvironmentKey('tournament:all_updates');

        // Only 1 PUBLISH instead of 2! (50% Redis reduction)
        await redis.publish(envChannel, JSON.stringify(combinedMessage));

        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        console.log(`🚀 OPTIMIZED: Published combined score update (${isProduction ? 'PROD' : 'DEV'}) - 1 command instead of 2`);

        return true;
    } catch (error) {
        console.error('❌ Redis combined publish failed:', error);
        return false;
    }
}