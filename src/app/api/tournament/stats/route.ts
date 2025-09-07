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

        // Calculate tournament day using same logic as tournament system (Sunday 15:30 UTC boundary)
        // Updated for weekly tournaments - find current week's Sunday
        let defaultTournamentDay;
        if (!searchParams.get('tournament_day')) {
            const now = new Date();
            const utcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
            const utcHour = now.getUTCHours();
            const utcMinute = now.getUTCMinutes();

            // Weekly tournament starts every Sunday at 15:30 UTC
            const tournamentDate = new Date(now);

            if (utcDay === 0 && (utcHour > 15 || (utcHour === 15 && utcMinute >= 30))) {
                // It's Sunday after 15:30 UTC, use current Sunday
                // Keep current date
            } else {
                // Go back to the most recent Sunday
                const daysBack = utcDay === 0 ? 7 : utcDay; // If Sunday before 15:30, go back 7 days
                tournamentDate.setUTCDate(tournamentDate.getUTCDate() - daysBack);
            }

            defaultTournamentDay = tournamentDate.toISOString().split('T')[0];
        }

        const tournamentDay = searchParams.get('tournament_day') || defaultTournamentDay;


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

        // Dynamic prize pool calculation based on WLD AMOUNT COLLECTED (as planned)
        let prizePoolPercentage: number;
        let adminFeePercentage: number;
        let protectionLevel: string;
        let protectionLevelNumber: number;

        if (totalRevenue >= 72) {
            prizePoolPercentage = 70;
            adminFeePercentage = 30;
            protectionLevel = 'normal';
            protectionLevelNumber = 1;
        } else if (totalRevenue >= 30) {
            prizePoolPercentage = 85;
            adminFeePercentage = 15;
            protectionLevel = 'protection';
            protectionLevelNumber = 2;
        } else {
            prizePoolPercentage = 95;
            adminFeePercentage = 5;
            protectionLevel = 'maximum_protection';
            protectionLevelNumber = 3;
        }

        const prizePoolAmount = totalRevenue * (prizePoolPercentage / 100);
        const adminFeeAmount = totalRevenue * (adminFeePercentage / 100);

        // Update tournaments table with calculated values (NEW)
        const { error: updateError } = await supabase
            .from('tournaments')
            .update({
                total_players: stats.total_players,
                total_collected: totalRevenue,
                total_prize_pool: prizePoolAmount,
                admin_fee: adminFeeAmount,
                protection_level: protectionLevelNumber
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
                amount: prizePoolAmount,
                percentage: prizePoolPercentage
            },
            admin_fee: {
                amount: adminFeeAmount,
                percentage: adminFeePercentage
            },
            protection_level: protectionLevel,
            protection_level_number: protectionLevelNumber
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