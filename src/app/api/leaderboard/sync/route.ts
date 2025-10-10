import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { populateLeaderboard } from '@/lib/leaderboard-redis';

export async function POST(req: NextRequest) {
    const startTime = Date.now();
    try {
        const { searchParams } = req.nextUrl;
        const tournamentDay = searchParams.get('tournament_day');

        // Get current tournament if not specified
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        let targetTournamentDay = tournamentDay;
        if (!targetTournamentDay) {
            const { data: tournament } = await supabase
                .from('tournaments')
                .select('tournament_day')
                .eq('is_active', true)
                .single();

            if (!tournament) {
                return NextResponse.json({ error: 'No active tournament found' }, { status: 404 });
            }

            targetTournamentDay = tournament.tournament_day;
        }

        // Fetch all players with scores AND complete details for the tournament
        const { data: players, error } = await supabase
            .from('user_tournament_records')
            .select('user_id, highest_score, username, wallet, first_game_at')
            .eq('tournament_day', targetTournamentDay)
            .gt('highest_score', 0)
            .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true')
            .order('highest_score', { ascending: false })
            .order('first_game_at', { ascending: true }); // Tiebreaker

        if (error) {
            throw error;
        }

        if (!players || players.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No players to sync',
                tournament_day: targetTournamentDay,
                synced_count: 0,
                sync_time: Date.now() - startTime
            });
        }

        if (!targetTournamentDay) {
            return NextResponse.json({ error: 'Tournament day is required' }, { status: 400 });
        }

        // Populate Redis leaderboard
        const success = await populateLeaderboard(targetTournamentDay, players);

        if (!success) {
            return NextResponse.json({
                error: 'Failed to sync leaderboard to Redis'
            }, { status: 500 });
        }

        const syncTime = Date.now() - startTime;

        return NextResponse.json({
            success: true,
            message: 'Leaderboard synced successfully',
            tournament_day: targetTournamentDay,
            synced_count: players.length,
            sync_time: syncTime,
            top_players: players.slice(0, 5).map((p, i) => ({
                rank: i + 1,
                user_id: p.user_id,
                score: p.highest_score
            }))
        });

    } catch (error) {
        console.error('❌ Leaderboard sync error:', error);
        return NextResponse.json({
            error: 'Sync failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// GET: Check sync status
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const tournamentDay = searchParams.get('tournament_day');

        // Get leaderboard size from Redis
        const { getLeaderboardSize } = await import('@/lib/leaderboard-redis');

        let targetTournamentDay = tournamentDay;
        if (!targetTournamentDay) {
            const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
            const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
            const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

            if (!supabaseUrl || !supabaseServiceKey) {
                return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
            }

            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const { data: tournament } = await supabase
                .from('tournaments')
                .select('tournament_day')
                .eq('is_active', true)
                .single();

            if (!tournament) {
                return NextResponse.json({ error: 'No active tournament found' }, { status: 404 });
            }

            targetTournamentDay = tournament.tournament_day;
        }

        if (!targetTournamentDay) {
            return NextResponse.json({ error: 'Tournament day not found' }, { status: 404 });
        }

        const redisCount = await getLeaderboardSize(targetTournamentDay);

        return NextResponse.json({
            success: true,
            tournament_day: targetTournamentDay,
            redis_players_count: redisCount,
            is_synced: redisCount > 0,
            last_checked: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Sync status error:', error);
        return NextResponse.json({
            error: 'Failed to check sync status',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}