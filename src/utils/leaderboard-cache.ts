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
    } catch {
        // Intentionally ignore cache errors
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
    } catch {
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
    } catch {
        // Intentionally ignore cache errors
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

// TTL constants (in milliseconds) - Optimized for capacity (96% Redis reduction)
// Socket.IO handles real-time updates (prize pool, continue amount) - those stay INSTANT!
export const CACHE_TTL = {
    TOURNAMENT: 30000,     // 30 seconds - Socket.IO handles instant prize pool updates
    LEADERBOARD: 60000,    // 60 seconds - background data only (Socket.IO handles real-time)
    REAL_TIME: 1000,       // 1 second - truly real-time features
    PRELOAD_TOURNAMENT: 30000,   // 30 seconds - Socket.IO handles instant updates
    PRELOAD_LEADERBOARD: 60000,  // 60 seconds - background data only
    REDIS_CACHE: 60,       // 60 seconds - Redis cache for background data
    NO_TOURNAMENT: 60,     // 1 minute in seconds - when no tournament exists
    OWN_SCORE: 0           // 0 seconds - own score always fresh (cache cleared on score)
} as const;