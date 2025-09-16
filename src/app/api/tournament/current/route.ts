import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCached, setCached } from '@/lib/redis';

export async function GET() {
    console.log('🔍 Current Tournament API called');
    console.log('🌍 Environment:', process.env.NEXT_PUBLIC_ENV);

    const requestStartTime = Date.now();

    try {
        // 🚀 STEP 1: Check Redis cache first (5-second cache for tournament info)
        const cacheKey = 'tournament:current';
        console.log('🔑 Cache key:', cacheKey);

        const cachedData = await getCached(cacheKey);
        console.log('📦 Redis cache result:', cachedData ? 'HIT' : 'MISS');

        if (cachedData) {
            const responseTime = Date.now() - requestStartTime;
            console.log('⚡ Tournament Cache Status: 🟢 CACHE HIT');
            console.log(`⏱️  Response includes cached flag: true`);
            console.log(`🚀 Response time: ${responseTime}ms (Redis cache)`);

            // Return cached tournament data instantly
            return NextResponse.json({
                ...cachedData,
                cached: true,
                cached_at: new Date().toISOString()
            });
        }

        console.log('📊 Tournament Cache Status: 🔴 DATABASE QUERY');

        // 🗄️ STEP 2: If no cache, fetch from database
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

        // Initialize Supabase client with service role key for full permissions
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const now = new Date();
        console.log('🗓️ Looking for active tournament at:', now.toISOString());

        // Fetch current active tournament (get the most recent one if multiple exist)
        const { data: tournaments, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1);

        if (tournamentError) {
            console.log('❌ Tournament fetch error:', tournamentError);
            return NextResponse.json({
                error: 'Failed to fetch tournament',
                details: tournamentError.message
            }, { status: 500 });
        }

        if (!tournaments || tournaments.length === 0) {
            return NextResponse.json({
                error: 'No active tournament found',
                debug_info: {
                    current_utc: now.toISOString(),
                    tournament_boundary: '15:30 UTC Sunday',
                    suggestion: 'Create tournament via create-manual API'
                }
            }, { status: 404 });
        }

        const tournament = tournaments[0]; // Get the most recent tournament

        // Calculate tournament status based on start and end times
        const startTime = new Date(tournament.start_time);
        const endTime = new Date(tournament.end_time);
        const currentTime = new Date();

        console.log('⏰ Time comparison debug:', {
            current_time: currentTime.toISOString(),
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            current_timestamp: currentTime.getTime(),
            start_timestamp: startTime.getTime(),
            end_timestamp: endTime.getTime()
        });

        // Simple boolean checks
        const hasNotStarted = currentTime < startTime;
        const hasEnded = currentTime >= endTime;
        const isActive = currentTime >= startTime && currentTime < endTime;

        // Grace period is the last 30 minutes of the tournament
        const gracePeriodStart = new Date(endTime.getTime() - 30 * 60 * 1000); // 30 minutes before end
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
            entries_allowed: isActive  // Simple: allow entries when tournament is active
        };

        console.log('✅ Tournament status calculated:', {
            tournament_id: tournament.id,
            tournament_day: tournament.tournament_day,
            has_not_started: hasNotStarted,
            is_active: isActive,
            has_ended: hasEnded,
            entries_allowed: tournamentStatus.entries_allowed,
            time_until_start_minutes: hasNotStarted ? Math.round((startTime.getTime() - currentTime.getTime()) / 60000) : 0,
            time_until_end_minutes: isActive ? Math.round((endTime.getTime() - currentTime.getTime()) / 60000) : 0
        });

        const responseData = {
            tournament,
            status: tournamentStatus,
            cached: false, // Fresh from database
            fetched_at: new Date().toISOString()
        };

        // 💾 STEP 3: Cache the tournament data for 5 seconds
        console.log('💾 Caching tournament data for 5 seconds...');
        await setCached(cacheKey, responseData, 5);
        console.log('✅ Tournament data cached successfully');

        const responseTime = Date.now() - requestStartTime;
        console.log(`🚀 Total response time: ${responseTime}ms (Database + Redis cache)`);
        console.log(`📊 Response includes cached flag: false`);

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('❌ Current tournament API error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
