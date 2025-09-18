import { NextResponse } from 'next/server';
import { setCached } from '@/lib/redis';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
    try {
        console.log('🔥 PROFESSIONAL CACHE WARMING STARTED...');
        console.log('🎮 Pre-loading all data for instant gaming performance');

        const startTime = Date.now();

        // Warm all critical caches in parallel for maximum speed
        const results = await Promise.allSettled([
            warmLeaderboardCache(),
            warmPrizePoolCache(),
            warmTournamentCache()
        ]);

        const totalTime = Date.now() - startTime;

        // Check results
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected');

        if (failed.length > 0) {
            console.error('❌ Some cache warming operations failed:');
            failed.forEach((failure, index) => {
                console.error(`   ${index + 1}. ${failure.reason}`);
            });
        }

        console.log(`✅ CACHE WARMING COMPLETE: ${successful}/3 operations successful in ${totalTime}ms`);
        console.log('🚀 Ready for INSTANT loads like Candy Crush/PUBG!');

        return NextResponse.json({
            success: true,
            message: 'Professional cache warming complete',
            operations: {
                successful,
                failed: failed.length,
                total: 3
            },
            performance: {
                total_time_ms: totalTime,
                average_per_operation_ms: Math.round(totalTime / 3)
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Cache warming system error:', error);
        return NextResponse.json({
            success: false,
            error: 'Cache warming system failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

async function warmLeaderboardCache() {
    console.log('🏆 Warming leaderboard cache...');
    const supabase = getSupabaseClient();

    // Get current tournament
    const { data: tournaments } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!tournaments || tournaments.length === 0) {
        const emptyData = {
            players: [],
            tournament_day: null,
            total_players: 0,
            cached: false,
            fetched_at: new Date().toISOString()
        };
        await setCached('tournament:leaderboard:current', emptyData, 15);
        console.log('🏆 Leaderboard cache warmed: No active tournament');
        return;
    }

    const tournament = tournaments[0];

    // Fetch leaderboard data using the same query as the actual API
    const { data: players } = await supabase
        .from('user_tournament_records')
        .select('user_id, username, wallet, highest_score, tournament_day')
        .eq('tournament_day', tournament.tournament_day)
        .gt('highest_score', 0)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true')
        .order('highest_score', { ascending: false })
        .limit(1000);

    const playersWithRank = (players || []).map((player, index) => ({
        id: player.user_id,
        user_id: player.user_id,
        username: player.username,
        wallet: player.wallet,
        highest_score: player.highest_score,
        tournament_day: player.tournament_day,
        rank: index + 1,
        created_at: new Date().toISOString()
    }));

    const leaderboardData = {
        players: playersWithRank,
        tournament_day: tournament.tournament_day,
        total_players: playersWithRank.length,
        cached: false,
        fetched_at: new Date().toISOString()
    };

    await setCached('tournament:leaderboard:current', leaderboardData, 15);
    console.log(`🏆 Leaderboard cache warmed: ${playersWithRank.length} players ready`);
}

async function warmPrizePoolCache() {
    console.log('💰 Warming prize pool cache...');
    const supabase = getSupabaseClient();

    // Get current tournament
    const { data: tournaments } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_active', true)
        .limit(1);

    if (!tournaments || tournaments.length === 0) {
        console.log('💰 Prize pool cache: No active tournament');
        return;
    }

    const tournament = tournaments[0];

    // Calculate prize pool using the same logic as the actual API
    const { data: records } = await supabase
        .from('user_tournament_records')
        .select(`
            verified_paid_amount,
            standard_paid_amount,
            total_continue_payments
        `)
        .eq('tournament_day', tournament.tournament_day)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true');

    let totalRevenue = 0;

    if (records) {
        for (const record of records) {
            totalRevenue += record.verified_paid_amount || 0;
            totalRevenue += record.standard_paid_amount || 0;
            totalRevenue += record.total_continue_payments || 0;
        }
    }

    const prizePoolAmount = totalRevenue * 0.7; // 70% to prize pool
    const adminFee = totalRevenue * 0.3; // 30% admin fee

    const prizeData = {
        success: true,
        tournament_day: tournament.tournament_day,
        total_revenue: totalRevenue,
        prize_pool: {
            percentage: 70,
            base_amount: prizePoolAmount,
            user_facing_amount: prizePoolAmount,
            guarantee_amount: 0,
            final_amount: prizePoolAmount
        },
        admin_fee: {
            percentage: 30,
            amount: adminFee,
            guarantee_cost: 0,
            net_result: adminFee
        },
        total_players: records?.length || 0,
        cached: false,
        fetched_at: new Date().toISOString()
    };

    await setCached('tournament:prizes:current', prizeData, 30);
    console.log(`💰 Prize pool cache warmed: ${prizePoolAmount} WLD pool ready`);
}

async function warmTournamentCache() {
    console.log('🎯 Warming tournament cache...');
    const supabase = getSupabaseClient();

    const { data: tournaments } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!tournaments || tournaments.length === 0) {
        console.log('🎯 Tournament cache: No active tournament');
        return;
    }

    const tournament = tournaments[0];

    // Calculate tournament status
    const startTime = new Date(tournament.start_time);
    const endTime = new Date(tournament.end_time);
    const currentTime = new Date();

    const hasNotStarted = currentTime < startTime;
    const hasEnded = currentTime >= endTime;
    const isActive = currentTime >= startTime && currentTime < endTime;
    const gracePeriodStart = new Date(endTime.getTime() - 30 * 60 * 1000);
    const isGracePeriod = currentTime >= gracePeriodStart && currentTime < endTime;

    const tournamentStatus = {
        is_active: isActive,
        has_ended: hasEnded,
        has_not_started: hasNotStarted,
        is_grace_period: isGracePeriod,
        current_utc: currentTime.toISOString(),
        start_time: tournament.start_time,
        end_time: tournament.end_time,
        tournament_day: tournament.tournament_day,
        entries_allowed: isActive
    };

    const tournamentData = {
        tournament,
        status: tournamentStatus,
        cached: false,
        real_time: true,
        fetched_at: new Date().toISOString()
    };

    await setCached('tournament:current', tournamentData, 60);
    console.log(`🎯 Tournament cache warmed: ${tournament.tournament_day} ready`);
}

function getSupabaseClient() {
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
    const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
    const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error(`Missing ${isProduction ? 'production' : 'development'} database credentials`);
    }

    return createClient(supabaseUrl, supabaseServiceKey);
}