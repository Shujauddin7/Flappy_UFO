import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/redis';
import { getCurrentActiveTournament } from '@/utils/database';
import { getLeaderboardData } from '@/utils/leaderboard-queries';
import { CACHE_TTL } from '@/utils/leaderboard-cache';
import { getTopPlayers, populateLeaderboard } from '@/lib/leaderboard-redis';

export async function GET() {
    const startTime = Date.now();
    console.log('🚀 LEADERBOARD DATA API START - Professional Gaming Performance');

    try {
        // 🎯 STEP 1: Get current tournament (source of truth)
        const currentTournament = await getCurrentActiveTournament();

        if (!currentTournament) {
            return NextResponse.json({
                error: 'No active tournament found',
                players: [],
                tournament_day: null
            });
        }

        const tournamentDay = currentTournament.tournament_day;
        console.log(`🔍 Leaderboard request for tournament: ${tournamentDay}`);

        // ⚡ STEP 2: Try ultra-fast Redis Sorted Set first (instant, no DB)
        const redisStart = Date.now();
        const redisPlayers = await getTopPlayers(tournamentDay, 0, 1000);
        if (redisPlayers && redisPlayers.length > 0) {
            const playersWithRank = redisPlayers.map(p => ({
                id: p.user_id,
                user_id: p.user_id,
                username: p.username ?? null,
                wallet: p.wallet ?? 'Unknown',
                highest_score: p.score,
                tournament_day: tournamentDay,
                created_at: new Date().toISOString(),
                rank: p.rank
            }));

            console.log(`⚡ Redis hit: ${playersWithRank.length} players in ${Date.now() - redisStart}ms`);

            return NextResponse.json({
                players: playersWithRank,
                tournament_day: tournamentDay,
                total_players: playersWithRank.length,
                cached: true,
                fetched_at: new Date().toISOString()
            });
        }

        console.log('🔴 Redis leaderboard empty or unavailable → falling back to DB, then populating Redis');

        // 🗄️ STEP 3: Fallback to DB (exclude zero scores for performance)
        const queryStartTime = Date.now();
        const dbPlayers = await getLeaderboardData(tournamentDay, {
            limit: 1000,
            includeZeroScores: false
        });
        const queryTime = Date.now() - queryStartTime;
        console.log(`⚡ Database fallback completed in ${queryTime}ms for ${dbPlayers.length} players`);

        if (dbPlayers.length === 0) {
            return NextResponse.json({
                players: [],
                tournament_day: tournamentDay,
                total_players: 0,
                cached: false,
                fetched_at: new Date().toISOString()
            });
        }

        // Populate Redis leaderboard for next requests (non-blocking best-effort)
        try {
            await populateLeaderboard(
                tournamentDay,
                dbPlayers.map(p => ({
                    user_id: p.user_id,
                    highest_score: p.highest_score,
                    username: (p as any).username,
                    wallet: (p as any).wallet
                }))
            );
            console.log('✅ Redis leaderboard populated from DB fallback');
        } catch (e) {
            console.warn('⚠️ Failed to populate Redis leaderboard (non-critical):', e);
        }

        const playersWithRank = dbPlayers.map((player) => ({
            ...player,
            id: player.user_id,
            created_at: new Date().toISOString()
        }));

        const responseData = {
            players: playersWithRank,
            tournament_day: tournamentDay,
            total_players: playersWithRank.length,
            cached: false,
            fetched_at: new Date().toISOString()
        };

        // 💾 STEP 4: Also store a compact JSON cache for resilience
        const cacheKey = 'tournament_leaderboard_data';
        await setCached(cacheKey, responseData, CACHE_TTL.REDIS_CACHE);

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('❌ Leaderboard data API error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}