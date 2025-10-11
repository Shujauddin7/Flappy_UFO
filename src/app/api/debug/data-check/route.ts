import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/utils/database';

export async function GET() {
    try {
        const supabase = await getSupabaseClient();
        
        // Check current tournament
        const { data: tournaments, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('is_active', true)
            .limit(1);

        if (tournamentError) {
            return NextResponse.json({
                status: 'error',
                error: 'Database query failed',
                details: tournamentError.message,
            }, { status: 500 });
        }

        const currentTournament = tournaments?.[0];

        let leaderboardData = null;
        if (currentTournament) {
            const { data, error } = await supabase
                .from('user_tournament_records')
                .select('*')
                .eq('tournament_day', currentTournament.tournament_day)
                .order('highest_score', { ascending: false })
                .limit(10);
            
            if (!error) {
                leaderboardData = data;
            }
        }

        return NextResponse.json({
            status: 'success',
            database: {
                connected: true,
                environment: process.env.NEXT_PUBLIC_ENV || 'not set',
            },
            tournament: {
                exists: !!currentTournament,
                tournament_day: currentTournament?.tournament_day || null,
                total_players: currentTournament?.total_players || 0,
                total_prize_pool: currentTournament?.total_prize_pool || 0,
                is_active: currentTournament?.is_active || false,
            },
            leaderboard: {
                playerCount: leaderboardData?.length || 0,
                hasData: Array.isArray(leaderboardData) && leaderboardData.length > 0,
                topScore: leaderboardData?.[0]?.highest_score || 0,
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return NextResponse.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
