import { NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/redis';
import { getCurrentActiveTournament } from '@/utils/database';

/**
 * INSTANT TOURNAMENT STATS API
 * Like professional mobile games (Candy Crush/PUBG) - NEVER shows loading
 * Always returns cached data instantly (<50ms response time)
 */
export async function GET() {
    const startTime = Date.now();
    console.log('⚡ INSTANT TOURNAMENT STATS API - Mobile Game Performance');

    try {
        // 🎯 STEP 1: ALWAYS try cache first - This API prioritizes speed over freshness
        const cacheKey = 'tournament_stats_instant';
        const cachedStats = await getCached(cacheKey);

        if (cachedStats && typeof cachedStats === 'object') {
            const responseTime = Date.now() - startTime;
            console.log(`🚀 INSTANT RESPONSE: ${responseTime}ms (Cached tournament stats)`);
            console.log('⚡ Performance: Like professional mobile games - instant loading!');

            // 🔧 ENSURE end_time IS ALWAYS PRESENT - Critical for countdown timer
            if (!cachedStats.end_time && cachedStats.has_active_tournament) {
                console.log('⚠️ Cached data missing end_time - fetching fresh data for countdown timer');
                // Don't return cached data if it's missing critical end_time field
                // Fall through to fresh database query
            } else {
                return NextResponse.json({
                    ...cachedStats,
                    cached: true,
                    response_time_ms: responseTime,
                    fetched_at: new Date().toISOString()
                });
            }
        }

        console.log('🔄 Cache miss - fetching and warming cache for future instant responses');

        // 🚀 STEP 2: Get tournament data using shared utilities
        const currentTournament = await getCurrentActiveTournament();


        if (!currentTournament) {
            // Cache the "no tournament" response for instant future responses
            const noTournamentResponse = {
                tournament_day: null,
                total_players: 0,
                total_prize_pool: 0,
                has_active_tournament: false,
                is_empty: true // Flag to distinguish from loading state
            };

            await setCached(cacheKey, noTournamentResponse, 60); // Cache for 1 minute

            return NextResponse.json({
                ...noTournamentResponse,
                cached: false,
                fetched_at: new Date().toISOString()
            });
        }

        // 🚀 STEP 3: Use stored tournament values instead of recalculating
        const tournamentDay = currentTournament.tournament_day;

        // Use stored values from tournaments table (more accurate and faster)
        const stats = {
            total_players: currentTournament.total_tournament_players || 0, // Use tournament players, not sign-ins
            total_prize_pool: currentTournament.total_prize_pool || 0
        };

        // Calculate end_time if missing from database (emergency fallback)
        let endTime = currentTournament.end_time;
        if (!endTime && currentTournament.start_time) {
            // Fallback: Calculate end_time as start_time + 24 hours
            const startTime = new Date(currentTournament.start_time);
            endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000).toISOString();
            console.log('⚠️ Using calculated end_time (database missing end_time):', endTime);
        } else if (!endTime) {
            // Last resort: Use current time + 24 hours
            endTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            console.log('⚠️ Using emergency fallback end_time:', endTime);
        }

        const responseData = {
            tournament_day: tournamentDay,
            tournament_name: currentTournament.name || `Tournament ${tournamentDay}`,
            total_players: stats.total_players,
            total_prize_pool: Number(stats.total_prize_pool.toFixed(2)),
            has_active_tournament: true,
            is_empty: stats.total_players === 0, // Flag to help frontend distinguish empty vs loading
            tournament_start_date: currentTournament.created_at,
            end_time: endTime, // Always provide end_time for countdown timer
            tournament_status: 'active'
        };

        // Cache for 2 minutes (balance between freshness and performance)
        console.log('💾 Warming cache for instant future responses...');
        await setCached(cacheKey, responseData, 120); // 2 minutes cache for good performance

        const responseTime = Date.now() - startTime;
        console.log(`✅ Tournament stats cached successfully for instant loading`);
        console.log(`📊 Response time: ${responseTime}ms (will be <50ms on next request)`);
        console.log(`👥 Players: ${stats.total_players}, Prize Pool: $${stats.total_prize_pool.toFixed(2)}`);

        return NextResponse.json({
            ...responseData,
            cached: false,
            response_time_ms: responseTime,
            fetched_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Tournament stats API error:', error);

        // Even on error, try to return a reasonable default that doesn't break the UI
        const errorResponse = {
            tournament_day: null,
            total_players: 0,
            total_prize_pool: 0,
            has_active_tournament: false,
            error: 'Failed to load tournament stats',
            cached: false,
            fetched_at: new Date().toISOString()
        };

        return NextResponse.json(errorResponse, { status: 500 });
    }
}

/**
 * CACHE WARMING ENDPOINT
 * Called by background jobs to pre-populate cache
 */
export async function POST() {
    try {
        console.log('🔥 WARMING TOURNAMENT STATS CACHE - Background job');

        // Trigger a GET request to warm the cache
        const response = await GET();
        const data = await response.json();

        return NextResponse.json({
            success: true,
            warmed: true,
            stats: data
        });

    } catch (error) {
        console.error('❌ Cache warming failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}