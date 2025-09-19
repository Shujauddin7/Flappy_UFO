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
    const environment = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    return `${environment}:${baseKey}`;
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