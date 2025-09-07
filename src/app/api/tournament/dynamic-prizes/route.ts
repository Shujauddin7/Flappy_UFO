import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    console.log('💰 Dynamic Prize Pool Calculation API called');

    try {
        const searchParams = req.nextUrl.searchParams;
        const tournamentDay = searchParams.get('tournament_day');

        if (!tournamentDay) {
            return NextResponse.json({
                error: 'tournament_day parameter is required'
            }, { status: 400 });
        }

        // Same environment configuration as your existing APIs
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({
                error: `Server configuration error: Missing ${isProduction ? 'production' : 'development'} database credentials`
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Calculate total revenue for the tournament using your existing database structure
        const { data: tournamentRecords, error: revenueError } = await supabase
            .from('user_tournament_records')
            .select(`
                verified_paid_amount,
                standard_paid_amount,
                total_continue_payments
            `)
            .eq('tournament_day', tournamentDay);

        if (revenueError) {
            console.error('❌ Error fetching tournament revenue:', revenueError);
            return NextResponse.json({
                error: 'Failed to calculate tournament revenue'
            }, { status: 500 });
        }

        // Calculate total WLD collected
        const totalRevenue = tournamentRecords.reduce((sum, record) => {
            const verifiedAmount = parseFloat(record.verified_paid_amount || '0');
            const standardAmount = parseFloat(record.standard_paid_amount || '0');
            const continueAmount = parseFloat(record.total_continue_payments || '0');
            return sum + verifiedAmount + standardAmount + continueAmount;
        }, 0);

        // Dynamic prize pool logic (from newprize.md)
        let prizePoolPercentage: number;
        let adminFeePercentage: number;
        let protectionLevel: string;

        if (totalRevenue >= 72) {
            prizePoolPercentage = 70;
            adminFeePercentage = 30;
            protectionLevel = 'normal';
        } else if (totalRevenue >= 30) {
            prizePoolPercentage = 85;
            adminFeePercentage = 15;
            protectionLevel = 'protection';
        } else {
            prizePoolPercentage = 95;
            adminFeePercentage = 5;
            protectionLevel = 'maximum_protection';
        }

        const prizePoolAmount = totalRevenue * (prizePoolPercentage / 100);
        const adminFeeAmount = totalRevenue * (adminFeePercentage / 100);

        // Prize distribution percentages (same as Plan.md)
        const prizeDistribution = [
            { rank: 1, percentage: 40, amount: prizePoolAmount * 0.40 },
            { rank: 2, percentage: 22, amount: prizePoolAmount * 0.22 },
            { rank: 3, percentage: 14, amount: prizePoolAmount * 0.14 },
            { rank: 4, percentage: 6, amount: prizePoolAmount * 0.06 },
            { rank: 5, percentage: 5, amount: prizePoolAmount * 0.05 },
            { rank: 6, percentage: 4, amount: prizePoolAmount * 0.04 },
            { rank: 7, percentage: 3, amount: prizePoolAmount * 0.03 },
            { rank: 8, percentage: 2, amount: prizePoolAmount * 0.02 },
            { rank: 9, percentage: 2, amount: prizePoolAmount * 0.02 },
            { rank: 10, percentage: 2, amount: prizePoolAmount * 0.02 }
        ];

        console.log(`💰 Prize calculation: ${totalRevenue} WLD → ${prizePoolPercentage}% pool (${protectionLevel})`);

        return NextResponse.json({
            success: true,
            tournament_day: tournamentDay,
            total_revenue: totalRevenue,
            prize_pool: {
                percentage: prizePoolPercentage,
                amount: prizePoolAmount
            },
            admin_fee: {
                percentage: adminFeePercentage,
                amount: adminFeeAmount
            },
            protection_level: protectionLevel,
            prize_distribution: prizeDistribution,
            total_players: tournamentRecords.length
        });

    } catch (error) {
        console.error('💥 Error in dynamic prize pool calculation:', error);
        return NextResponse.json({
            error: 'Internal server error in prize calculation'
        }, { status: 500 });
    }
}
