import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    console.log('📊 Leaderboard API called');

    try {
        // Environment-specific database configuration (following Plan.md specification)
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

        const supabaseUrl = isProduction
            ? process.env.SUPABASE_PROD_URL
            : process.env.SUPABASE_DEV_URL;

        const supabaseServiceKey = isProduction
            ? process.env.SUPABASE_PROD_SERVICE_KEY
            : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Missing environment variables for', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
            return NextResponse.json({
                error: `Server configuration error: Missing ${isProduction ? 'production' : 'development'} database credentials`
            }, { status: 500 });
        }

        // Initialize Supabase client with environment-specific credentials
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get query parameters
        const searchParams = req.nextUrl.searchParams;
        const limit = parseInt(searchParams.get('limit') || '10');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Calculate tournament day using weekly tournament logic: Sunday 15:30 UTC boundary
        let defaultTournamentDay;
        if (!searchParams.get('tournament_day')) {
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

            defaultTournamentDay = tournamentSunday.toISOString().split('T')[0];
        }

        const tournamentDay = searchParams.get('tournament_day') || defaultTournamentDay;

        console.log('🔍 Fetching leaderboard:', {
            tournament_day: tournamentDay,
            limit,
            offset
        });

        // Fetch leaderboard data using the new user_tournament_records table
        // Include players who have paid entry fees even if they haven't played yet (highest_score = 0)
        const { data: leaderboardData, error: leaderboardError } = await supabase
            .from('user_tournament_records')
            .select(`
                serial_no,
                username,
                wallet,
                highest_score,
                total_games_played,
                verified_games_played,
                unverified_games_played,
                verified_entry_paid,
                standard_entry_paid,
                created_at
            `)
            .eq('tournament_day', tournamentDay)
            .or('standard_entry_paid.eq.true,verified_entry_paid.eq.true') // Only show players who have paid entry
            .order('highest_score', { ascending: false })
            .order('created_at', { ascending: true })
            .range(offset, offset + limit - 1);

        if (leaderboardError) {
            console.error('❌ Error fetching leaderboard:', leaderboardError);
            return NextResponse.json({
                error: `Failed to fetch leaderboard: ${leaderboardError.message}`
            }, { status: 500 });
        }

        // Get total count for pagination
        const { count, error: countError } = await supabase
            .from('user_tournament_records')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_day', tournamentDay)
            .or('standard_entry_paid.eq.true,verified_entry_paid.eq.true'); // Only count players who have paid entry

        if (countError) {
            console.error('❌ Error getting leaderboard count:', countError);
        }

        // Get tournament stats
        const { data: statsData, error: statsError } = await supabase
            .from('user_tournament_records')
            .select(`
                verified_paid_amount,
                standard_paid_amount,
                total_games_played
            `)
            .eq('tournament_day', tournamentDay);

        let tournamentStats = {
            total_players: count || 0,
            total_prize_pool: 0,
            total_games_played: 0
        };

        if (statsData && !statsError) {
            tournamentStats = {
                total_players: count || 0,
                total_prize_pool: statsData.reduce((sum, record) =>
                    sum + (record.verified_paid_amount || 0) + (record.standard_paid_amount || 0), 0
                ) * 0.7, // 70% goes to prize pool
                total_games_played: statsData.reduce((sum, record) =>
                    sum + (record.total_games_played || 0), 0
                )
            };
        }

        console.log('✅ Leaderboard fetched successfully:', {
            records_count: leaderboardData?.length || 0,
            total_eligible: count,
            tournament_stats: tournamentStats
        });

        return NextResponse.json({
            success: true,
            data: {
                leaderboard: leaderboardData || [],
                tournament_stats: tournamentStats,
                pagination: {
                    limit,
                    offset,
                    total: count || 0,
                    has_more: (offset + limit) < (count || 0)
                }
            }
        });

    } catch (error) {
        console.error('❌ Leaderboard API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
