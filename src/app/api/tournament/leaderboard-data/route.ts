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

        // Calculate tournament day using weekly tournament logic: Sunday 15:30 UTC boundary
        const now = new Date();
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();

        // Tournament week starts at 15:30 UTC Sunday, so if it's before 15:30, use last week's Sunday
        const tournamentDate = new Date(now);
        if (utcHour < 15 || (utcHour === 15 && utcMinute < 30)) {
            tournamentDate.setUTCDate(tournamentDate.getUTCDate() - 1);
        }

        // Get the Sunday of this week for tournament_day
        const dayOfWeek = tournamentDate.getUTCDay(); // 0 = Sunday
        const daysToSubtract = dayOfWeek; // Days since last Sunday
        const tournamentSunday = new Date(tournamentDate);
        tournamentSunday.setUTCDate(tournamentDate.getUTCDate() - daysToSubtract);

        const tournamentDay = tournamentSunday.toISOString().split('T')[0];

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
