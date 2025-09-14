import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        // Environment-specific database configuration
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({
                error: 'Server configuration error'
            }, { status: 500 });
        }

        // Initialize Supabase client with service role key for full permissions
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get current active tournament first to use its tournament_day
        const { data: tournaments, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);

        if (tournamentError) {
            console.error('Error fetching active tournament:', tournamentError);
            return NextResponse.json({
                error: 'Failed to fetch current tournament'
            }, { status: 500 });
        }

        if (!tournaments || tournaments.length === 0) {
            return NextResponse.json({
                error: 'No active tournament found',
                players: [],
                tournament_day: null
            });
        }

        const currentTournament = tournaments[0];
        const tournamentDay = currentTournament.tournament_day;

        // Debug: Log what tournament day we're fetching (development only)
        if (process.env.NODE_ENV === 'development') {
        }

        // Fetch all players for this tournament who have:
        // 1. Actually PAID for entry (verified OR standard entry paid)
        // 2. Have submitted at least one score (highest_score > 0)
        // This prevents showing users with 0 scores before they submit their first game
        const { data: players, error } = await supabase
            .from('user_tournament_records')
            .select('*')
            .eq('tournament_day', tournamentDay)
            .gt('highest_score', 0) // Only show users who have submitted scores
            .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true') // Only paid entries
            .order('highest_score', { ascending: false })
            .order('first_game_at', { ascending: true }); // Tie-breaker: earlier first game wins

        if (error) {
            console.error('Error fetching leaderboard:', error);
            return NextResponse.json({
                error: 'Failed to fetch leaderboard data'
            }, { status: 500 });
        }

        if (!players || players.length === 0) {
            return NextResponse.json({
                players: [],
                tournament_day: tournamentDay
            });
        }

        // Add rank to each player
        const playersWithRank = players.map((player, index) => ({
            ...player,
            rank: index + 1
        }));

        return NextResponse.json({
            players: playersWithRank,
            tournament_day: tournamentDay,
            total_players: playersWithRank.length
        });

    } catch (error) {
        console.error('❌ Leaderboard data API error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
