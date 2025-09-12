import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    console.log('🔍 Current Tournament API called');

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

        // Initialize Supabase client with service role key for full permissions
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const now = new Date();
        console.log('🗓️ Looking for active tournament at:', now.toISOString());

        // Fetch current active tournament (simplified logic)
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('is_active', true)
            .single();

        if (tournamentError) {
            console.log('❌ Tournament fetch error:', tournamentError);
            return NextResponse.json({
                error: 'Failed to fetch tournament',
                details: tournamentError.message
            }, { status: 500 });
        }

        if (!tournament) {
            return NextResponse.json({
                error: 'No active tournament found',
                debug_info: {
                    current_utc: now.toISOString(),
                    tournament_boundary: '15:30 UTC Sunday',
                    suggestion: 'Create tournament via create-manual API'
                }
            }, { status: 404 });
        }

        // Calculate tournament status based on start and end times
        const startTime = new Date(tournament.start_time);
        const endTime = new Date(tournament.end_time);

        // Tournament is active between start_time and end_time
        const isActive = now >= startTime && now < endTime;
        const hasEnded = now >= endTime;
        const hasNotStarted = now < startTime;

        // Grace period is the last 30 minutes of the tournament
        const gracePeriodStart = new Date(endTime);
        gracePeriodStart.setUTCMinutes(gracePeriodStart.getUTCMinutes() - 30);
        const isGracePeriod = now >= gracePeriodStart && now < endTime;

        const tournamentStatus = {
            is_active: isActive,
            has_ended: hasEnded,
            has_not_started: hasNotStarted,
            is_grace_period: isGracePeriod,
            current_utc: now.toISOString(),
            start_time: tournament.start_time,
            end_time: tournament.end_time,
            tournament_day: tournament.tournament_day,
            entries_allowed: isActive && !isGracePeriod  // Allow entries when active but not in grace period
        };

        console.log('✅ Tournament found:', {
            tournament_id: tournament.id,
            tournament_day: tournament.tournament_day,
            start_time: tournament.start_time,
            end_time: tournament.end_time,
            current_time: now.toISOString(),
            is_active: isActive,
            has_ended: hasEnded,
            entries_allowed: tournamentStatus.entries_allowed,
            total_players: tournament.total_players,
            total_prize_pool: tournament.total_prize_pool,
            status: tournamentStatus
        });

        return NextResponse.json({
            tournament,
            status: tournamentStatus
        });

    } catch (error) {
        console.error('❌ Current tournament API error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
