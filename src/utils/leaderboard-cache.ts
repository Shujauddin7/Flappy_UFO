// 🚀 Lightning Fast Leaderboard Cache Utility
// Industry standard pre-loading system used by major gaming apps

interface CachedData {
    data: unknown;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

/**
 * Cache data with TTL in sessionStorage
 */
export function cacheData(key: string, data: unknown, ttlMs: number): void {
    try {
        const cached: CachedData = {
            data,
            timestamp: Date.now(),
            ttl: ttlMs
        };
        sessionStorage.setItem(key, JSON.stringify(cached));
    } catch (error) {
        console.warn(`Failed to cache data for key: ${key}`, error);
    }
}

/**
 * Get cached data if not expired, null otherwise
 */
export function getCachedData(key: string): unknown | null {
    try {
        const cached = sessionStorage.getItem(key);
        if (!cached) return null;

        const parsedCache: CachedData = JSON.parse(cached);
        const isExpired = Date.now() - parsedCache.timestamp > parsedCache.ttl;

        if (isExpired) {
            sessionStorage.removeItem(key);
            return null;
        }

        return parsedCache.data;
    } catch (error) {
        console.warn(`Failed to get cached data for key: ${key}`, error);
        sessionStorage.removeItem(key); // Clear corrupted cache
        return null;
    }
}

/**
 * Clear specific cache or all leaderboard-related cache
 */
export function clearLeaderboardCache(key?: string): void {
    try {
        if (key) {
            sessionStorage.removeItem(key);
        } else {
            // Clear all leaderboard-related cache
            sessionStorage.removeItem('preloaded_tournament');
            sessionStorage.removeItem('preloaded_leaderboard');
        }
    } catch (error) {
        console.warn('Failed to clear cache:', error);
    }
}

/**
 * Check if cached data exists and is fresh
 */
export function hasFreshCache(key: string): boolean {
    return getCachedData(key) !== null;
}

// Cache keys used throughout the app
export const CACHE_KEYS = {
    TOURNAMENT: 'preloaded_tournament',
    LEADERBOARD: 'preloaded_leaderboard'
} as const;

// TTL constants (in milliseconds) - Optimized for INSTANT updates like professional mobile games
export const CACHE_TTL = {
    TOURNAMENT: 5000,      // 5 seconds - instant tournament info updates
    LEADERBOARD: 2000,     // 2 seconds - near-instant leaderboard updates  
    REAL_TIME: 1000,       // 1 second - truly real-time features
    PRELOAD_TOURNAMENT: 10000,   // 10 seconds - quick refresh for preloaded data
    PRELOAD_LEADERBOARD: 5000,   // 5 seconds - quick refresh for leaderboard
    REDIS_CACHE: 30,       // 30 seconds in seconds - faster Redis refresh
    NO_TOURNAMENT: 60      // 1 minute in seconds - when no tournament exists
} as const;