import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/redis';
import { getCurrentActiveTournament } from '@/utils/database';
import { getLeaderboardData } from '@/utils/leaderboard-queries';

export async function GET() {
    const startTime = Date.now();
    console.log('🚀 LEADERBOARD DATA API START - Professional Gaming Performance');

    try {
        // 🎯 STEP 1: Try to get cached data first (like mobile games - instant loading)
        const cacheKey = 'tournament_leaderboard_data';
        const cachedData = await getCached(cacheKey);

        if (cachedData && typeof cachedData === 'object') {
            console.log('⚡ CACHE HIT - Returning cached leaderboard data instantly (professional mobile game style)');
            console.log('📊 Cache Performance: 0ms database query, instant response');

            return NextResponse.json({
                ...cachedData,
                cached: true,
                fetched_at: new Date().toISOString()
            });
        }

        console.log('📊 Cache Status: 🔴 CACHE MISS - Fetching fresh data from database');
        console.log('🗄️ Falling back to database query...');

        // 🗄️ STEP 2: Get current tournament using shared utility (eliminates duplicate code)
        const currentTournament = await getCurrentActiveTournament();

        if (!currentTournament) {
            return NextResponse.json({
                error: 'No active tournament found',
                players: [],
                tournament_day: null
            });
        }

        const tournamentDay = currentTournament.tournament_day;
        console.log(`🔍 Querying leaderboard for tournament: ${tournamentDay}`);

        // 🚀 OPTIMIZED DATABASE QUERY - Using shared query utilities
        const queryStartTime = Date.now();

        // Get leaderboard data using standardized query
        const players = await getLeaderboardData(tournamentDay, {
            limit: 1000, // Reasonable limit to prevent massive queries
            includeZeroScores: true // Show ALL players including those with score 0
        });

        const queryTime = Date.now() - queryStartTime;
        console.log(`⚡ Database query completed in ${queryTime}ms for ${players.length} players`);

        if (players.length === 0) {
            console.log('ℹ️ No players found with scores > 0 for tournament:', tournamentDay);
            return NextResponse.json({
                players: [],
                tournament_day: tournamentDay,
                total_players: 0,
                cached: false,
                fetched_at: new Date().toISOString()
            });
        }

        console.log(`🎯 Found ${players.length} players with scores > 0`);

        // Format players for compatibility with existing frontend code
        const playersWithRank = players.map((player) => ({
            ...player,
            user_id: player.user_id, // Ensure user_id is present
            created_at: new Date().toISOString() // Add for compatibility
        }));

        const responseData = {
            players: playersWithRank,
            tournament_day: tournamentDay,
            total_players: playersWithRank.length,
            cached: false, // Fresh from database
            fetched_at: new Date().toISOString()
        };

        // 💾 STEP 3: Cache the fresh data for 5 minutes (persistent like mobile games)
        console.log('💾 Caching leaderboard data for 5 minutes (persistent mobile game style)...');
        await setCached(cacheKey, responseData, 300); // 5 minutes instead of 15 seconds
        console.log('✅ Data cached successfully for persistent availability');

        const responseTime = Date.now() - startTime;
        console.log(`🚀 LEADERBOARD API PERFORMANCE SUMMARY:`);
        console.log(`   📊 Database query: ${queryTime}ms`);
        console.log(`   💾 Redis caching: ${responseTime - queryTime}ms`);
        console.log(`   🎯 Total response time: ${responseTime}ms`);
        console.log(`   👥 Players returned: ${playersWithRank.length}`);
        console.log(`   🔄 Response cached: false (fresh data)`);

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('❌ Leaderboard data API error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}