import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/redis';
import { getCurrentActiveTournament } from '@/utils/database';
import { getLeaderboardData } from '@/utils/leaderboard-queries';

export async function GET() {
    try {
        // 🎯 STEP 1: Check for cached response first (INSTANT if available)
        const cacheKey = 'tournament_leaderboard_response';
        const cachedResponse = await getCached(cacheKey);

        if (cachedResponse) {
            return NextResponse.json({
                ...cachedResponse,
                cached: true,
                fetched_at: new Date().toISOString()
            });
        }

        // 🎯 STEP 2: Get current tournament
        const currentTournament = await getCurrentActiveTournament();

        if (!currentTournament) {
            const noTournamentResponse = {
                players: [],
                tournament_day: null,
                total_players: 0,
                cached: false,
                fetched_at: new Date().toISOString()
            };

            // Cache the "no tournament" response for 1 minute
            await setCached(cacheKey, noTournamentResponse, 60);
            return NextResponse.json(noTournamentResponse);
        }

        const tournamentDay = currentTournament.tournament_day;
        // 🎯 STEP 3: Get leaderboard data from database
        const dbPlayers = await getLeaderboardData(tournamentDay, {
            limit: 1000,
            includeZeroScores: false
        });
//         const queryTime = Date.now() - queryStartTime;
        // 🎯 STEP 4: Build the response
        const playersWithRank = dbPlayers.map((player, index) => ({
            ...player,
            id: player.user_id,
            rank: index + 1,
            created_at: new Date().toISOString()
        }));

        const responseData = {
            players: playersWithRank,
            tournament_day: tournamentDay,
            total_players: playersWithRank.length,
            cached: false,
            fetched_at: new Date().toISOString()
        };

        // 🎯 STEP 5: Cache the complete response for 2 minutes (fast refresh for active tournaments)
        await setCached(cacheKey, responseData, 120); // 2 minutes

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('❌ Leaderboard data API error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error',
            players: [],
            tournament_day: null,
            total_players: 0,
            cached: false
        }, { status: 500 });
    }
}