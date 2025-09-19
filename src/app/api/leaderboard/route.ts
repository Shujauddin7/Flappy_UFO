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
                    tournamentStats = cachedStats;
                    console.log('🎯 Got tournament stats from cache - complete instant response!');
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

            // For database fallback, get essential tournament stats
            try {
                const { getTournamentStats } = await import('@/utils/leaderboard-queries');
                const stats = await getTournamentStats(currentTournamentDay);
                tournamentStats = {
                    total_players: stats.total_players,
                    total_prize_pool: Number(stats.total_prize_pool.toFixed(2)),
                    total_collected: Number(stats.total_collected.toFixed(2)),
                    total_games_played: stats.total_games_played
                };
            } catch (error) {
                console.warn('⚠️ Could not get tournament stats:', error);
            }
        }

        const responseTime = Date.now() - startTime;

        console.log(`🚀 Leaderboard loaded: ${players.length} players from ${source} in ${responseTime}ms`);

        const responseData: Record<string, unknown> = {
            success: true,
            players,
            pagination: {
                offset,
                limit,
                hasMore: players.length === limit, // Simple check
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

        // Add tournament stats if available
        if (tournamentStats) {
            responseData.tournament_stats = tournamentStats;
            responseData.complete_data = true; // Indicates this response has everything
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