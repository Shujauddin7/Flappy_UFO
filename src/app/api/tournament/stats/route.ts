import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {

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
        let tournamentDay = searchParams.get('tournament_day');

        // If no tournament_day provided, get from current active tournament
        if (!tournamentDay) {
            const { data: activeTournament, error: tournamentError } = await supabase
                .from('tournaments')
                .select('tournament_day')
                .eq('is_active', true)
                .single();

            if (tournamentError || !activeTournament) {
                return NextResponse.json({
                    error: 'No active tournament found'
                }, { status: 404 });
            }

            tournamentDay = activeTournament.tournament_day;
        }


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

            tournament_day: tournamentDay
        };

        // Calculate total revenue (entry fees + continues)
        const totalRevenue = stats.total_collected + stats.continue_revenue;

        // New guarantee system (simple 70/30 split + guarantee when needed)
        const adminFeePercentage = 30;
        const prizePoolPercentage = 70;

        const adminFee = totalRevenue * (adminFeePercentage / 100);
        const basePrizePool = totalRevenue * (prizePoolPercentage / 100);

        // Add guarantee if needed (when revenue < 72 WLD)
        const guaranteeAmount = totalRevenue < 72 ? 10 : 0;
        const finalPrizePool = basePrizePool + guaranteeAmount;
        const adminNetResult = adminFee - guaranteeAmount;

        // Update tournaments table with calculated values (NEW)
        const { error: updateError } = await supabase
            .from('tournaments')
            .update({
                total_players: stats.total_players,
                total_collected: totalRevenue,
                total_prize_pool: finalPrizePool,
                admin_fee: adminFee,
                guarantee_amount: guaranteeAmount,
                admin_net_result: adminNetResult
            })
            .eq('tournament_day', tournamentDay);

        if (updateError) {
            console.error('❌ Error updating tournament stats:', updateError);
            // Don't fail the API, just log the error
        }

        // Add dynamic prize pool info to stats
        const enhancedStats = {
            ...stats,
            total_revenue: totalRevenue,
            prize_pool: {
                base_amount: basePrizePool,
                guarantee_amount: guaranteeAmount,
                final_amount: finalPrizePool,
                percentage: prizePoolPercentage
            },
            admin_fee: {
                amount: adminFee,
                percentage: adminFeePercentage,
                guarantee_cost: guaranteeAmount,
                net_result: adminNetResult
            },
            guarantee_applied: guaranteeAmount > 0
        };


        return NextResponse.json({
            success: true,
            data: enhancedStats
        });

    } catch (error) {
        console.error('❌ Tournament stats API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}