import { deleteCached } from '../lib/redis';

/**
 * Tournament Stats Update Helper
 * Ensures consistent cache invalidation for tournament statistics with Supabase Realtime
 */

export interface TournamentStatsUpdateOptions {
    tournamentDay: string;
    // Note: Supabase Realtime handles updates automatically
    rewarmCache?: boolean;
    source?: string;
}

/**
 * Invalidate all tournament statistics caches - Supabase Realtime handles updates automatically
 * This ensures consistency across all tournament-related data
 */
export async function invalidateTournamentStatsCache(options: TournamentStatsUpdateOptions): Promise<boolean> {
    const { tournamentDay, rewarmCache = true, source = 'unknown' } = options;

    console.log(`🔄 Invalidating tournament stats cache (${source}) - Supabase Realtime will handle updates`);

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
            `leaderboard_data:${tournamentDay}` // Clear leaderboard data cache
        ];

        await Promise.all(cacheKeys.map(key => deleteCached(key)));
        console.log('✅ Tournament stats caches invalidated - Supabase Realtime will notify clients');

        // Supabase Realtime handles broadcasting automatically when database changes

        // Step 2: Rewarm cache if requested (for better UX)
        if (rewarmCache) {
            console.log('🔥 Starting background cache rewarm with Supabase Realtime...');

            // Trigger background refresh via API (async, non-blocking)
            fetch('/api/leaderboard', {
                method: 'GET',
                headers: { 'X-Cache-Refresh': 'true' }
            }).catch(e => console.warn('Background rewarming failed:', e));

            console.log('✅ Background rewarm initiated');
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
    const { tournamentDay, rewarmCache = true, source = 'unknown' } = options;

    console.log(`🏆 Invalidating leaderboard cache (${source}) - Supabase Realtime will handle updates`);

    try {
        // Step 1: Invalidate ALL leaderboard caches - COMPREHENSIVE SYNC
        const cacheKeys = [
            'tournament:leaderboard:current',
            `tournament:leaderboard:${tournamentDay}`,
            'tournament_leaderboard_response', // CRITICAL: Main cache key
            `tournament_leaderboard_response:${tournamentDay}`, // Date-specific
            `leaderboard:${tournamentDay}`, // Redis sorted set
            `leaderboard:${tournamentDay}:details`, // Redis player details
            `leaderboard_data:${tournamentDay}`, // Leaderboard data cache
            'tournament_stats_instant' // CRITICAL: Also clear tournament stats for sync
        ];

        await Promise.all(cacheKeys.map(key => deleteCached(key)));
        console.log('✅ Leaderboard caches invalidated - Supabase Realtime will notify clients');

        // Supabase Realtime handles broadcasting automatically when database changes

        // Step 2: Rewarm cache if requested (for better UX)
        if (rewarmCache) {
            console.log('🔥 Starting background cache rewarm with Supabase Realtime...');

            // Trigger background refresh via API (async, non-blocking)
            fetch('/api/leaderboard', {
                method: 'GET',
                headers: { 'X-Cache-Refresh': 'true' }
            }).catch(e => console.warn('Background rewarming failed:', e));

            console.log('✅ Background rewarm initiated');
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