import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDay } from '@/utils/database';
import { getLeaderboardData } from '@/utils/leaderboard-queries';

// Get leaderboard from Redis Sorted Set with complete player data (ultra-fast)
async function getLeaderboardFromRedis(tournamentDay: string, offset: number = 0, limit: number = 20) {
    try {
        // Use the enhanced Redis function that includes complete player details
        const { getTopPlayers } = await import('@/lib/leaderboard-redis');
        return await getTopPlayers(tournamentDay, offset, limit);
    } catch (error) {
        console.error('❌ Redis leaderboard query failed:', error);
        return null;
    }
}

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    console.log('🏁 Optimized Leaderboard API called');

    try {
        const { searchParams } = req.nextUrl;
        const offset = parseInt(searchParams.get('offset') || '0');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 per request
        const tournamentDay = searchParams.get('tournament_day');

        // Get current tournament day if not provided using shared utility
        const currentTournamentDay = await getTournamentDay(tournamentDay);

        let players = [];
        let source = 'database';
        let tournamentStats = null;

        // Try Redis first (ultra-fast with complete data)
        const redisPlayers = await getLeaderboardFromRedis(currentTournamentDay, offset, limit);

        if (redisPlayers && redisPlayers.length > 0) {
            // Redis now contains complete player data - no need for separate database query!
            players = redisPlayers.map(redisPlayer => ({
                ...redisPlayer,
                highest_score: redisPlayer.score, // Map score to highest_score for compatibility
                tournament_day: currentTournamentDay
            }));

            source = 'redis';

            // For Redis hits, also try to get cached tournament stats for instant complete data
            try {
                const { getCached } = await import('@/lib/redis');
                const cachedStats = await getCached('tournament_stats_instant');
                if (cachedStats && typeof cachedStats === 'object') {
                    // Extract only UI-essential data from cached stats
                    const statsObj = cachedStats as Record<string, unknown>;
                    tournamentStats = {
                        total_players: (statsObj.total_players as number) || 0,
                        total_prize_pool: (statsObj.total_prize_pool as number) || 0
                    };
                    console.log('🎯 Got essential tournament stats from cache - optimized instant response!');
                }
            } catch {
                console.log('⚠️ Could not get cached tournament stats, continuing without');
            }
        } else {
            // Fallback to database query using shared utilities
            console.log('📊 Redis miss - using database fallback');
            players = await getLeaderboardData(currentTournamentDay, {
                limit,
                offset,
                includeZeroScores: false
            });

            // Add missing properties for compatibility
            players = players.map(player => ({
                ...player,
                score: player.highest_score // Map highest_score to score for compatibility
            }));

            // For database fallback, get ONLY essential tournament stats for UI display
            try {
                const { getTournamentStats } = await import('@/utils/leaderboard-queries');
                const stats = await getTournamentStats(currentTournamentDay);

                // UI ESSENTIAL DATA ONLY - what's actually displayed
                tournamentStats = {
                    total_players: stats.total_players,
                    total_prize_pool: Number(stats.total_prize_pool.toFixed(2))
                };

                // Keep debug info but separate for your reference (not sent to frontend)
                console.log(`📊 Tournament Debug Info: Collected: ${stats.total_collected} WLD, Games: ${stats.total_games_played}`);
            } catch (error) {
                console.warn('⚠️ Could not get tournament stats:', error);
            }
        }

        const responseTime = Date.now() - startTime;

        console.log(`🚀 Leaderboard loaded: ${players.length} players from ${source} in ${responseTime}ms`);

        // 🎯 OPTIMIZED RESPONSE - Only UI-essential data for maximum speed
        // UI displays: Rank, Player Name, Score, Prize
        // Tournament stats: Total Players, Prize Pool (for header display)
        const responseData: Record<string, unknown> = {
            success: true,
            players, // Contains: user_id, username, wallet, highest_score, rank
            pagination: {
                offset,
                limit,
                hasMore: players.length === limit,
                nextOffset: offset + limit
            },
            performance: {
                source,
                responseTime: responseTime,
                cached: source === 'redis'
            },
            tournament_day: currentTournamentDay,
            fetched_at: new Date().toISOString()
        };

        // Add essential tournament stats if available (UI display only)
        if (tournamentStats) {
            responseData.tournament_stats = tournamentStats; // Only: total_players, total_prize_pool
            responseData.complete_data = true; // Single API call has everything for UI
        } else {
            responseData.complete_data = false; // Frontend should call /tournament/stats separately
        }

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('❌ Optimized leaderboard error:', error);
        return NextResponse.json({
            error: 'Failed to load leaderboard',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}