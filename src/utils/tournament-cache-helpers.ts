import { deleteCached, setCached } from '../lib/redis';

/**
 * Tournament Stats Update Helper
 * Ensures consistent cache invalidation and SSE broadcasting for tournament statistics
 */

export interface TournamentStatsUpdateOptions {
    tournamentDay: string;
    triggerSSE?: boolean;
    rewarmCache?: boolean;
    source?: string;
}

/**
 * Invalidate all tournament statistics caches and optionally trigger SSE updates
 * This ensures consistency across all tournament-related data
 */
export async function invalidateTournamentStatsCache(options: TournamentStatsUpdateOptions): Promise<boolean> {
    const { tournamentDay, triggerSSE = true, rewarmCache = true, source = 'unknown' } = options;

    console.log(`🔄 Invalidating tournament stats cache (${source})`);

    try {
        // Step 1: Invalidate all tournament-related caches - COMPREHENSIVE SYNC
        const cacheKeys = [
            'tournament_stats_instant',
            'tournament:current',
            'tournament:prizes:current',
            `tournament:stats:${tournamentDay}`,
            `tournament:prizes:${tournamentDay}`,
            'tournament_leaderboard_response', // CRITICAL: Also clear leaderboard cache
            `tournament_leaderboard_response:${tournamentDay}`, // Date-specific too
            `leaderboard_data:${tournamentDay}`, // CRITICAL: Clear WebSocket instant data
            `tournament_stats_updates:${tournamentDay}`, // Clear previous SSE triggers
            `leaderboard_updates:${tournamentDay}` // CRITICAL: Clear leaderboard SSE triggers too
        ];

        await Promise.all(cacheKeys.map(key => deleteCached(key)));
        console.log('✅ Tournament stats caches invalidated');

        // Step 2: Trigger SSE broadcast if requested
        if (triggerSSE) {
            const updateKey = `tournament_stats_updates:${tournamentDay}`;
            await setCached(updateKey, Date.now().toString(), 300); // 5 min TTL
            console.log('✅ Tournament stats SSE trigger set');
        }

        // Step 3: Rewarm cache immediately if requested
        if (rewarmCache) {
            // CRITICAL FIX: Use dynamic URL to avoid cross-environment issues
            const baseUrl = process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : (process.env.NEXT_PUBLIC_ENV === 'prod'
                    ? 'https://flappyufo.vercel.app'
                    : 'https://flappyufo-git-dev-shujauddin.vercel.app');
            if (baseUrl) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

                try {
                    const response = await fetch(`${baseUrl}/api/tournament/stats`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        console.log('✅ Tournament stats cache rewarmed');
                    } else {
                        console.warn('⚠️ Tournament stats rewarming returned non-OK status:', response.status);
                    }
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    console.error('❌ Tournament stats rewarming failed:', fetchError);
                    return false;
                }
            }
        }

        return true;
    } catch (error) {
        console.error('❌ Tournament stats cache invalidation failed:', error);
        return false;
    }
}

/**
 * Update leaderboard cache and trigger real-time updates
 * Used when high scores are submitted
 */
export async function invalidateLeaderboardCache(options: TournamentStatsUpdateOptions): Promise<boolean> {
    const { tournamentDay, triggerSSE = true, rewarmCache = true, source = 'unknown' } = options;

    console.log(`🏆 Invalidating leaderboard cache (${source})`);

    try {
        // Step 1: Invalidate ALL leaderboard caches - COMPREHENSIVE SYNC
        const cacheKeys = [
            'tournament:leaderboard:current',
            `tournament:leaderboard:${tournamentDay}`,
            'tournament_leaderboard_response', // CRITICAL: Main cache key
            `tournament_leaderboard_response:${tournamentDay}`, // Date-specific
            `leaderboard:${tournamentDay}`, // Redis sorted set
            `leaderboard:${tournamentDay}:details`, // Redis player details
            `leaderboard_data:${tournamentDay}`, // CRITICAL: WebSocket instant data cache
            `leaderboard_updates:${tournamentDay}`, // Clear previous update triggers
            'tournament_stats_instant' // CRITICAL: Also clear tournament stats for sync
        ];

        await Promise.all(cacheKeys.map(key => deleteCached(key)));
        console.log('✅ Leaderboard caches invalidated');

        // Step 2: Trigger SSE broadcast for leaderboard updates
        if (triggerSSE) {
            const updateKey = `leaderboard_updates:${tournamentDay}`;
            await setCached(updateKey, Date.now().toString(), 300); // 5 min TTL
            console.log('✅ Leaderboard SSE trigger set');
        }

        // Step 3: 🚀 CRITICAL FIX - Rewarm cache immediately (same as tournament stats!)
        if (rewarmCache) {
            // CRITICAL FIX: Use dynamic URL to avoid cross-environment issues
            const baseUrl = process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : (process.env.NEXT_PUBLIC_ENV === 'prod'
                    ? 'https://flappyufo.vercel.app'
                    : 'https://flappyufo-git-dev-shujauddin.vercel.app');
            if (baseUrl) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

                try {
                    const response = await fetch(`${baseUrl}/api/tournament/leaderboard-data`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        signal: controller.signal,
                        cache: 'no-store'
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        console.log('✅ Leaderboard cache rewarmed - instant SSE updates ready!');
                    } else {
                        console.warn('⚠️ Leaderboard rewarming returned non-OK status:', response.status);
                    }
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    console.error('❌ Leaderboard rewarming failed:', fetchError);
                    return false;
                }
            }
        }

        return true;
    } catch (error) {
        console.error('❌ Leaderboard cache invalidation failed:', error);
        return false;
    }
}

/**
 * Comprehensive cache invalidation for when both leaderboard and tournament stats change
 * Used for major events like new tournament entries or high scores
 */
export async function invalidateAllTournamentCaches(options: TournamentStatsUpdateOptions): Promise<boolean> {
    const results = await Promise.all([
        invalidateTournamentStatsCache(options),
        invalidateLeaderboardCache(options)
    ]);

    return results.every(result => result === true);
}