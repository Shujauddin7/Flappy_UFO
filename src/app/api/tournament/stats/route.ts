import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    console.log('📈 Tournament stats API called');

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
        const tournamentDay = searchParams.get('tournament_day') || new Date().toISOString().split('T')[0];

        console.log('🔍 Fetching tournament stats for:', tournamentDay);

        // Get comprehensive tournament statistics
        const { data: statsData, error: statsError } = await supabase
            .from('user_tournament_records')
            .select(`
                verified_paid_amount,
                standard_paid_amount,
                total_games_played,
                verified_games_played,
                unverified_games_played,
                highest_score,
                total_continues_used,
                total_continue_payments
            `)
            .eq('tournament_day', tournamentDay);

        if (statsError) {
            console.error('❌ Error fetching tournament stats:', statsError);
            return NextResponse.json({
                error: `Failed to fetch tournament stats: ${statsError.message}`
            }, { status: 500 });
        }

        // Calculate comprehensive stats
        const stats = {
            // Player counts
            total_players: statsData?.length || 0,
            verified_players: statsData?.filter(r => r.verified_paid_amount > 0).length || 0,
            unverified_players: statsData?.filter(r => r.standard_paid_amount > 0).length || 0,

            // Financial stats
            total_collected: statsData?.reduce((sum, record) =>
                sum + (record.verified_paid_amount || 0) + (record.standard_paid_amount || 0), 0
            ) || 0,
            verified_collected: statsData?.reduce((sum, record) =>
                sum + (record.verified_paid_amount || 0), 0
            ) || 0,
            unverified_collected: statsData?.reduce((sum, record) =>
                sum + (record.standard_paid_amount || 0), 0
            ) || 0,
            continue_revenue: statsData?.reduce((sum, record) =>
                sum + (record.total_continue_payments || 0), 0
            ) || 0,

            // Game statistics
            total_games_played: statsData?.reduce((sum, record) =>
                sum + (record.total_games_played || 0), 0
            ) || 0,
            verified_games: statsData?.reduce((sum, record) =>
                sum + (record.verified_games_played || 0), 0
            ) || 0,
            unverified_games: statsData?.reduce((sum, record) =>
                sum + (record.unverified_games_played || 0), 0
            ) || 0,
            total_continues_used: statsData?.reduce((sum, record) =>
                sum + (record.total_continues_used || 0), 0
            ) || 0,

            // Score statistics
            highest_score: Math.max(...(statsData?.map(r => r.highest_score || 0) || [0])),
            average_score: statsData?.length ?
                statsData.reduce((sum, record) => sum + (record.highest_score || 0), 0) / statsData.length
                : 0,

            // Prize pool calculation
            prize_pool: 0,
            tournament_day: tournamentDay
        };

        // Calculate prize pool (70% of total collected including continues)
        stats.prize_pool = (stats.total_collected + stats.continue_revenue) * 0.7;

        console.log('✅ Tournament stats calculated:', stats);

        return NextResponse.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Tournament stats API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
