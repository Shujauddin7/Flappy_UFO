import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCached, setCached, shouldWarmCache } from '@/lib/redis';

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    console.log('💰 Dynamic Prize Pool Calculation API called');

    try {
        const searchParams = req.nextUrl.searchParams;
        let tournamentDay = searchParams.get('tournament_day');

        // 🚀 STEP 1: Check Redis cache first (15-second cache for instant prize updates)
        let cacheKey: string;
        if (tournamentDay) {
            cacheKey = `tournament:prizes:${tournamentDay}`;
        } else {
            cacheKey = 'tournament:prizes:current';
        }

        console.log('🔑 Cache key:', cacheKey);
        const cachedData = await getCached(cacheKey);
        console.log('📦 Redis cache result:', cachedData ? 'HIT' : 'MISS');

        if (cachedData) {
            const responseTime = Date.now() - startTime;
            console.log('⚡ Prize Pool Cache Status: 🟢 CACHE HIT');
            console.log(`🚀 Response time: ${responseTime}ms (Redis cache)`);

            // 🔥 PROFESSIONAL GAMING TRICK: Background cache warming for instant loads
            if (shouldWarmCache(cachedData, 30)) {
                console.log('🔄 Prize pool cache aging - triggering background refresh...');
                // Don't wait - warm in background
                fetch('/api/admin/warm-cache', { method: 'POST' })
                    .catch(err => console.log('Background warming failed (non-critical):', err));
            }

            return NextResponse.json({
                ...cachedData,
                cached: true,
                cached_at: new Date().toISOString()
            });
        }

        console.log('📊 Prize Pool Cache Status: 🔴 DATABASE QUERY');

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

        // Count total players for guarantee calculation
        const totalPlayers = tournamentRecords.length;

        // New guarantee system (simple 70/30 split + 1 WLD per top 10 winner when revenue < 72 WLD)
        const adminFeePercentage = 30;
        const prizePoolPercentage = 70;

        const adminFee = totalRevenue * (adminFeePercentage / 100);
        const basePrizePool = totalRevenue * (prizePoolPercentage / 100);

        // Calculate how many top 10 winners will exist (max 10, but could be fewer if fewer players)
        const top10Winners = Math.min(totalPlayers, 10);

        // Add guarantee if needed (1 WLD per top 10 winner when revenue < 72 WLD) - ADMIN ONLY, not user-facing
        const guaranteeAmount = totalRevenue < 72 ? top10Winners * 1.0 : 0;
        const finalPrizePool = basePrizePool + guaranteeAmount;
        const adminNetResult = adminFee - guaranteeAmount;

        // Prize distribution for USERS (based on actual collected only, no guarantee shown)
        const userFacingPrizePool = basePrizePool; // Users see only 70% of collected, not guarantee
        const userPrizeDistribution = [
            { rank: 1, percentage: 40, amount: userFacingPrizePool * 0.40 },
            { rank: 2, percentage: 22, amount: userFacingPrizePool * 0.22 },
            { rank: 3, percentage: 14, amount: userFacingPrizePool * 0.14 },
            { rank: 4, percentage: 6, amount: userFacingPrizePool * 0.06 },
            { rank: 5, percentage: 5, amount: userFacingPrizePool * 0.05 },
            { rank: 6, percentage: 4, amount: userFacingPrizePool * 0.04 },
            { rank: 7, percentage: 3, amount: userFacingPrizePool * 0.03 },
            { rank: 8, percentage: 2, amount: userFacingPrizePool * 0.02 },
            { rank: 9, percentage: 2, amount: userFacingPrizePool * 0.02 },
            { rank: 10, percentage: 2, amount: userFacingPrizePool * 0.02 }
        ];

        // Actual payout amounts (with guarantee applied) - used for admin/payout calculations
        const guaranteeBonusPerWinner = totalRevenue < 72 ? 1.0 : 0;
        const actualPayoutDistribution = [
            { rank: 1, percentage: 40, amount: (userFacingPrizePool * 0.40) + guaranteeBonusPerWinner },
            { rank: 2, percentage: 22, amount: (userFacingPrizePool * 0.22) + guaranteeBonusPerWinner },
            { rank: 3, percentage: 14, amount: (userFacingPrizePool * 0.14) + guaranteeBonusPerWinner },
            { rank: 4, percentage: 6, amount: (userFacingPrizePool * 0.06) + guaranteeBonusPerWinner },
            { rank: 5, percentage: 5, amount: (userFacingPrizePool * 0.05) + guaranteeBonusPerWinner },
            { rank: 6, percentage: 4, amount: (userFacingPrizePool * 0.04) + guaranteeBonusPerWinner },
            { rank: 7, percentage: 3, amount: (userFacingPrizePool * 0.03) + guaranteeBonusPerWinner },
            { rank: 8, percentage: 2, amount: (userFacingPrizePool * 0.02) + guaranteeBonusPerWinner },
            { rank: 9, percentage: 2, amount: (userFacingPrizePool * 0.02) + guaranteeBonusPerWinner },
            { rank: 10, percentage: 2, amount: (userFacingPrizePool * 0.02) + guaranteeBonusPerWinner }
        ];

        console.log(`💰 Prize calculation: ${totalRevenue} WLD → ${prizePoolPercentage}% pool + ${guaranteeAmount} WLD guarantee`);

        const responseData = {
            success: true,
            tournament_day: tournamentDay,
            total_revenue: totalRevenue,
            prize_pool: {
                percentage: prizePoolPercentage,
                base_amount: basePrizePool,
                user_facing_amount: userFacingPrizePool, // What users see (no guarantee)
                guarantee_amount: guaranteeAmount,
                final_amount: finalPrizePool // What admin actually pays (with guarantee)
            },
            admin_fee: {
                percentage: adminFeePercentage,
                amount: adminFee,
                guarantee_cost: guaranteeAmount,
                net_result: adminNetResult
            },
            guarantee_applied: guaranteeAmount > 0,
            prize_distribution: userPrizeDistribution, // User-facing prizes (no guarantee shown)
            admin_payout_distribution: actualPayoutDistribution, // Actual payout amounts
            total_players: tournamentRecords.length,
            cached: false,
            fetched_at: new Date().toISOString()
        };

        // 💾 STEP 3: Cache the prize data for 15 seconds (ultra-fast updates)
        console.log('💾 Caching prize pool data for 15 seconds...');
        await setCached(cacheKey, responseData, 15);
        console.log('✅ Prize pool data cached successfully');

        const responseTime = Date.now() - startTime;
        console.log(`🚀 Total response time: ${responseTime}ms (Database + Redis cache)`);

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('💥 Error in dynamic prize pool calculation:', error);
        return NextResponse.json({
            error: 'Internal server error in prize calculation'
        }, { status: 500 });
    }
}
