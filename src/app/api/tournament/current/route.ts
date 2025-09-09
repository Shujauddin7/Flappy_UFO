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

        // Calculate tournament status based on end time
        const endTime = new Date(tournament.end_time);
        const gracePeriodStart = new Date(endTime);
        gracePeriodStart.setUTCMinutes(gracePeriodStart.getUTCMinutes() - 30); // 30 minutes before end

        const isGracePeriod = now >= gracePeriodStart && now < endTime;

        const tournamentStatus = {
            is_grace_period: isGracePeriod,
            current_utc: now.toISOString(),
            tournament_day: tournament.tournament_day,
            entries_allowed: !isGracePeriod
        };

        console.log('✅ Tournament found:', {
            tournament_id: tournament.id,
            tournament_day: tournament.tournament_day,
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
