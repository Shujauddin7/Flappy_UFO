/**
 * Idempotency key utilities using Redis SETNX for preventing duplicate operations
 * 
 * Use cases:
 * - Prevent duplicate score submissions from race conditions
 * - Prevent duplicate payment processing
 * - Ensure one-time operations in concurrent environments
 */

import type { Redis as RedisType } from '@upstash/redis';

type RedisClass = typeof RedisType;
type RedisInstance = InstanceType<RedisClass>;

let Redis: RedisClass | null = null;
let devClient: RedisInstance | null = null;
let prodClient: RedisInstance | null = null;

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

// Get environment-prefixed key
function getEnvironmentKey(baseKey: string): string {
    const vercelEnv = process.env.VERCEL_ENV;
    const isProduction = vercelEnv === 'production' || process.env.NEXT_PUBLIC_ENV === 'prod';
    const environment = isProduction ? 'prod' : 'dev';
    return `${environment}:${baseKey}`;
}

/**
 * Acquire an idempotency lock using Redis SETNX
 * Returns true if lock acquired, false if already exists (duplicate operation)
 * 
 * @param key - Unique key for this operation
 * @param ttlSeconds - Time to live in seconds (default 300 = 5 minutes)
 * @returns true if lock acquired, false if duplicate
 */
export async function acquireIdempotencyLock(
    key: string,
    ttlSeconds: number = 300
): Promise<boolean> {
    try {
        const redis = await getRedisClient();
        if (!redis) {
            // If Redis unavailable, allow operation to proceed (fail open)
            console.warn('⚠️ Redis unavailable for idempotency check - allowing operation');
            return true;
        }

        const envKey = getEnvironmentKey(key);

        // SETNX returns 1 if key was set, 0 if key already exists
        // Using set with NX (not exists) and EX (expiry) flags
        const result = await redis.set(envKey, '1', { nx: true, ex: ttlSeconds });

        // Result will be 'OK' if successful, null if key already exists
        return result === 'OK';
    } catch (error) {
        console.error('❌ Error acquiring idempotency lock:', error);
        // Fail open - allow operation on error
        return true;
    }
}

/**
 * Release an idempotency lock (for manual cleanup or testing)
 * 
 * @param key - Unique key to release
 */
export async function releaseIdempotencyLock(key: string): Promise<void> {
    try {
        const redis = await getRedisClient();
        if (!redis) return;

        const envKey = getEnvironmentKey(key);
        await redis.del(envKey);
    } catch (error) {
        console.error('❌ Error releasing idempotency lock:', error);
    }
}

/**
 * Generate idempotency key for score submissions
 * Format: score:{userId}:{tournamentId}:{score}:{gameDuration}:{timestamp}
 */
export function generateScoreIdempotencyKey(
    userId: string,
    tournamentId: string,
    score: number,
    gameDuration: number,
    sessionId?: string
): string {
    // Round timestamp to nearest second to catch rapid duplicate submissions
    const timestampRounded = Math.floor(Date.now() / 1000);

    if (sessionId) {
        return `idempotency:score:${userId}:${tournamentId}:${score}:${gameDuration}:${sessionId}`;
    }

    return `idempotency:score:${userId}:${tournamentId}:${score}:${gameDuration}:${timestampRounded}`;
}

/**
 * Generate idempotency key for payment operations
 * Format: payment:{userId}:{tournamentId}:{amount}:{timestamp}
 */
export function generatePaymentIdempotencyKey(
    userId: string,
    tournamentId: string,
    amount: number,
    paymentReference: string
): string {
    return `idempotency:payment:${userId}:${tournamentId}:${amount}:${paymentReference}`;
}
