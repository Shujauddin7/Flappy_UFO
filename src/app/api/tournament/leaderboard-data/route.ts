import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/redis';
import { getCurrentActiveTournament } from '@/utils/database';
import { getLeaderboardData } from '@/utils/leaderboard-queries';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    try {
        // Check if a specific tournament_id was requested
        const { searchParams } = new URL(request.url);
        const requestedTournamentId = searchParams.get('tournament_id');

        // If specific tournament requested, fetch it directly (don't use cache)
        if (requestedTournamentId) {
            const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
            const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
            const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

            if (!supabaseUrl || !supabaseServiceKey) {
                return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
            }

            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            // Fetch the specific tournament
            const { data: tournament, error: tournamentError } = await supabase
                .from('tournaments')
                .select('tournament_day')
                .eq('id', requestedTournamentId)
                .single();

            if (tournamentError || !tournament) {
                return NextResponse.json({
                    players: [],
                    tournament_day: null,
                    total_players: 0,
                    error: 'Tournament not found'
                }, { status: 404 });
            }

            const dbPlayers = await getLeaderboardData(tournament.tournament_day, {
                limit: 1000,
                includeZeroScores: true
            });

            const playersWithRank = dbPlayers.map((player, index) => ({
                ...player,
                id: player.user_id,
                rank: index + 1,
                created_at: new Date().toISOString()
            }));

            return NextResponse.json({
                players: playersWithRank,
                tournament_day: tournament.tournament_day,
                total_players: playersWithRank.length,
                cached: false,
                fetched_at: new Date().toISOString()
            });
        }

        // 🎯 STEP 1: Get current tournament FIRST to build tournament-specific cache key
        const currentTournament = await getCurrentActiveTournament();

        if (!currentTournament) {
            const noTournamentResponse = {
                players: [],
                tournament_day: null,
                total_players: 0,
                cached: false,
                fetched_at: new Date().toISOString()
            };

            // Cache the "no tournament" response for 1 minute with generic key
            const cacheKey = 'tournament_leaderboard_response_no_tournament';
            await setCached(cacheKey, noTournamentResponse, 60);
            return NextResponse.json(noTournamentResponse);
        }

        const tournamentDay = currentTournament.tournament_day;

        // 🎯 STEP 2: Check for TOURNAMENT-SPECIFIC cached response (prevents old data on tournament reset)
        const cacheKey = `tournament_leaderboard_response:${tournamentDay}`;
        const cachedResponse = await getCached(cacheKey);

        if (cachedResponse) {
            return NextResponse.json({
                ...cachedResponse,
                cached: true,
                fetched_at: new Date().toISOString()
            });
        }

        // 🎯 STEP 3: Get leaderboard data from database
        const dbPlayers = await getLeaderboardData(tournamentDay, {
            limit: 1000,
            includeZeroScores: true
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

        // 🎯 STEP 5: Cache the complete response with TOURNAMENT-SPECIFIC key for 2 minutes (fast refresh for active tournaments)
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