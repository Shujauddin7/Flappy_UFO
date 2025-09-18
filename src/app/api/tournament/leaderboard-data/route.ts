import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCached, setCached } from '@/lib/redis';

export async function GET() {
    const startTime = Date.now();
    try {
        // 🚀 STEP 1: Check Redis cache first (3-second cache)
        console.log('🔍 Leaderboard API: Starting request...');
        console.log('🌍 Environment:', process.env.NEXT_PUBLIC_ENV);

        const cacheKey = 'tournament:leaderboard:current';
        console.log('🔑 Cache key:', cacheKey);

        const cachedData = await getCached(cacheKey);
        console.log('📦 Redis cache result:', cachedData ? 'HIT' : 'MISS');

        if (cachedData) {
            const responseTime = Date.now() - startTime;
            console.log('⚡ Leaderboard Cache Status: 🟢 CACHE HIT');
            console.log(`⏱️  Response includes cached flag: true`);
            console.log(`🚀 Response time: ${responseTime}ms (Redis cache)`);

            // Return cached data instantly (5ms response from Mumbai Redis)
            return NextResponse.json({
                ...cachedData,
                cached: true, // For debugging - shows when data came from cache
                cached_at: new Date().toISOString()
            });
        }

        console.log('📊 Leaderboard Cache Status: 🔴 DATABASE QUERY');

        // 🗄️ STEP 2: If no cache, fetch from database (your existing logic)
        // Environment-specific database configuration
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Missing database credentials:');
            console.error('- URL:', supabaseUrl ? 'Present' : 'MISSING');
            console.error('- Service Key:', supabaseServiceKey ? 'Present' : 'MISSING');

            return NextResponse.json({
                error: 'Server configuration error: Missing development database credentials'
            }, { status: 500 });
        }

        console.log('✅ Database credentials found, connecting to Supabase...');

        // Initialize Supabase client with service role key for full permissions
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get current active tournament first to use its tournament_day
        const { data: tournaments, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);

        if (tournamentError) {
            console.error('Error fetching active tournament:', tournamentError);
            return NextResponse.json({
                error: 'Failed to fetch current tournament'
            }, { status: 500 });
        }

        if (!tournaments || tournaments.length === 0) {
            return NextResponse.json({
                error: 'No active tournament found',
                players: [],
                tournament_day: null
            });
        }

        const currentTournament = tournaments[0];
        const tournamentDay = currentTournament.tournament_day;

        console.log(`🔍 Querying leaderboard for tournament: ${tournamentDay}`);
        const queryStartTime = Date.now();

        // 🚀 OPTIMIZED: Only select the columns we actually need for the leaderboard
        // This reduces data transfer and improves query performance significantly
        const { data: players, error } = await supabase
            .from('user_tournament_records')
            .select('user_id, username, wallet, highest_score, tournament_day')
            .eq('tournament_day', tournamentDay)
            .gt('highest_score', 0) // Only show users who have submitted scores
            .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true') // Only paid entries
            .order('highest_score', { ascending: false })
            .limit(1000); // Reasonable limit to prevent massive queries

        const queryTime = Date.now() - queryStartTime;
        console.log(`⚡ Database query completed in ${queryTime}ms for ${players?.length || 0} players`);

        if (error) {
            console.error('Error fetching leaderboard:', error);
            return NextResponse.json({
                error: 'Failed to fetch leaderboard data'
            }, { status: 500 });
        }

        if (!players || players.length === 0) {
            const emptyResponse = {
                players: [],
                tournament_day: tournamentDay,
                total_players: 0,
                cached: false,
                fetched_at: new Date().toISOString()
            };

            // Cache empty result for 180 seconds to avoid repeated queries
            await setCached(cacheKey, emptyResponse, 180);
            return NextResponse.json(emptyResponse);
        }

        // Add rank to each player (much faster without database-side ranking)
        const playersWithRank = players.map((player, index) => ({
            id: player.user_id, // Use user_id as id for compatibility
            user_id: player.user_id,
            username: player.username,
            wallet: player.wallet,
            highest_score: player.highest_score,
            tournament_day: player.tournament_day,
            rank: index + 1,
            created_at: new Date().toISOString() // Add for compatibility
        }));

        const responseData = {
            players: playersWithRank,
            tournament_day: tournamentDay,
            total_players: playersWithRank.length,
            cached: false, // Fresh from database
            fetched_at: new Date().toISOString()
        };

        // 💾 STEP 3: Cache the fresh data for 180 seconds (3 minutes like other tournament data)
        console.log('💾 Caching leaderboard data for 180 seconds...');
        await setCached(cacheKey, responseData, 180);
        console.log('✅ Data cached successfully');

        const responseTime = Date.now() - startTime;
        console.log(`🚀 LEADERBOARD API PERFORMANCE SUMMARY:`);
        console.log(`   📊 Database query: ${queryTime}ms`);
        console.log(`   💾 Redis caching: ${responseTime - queryTime}ms`);
        console.log(`   🎯 Total response time: ${responseTime}ms`);
        console.log(`   👥 Players returned: ${playersWithRank.length}`);
        console.log(`   � Response cached: false (fresh data)`);

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('❌ Leaderboard data API error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
