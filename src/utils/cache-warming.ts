import { getCached, setCached } from '@/lib/redis';
import { getCurrentActiveTournament } from './database';
import { getTournamentStats } from './leaderboard-queries';

/**
 * Cache Warming System for Professional Mobile Game Performance
 * Pre-populates Redis cache so users NEVER see "loading tournament" messages
 */

/**
 * Warm tournament stats cache
 * Call this function regularly to ensure instant loading
 */
export async function warmTournamentStatsCache(): Promise<boolean> {
    try {
        console.log('🔥 WARMING TOURNAMENT STATS CACHE...');

        const cacheKey = 'tournament_stats_instant';

        // Get current tournament data
        const currentTournament = await getCurrentActiveTournament();

        if (!currentTournament) {
            // Cache "no tournament" response
            const noTournamentResponse = {
                tournament_day: null,
                total_players: 0,
                total_prize_pool: 0,
                total_collected: 0,
                total_games_played: 0,
                has_active_tournament: false
            };

            await setCached(cacheKey, noTournamentResponse, 300); // 5 minutes
            console.log('✅ Warmed cache with "no tournament" data');
            return true;
        }

        // Get tournament statistics
        const tournamentDay = currentTournament.tournament_day;
        const stats = await getTournamentStats(tournamentDay);

        const responseData = {
            tournament_day: tournamentDay,
            tournament_name: currentTournament.name || `Tournament ${tournamentDay}`,
            total_players: stats.total_players,
            total_prize_pool: Number(stats.total_prize_pool.toFixed(2)),
            total_collected: Number(stats.total_collected.toFixed(2)),
            total_games_played: stats.total_games_played,
            has_active_tournament: true,
            tournament_start_date: currentTournament.created_at,
            tournament_status: 'active'
        };

        // Cache for 3 minutes
        await setCached(cacheKey, responseData, 180);

        console.log('✅ Tournament stats cache warmed successfully');
        console.log(`   📊 Players: ${stats.total_players}`);
        console.log(`   💰 Prize Pool: $${stats.total_prize_pool.toFixed(2)}`);
        console.log(`   🎮 Games Played: ${stats.total_games_played}`);

        return true;

    } catch (error) {
        console.error('❌ Failed to warm tournament stats cache:', error);
        return false;
    }
}

/**
 * Warm leaderboard data cache
 * Pre-populate the main leaderboard cache for instant loading
 */
export async function warmLeaderboardCache(): Promise<boolean> {
    try {
        console.log('🔥 WARMING LEADERBOARD CACHE...');

        // Check if cache already warm
        const cacheKey = 'tournament_leaderboard_data';
        const existing = await getCached(cacheKey);

        if (existing) {
            console.log('✅ Leaderboard cache already warm');
            return true;
        }

        // Make a request to the leaderboard API to warm it
        const response = await fetch('/api/tournament/leaderboard-data');
        if (response.ok) {
            console.log('✅ Leaderboard cache warmed via API call');
            return true;
        } else {
            console.log('⚠️ Failed to warm leaderboard cache via API');
            return false;
        }

    } catch (error) {
        console.error('❌ Failed to warm leaderboard cache:', error);
        return false;
    }
}

interface CacheWarmingDetails {
    results: {
        tournament_stats: boolean;
        leaderboard_data: boolean;
    };
    warming_time_ms?: number;
    timestamp: string;
    error?: string;
}

/**
 * Master cache warming function
 * Warms all critical caches for instant user experience
 */
export async function warmAllCaches(): Promise<{ success: boolean; details: CacheWarmingDetails }> {
    const startTime = Date.now();
    console.log('🚀 WARMING ALL CACHES FOR INSTANT MOBILE GAME PERFORMANCE...');

    const results = {
        tournament_stats: false,
        leaderboard_data: false
    };

    try {
        // Warm tournament stats (most critical for instant loading)
        results.tournament_stats = await warmTournamentStatsCache();

        // Warm leaderboard data
        results.leaderboard_data = await warmLeaderboardCache();

        const allWarmed = Object.values(results).every(result => result === true);
        const totalTime = Date.now() - startTime;

        if (allWarmed) {
            console.log('🎉 ALL CACHES WARMED SUCCESSFULLY!');
            console.log(`   ⚡ Total warming time: ${totalTime}ms`);
            console.log('   🎮 Ready for professional mobile game performance!');
        } else {
            console.log('⚠️ Some caches failed to warm:', results);
        }

        return {
            success: allWarmed,
            details: {
                results,
                warming_time_ms: totalTime,
                timestamp: new Date().toISOString()
            }
        };

    } catch (error) {
        console.error('❌ Master cache warming failed:', error);
        return {
            success: false,
            details: {
                error: error instanceof Error ? error.message : 'Unknown error',
                results,
                timestamp: new Date().toISOString()
            }
        };
    }
}

/**
 * Schedule cache warming (call this on server startup)
 * Keeps cache warm with background updates
 */
export function scheduleRegularCacheWarming() {
    console.log('📅 SCHEDULING REGULAR CACHE WARMING...');

    // Warm immediately on startup
    warmAllCaches();

    // Warm every 2 minutes to ensure cache never expires
    const intervalId = setInterval(() => {
        console.log('🔄 SCHEDULED CACHE WARMING...');
        warmAllCaches();
    }, 2 * 60 * 1000); // 2 minutes

    console.log('✅ Cache warming scheduled every 2 minutes');
    console.log('🎮 Professional mobile game performance enabled!');

    return intervalId;
}