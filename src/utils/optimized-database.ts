import { createClient } from '@supabase/supabase-js';

/**
 * Optimized Database Query Fallbacks
 * High-performance queries that match Redis data structure for consistent performance
 */

// Get Supabase client with environment-specific configuration
function getSupabaseClient() {
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

    const supabaseUrl = isProduction
        ? process.env.SUPABASE_PROD_URL
        : process.env.SUPABASE_DEV_URL;

    const supabaseServiceKey = isProduction
        ? process.env.SUPABASE_PROD_SERVICE_KEY
        : process.env.SUPABASE_DEV_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error(`Missing ${isProduction ? 'production' : 'development'} database credentials`);
    }

    return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Optimized leaderboard query that matches Redis sorted set structure
 * Provides consistent performance when Redis is unavailable
 */
export async function getOptimizedLeaderboard(
    tournamentDay: string,
    offset: number = 0,
    limit: number = 20
) {
    const startTime = Date.now();
    console.log(`🔍 Optimized database leaderboard query: ${tournamentDay}, offset: ${offset}, limit: ${limit}`);

    try {
        const supabase = getSupabaseClient();

        // Optimized query that matches Redis data structure exactly
        const { data, error } = await supabase
            .from('user_tournament_records')
            .select(`
                user_id,
                username,
                wallet,
                highest_score,
                users!inner(username, wallet)
            `)
            .eq('tournament_day', tournamentDay)
            .gt('highest_score', 0) // Only users with scores (matches Redis)
            .order('highest_score', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('❌ Optimized leaderboard query error:', error);
            return null;
        }

        // Format data to match Redis structure exactly
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formattedPlayers = data?.map((record: any, index: number) => ({
            user_id: record.user_id,
            username: record.users?.username || record.username || null,
            wallet: record.users?.wallet || record.wallet,
            score: record.highest_score,
            highest_score: record.highest_score, // Compatibility
            rank: offset + index + 1
        })) || [];

        const queryTime = Date.now() - startTime;
        console.log(`✅ Optimized database query completed: ${formattedPlayers.length} players in ${queryTime}ms`);

        return formattedPlayers;

    } catch (error) {
        console.error('❌ Optimized leaderboard query failed:', error);
        return null;
    }
}

/**
 * Optimized tournament stats query with consistent data structure
 * Matches Redis cache format for seamless fallback
 */
export async function getOptimizedTournamentStats(tournamentDay: string) {
    const startTime = Date.now();
    console.log(`🔍 Optimized tournament stats query: ${tournamentDay}`);

    try {
        const supabase = getSupabaseClient();

        // Get tournament data with all required fields
        const { data, error } = await supabase
            .from('tournaments')
            .select(`
                id,
                tournament_day,
                total_tournament_players,
                total_prize_pool,
                total_collected,
                admin_fee,
                guarantee_amount,
                admin_net_result,
                start_time,
                end_time,
                is_active
            `)
            .eq('tournament_day', tournamentDay)
            .eq('is_active', true)
            .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no tournament exists

        if (error) {
            console.error('❌ Optimized tournament stats query error:', error);
            return null;
        }

        if (!data) {
            console.log('ℹ️ No active tournament found for:', tournamentDay);
            return null;
        }

        // Format to match Redis cache structure exactly
        const formattedStats = {
            tournament_day: data.tournament_day,
            tournament_name: `Tournament ${data.tournament_day}`,
            total_players: data.total_tournament_players || 0,
            total_prize_pool: Number((data.total_prize_pool || 0).toFixed(2)),
            has_active_tournament: data.is_active,
            is_empty: (data.total_tournament_players || 0) === 0,
            tournament_start_date: data.start_time,
            end_time: data.end_time,
            tournament_status: 'active',

            // Additional stats for admin/debugging (not sent to frontend)
            debug_stats: {
                total_collected: data.total_collected || 0,
                admin_fee: data.admin_fee || 0,
                guarantee_amount: data.guarantee_amount || 0,
                admin_net_result: data.admin_net_result || 0
            }
        };

        const queryTime = Date.now() - startTime;
        console.log(`✅ Optimized tournament stats query completed in ${queryTime}ms`);

        return formattedStats;

    } catch (error) {
        console.error('❌ Optimized tournament stats query failed:', error);
        return null;
    }
}

/**
 * Health check for database connection
 * Used to verify database is available before attempting queries
 */
export async function checkDatabaseHealth(): Promise<boolean> {
    try {
        const supabase = getSupabaseClient();

        // Simple query to test connection
        const { error } = await supabase
            .from('tournaments')
            .select('id')
            .limit(1);

        if (error) {
            console.error('❌ Database health check failed:', error);
            return false;
        }

        console.log('✅ Database health check passed');
        return true;

    } catch (error) {
        console.error('❌ Database health check error:', error);
        return false;
    }
}