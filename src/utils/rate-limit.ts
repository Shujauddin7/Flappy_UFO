/**
 * Rate Limiting Utility
 * Prevents API abuse and spam attacks
 * Uses Upstash Redis for distributed rate limiting
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client for rate limiting
function getRedisForRateLimit() {
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

    const redisUrl = isProduction
        ? process.env.UPSTASH_REDIS_PROD_URL
        : process.env.UPSTASH_REDIS_DEV_URL;

    const redisToken = isProduction
        ? process.env.UPSTASH_REDIS_PROD_TOKEN
        : process.env.UPSTASH_REDIS_DEV_TOKEN;

    if (!redisUrl || !redisToken) {
        throw new Error(`Missing Redis credentials for ${isProduction ? 'production' : 'development'}`);
    }

    return new Redis({
        url: redisUrl,
        token: redisToken,
    });
}

// Rate limiters for different endpoints
let scoreSubmitLimiter: Ratelimit | null = null;
let tournamentEntryLimiter: Ratelimit | null = null;
let verificationLimiter: Ratelimit | null = null;
let generalApiLimiter: Ratelimit | null = null;

/**
 * Get rate limiter for score submission
 * Limit: 10 submissions per minute per user
 */
export function getScoreSubmitLimiter(): Ratelimit {
    if (!scoreSubmitLimiter) {
        scoreSubmitLimiter = new Ratelimit({
            redis: getRedisForRateLimit(),
            limiter: Ratelimit.slidingWindow(10, '60 s'),
            analytics: true,
            prefix: 'ratelimit:score',
        });
    }
    return scoreSubmitLimiter;
}

/**
 * Get rate limiter for tournament entry
 * Limit: 5 entries per minute per user (prevent spam payments)
 */
export function getTournamentEntryLimiter(): Ratelimit {
    if (!tournamentEntryLimiter) {
        tournamentEntryLimiter = new Ratelimit({
            redis: getRedisForRateLimit(),
            limiter: Ratelimit.slidingWindow(5, '60 s'),
            analytics: true,
            prefix: 'ratelimit:entry',
        });
    }
    return tournamentEntryLimiter;
}

/**
 * Get rate limiter for World ID verification
 * Limit: 3 verifications per minute per user (prevent quota exhaustion)
 */
export function getVerificationLimiter(): Ratelimit {
    if (!verificationLimiter) {
        verificationLimiter = new Ratelimit({
            redis: getRedisForRateLimit(),
            limiter: Ratelimit.slidingWindow(3, '60 s'),
            analytics: true,
            prefix: 'ratelimit:verify',
        });
    }
    return verificationLimiter;
}

/**
 * Get general API rate limiter
 * Limit: 30 requests per minute per user
 */
export function getGeneralApiLimiter(): Ratelimit {
    if (!generalApiLimiter) {
        generalApiLimiter = new Ratelimit({
            redis: getRedisForRateLimit(),
            limiter: Ratelimit.slidingWindow(30, '60 s'),
            analytics: true,
            prefix: 'ratelimit:api',
        });
    }
    return generalApiLimiter;
}

/**
 * Apply rate limiting to an API route
 * Returns true if allowed, false if rate limited
 */
export async function checkRateLimit(
    identifier: string,
    limiter: Ratelimit
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    try {
        const { success, limit, remaining, reset } = await limiter.limit(identifier);
        return { success, limit, remaining, reset };
    } catch (error) {
        console.error('❌ Rate limit check failed:', error);
        // On error, allow request but log issue
        return { success: true, limit: 0, remaining: 0, reset: 0 };
    }
}
