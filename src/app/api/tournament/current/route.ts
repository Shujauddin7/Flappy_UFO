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

        // Calculate tournament day using same logic as weekly-cron
        const now = new Date();
        const utcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();

        // Tournament week starts at 15:30 UTC Sunday, so if it's before 15:30, use last week's Sunday
        const tournamentDate = new Date(now);
        if (utcHour < 15 || (utcHour === 15 && utcMinute < 30)) {
            tournamentDate.setUTCDate(tournamentDate.getUTCDate() - 1);
        }

        // Get the Sunday of this week for tournament_day
        const dayOfWeek = tournamentDate.getUTCDay(); // 0 = Sunday
        const daysToSubtract = dayOfWeek; // Days since last Sunday
        const tournamentSunday = new Date(tournamentDate);
        tournamentSunday.setUTCDate(tournamentDate.getUTCDate() - daysToSubtract);

        const tournamentDay = tournamentSunday.toISOString().split('T')[0];

        console.log('🗓️ Looking for weekly tournament:', {
            current_utc: now.toISOString(),
            tournament_day: tournamentDay,
            utc_day: utcDay,
            utc_hour: utcHour,
            utc_minute: utcMinute,
            tournament_sunday: tournamentSunday.toISOString()
        });

        // Fetch current tournament using proper tournament day logic
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('tournament_day', tournamentDay)
            .eq('is_active', true)
            .single();

        if (tournamentError) {
            console.log('❌ Tournament fetch error:', tournamentError);

            // If no tournament found, provide helpful debugging info
            if (tournamentError.code === 'PGRST116') {
                return NextResponse.json({
                    error: 'No active tournament found',
                    debug_info: {
                        looking_for_day: tournamentDay,
                        current_utc: now.toISOString(),
                        tournament_boundary: '15:30 UTC',
                        next_tournament_creation: 'Today at 15:30 UTC via cron job'
                    }
                }, { status: 404 });
            }

            return NextResponse.json({
                error: 'Failed to fetch tournament',
                details: tournamentError.message
            }, { status: 500 });
        }

        // Calculate tournament status based on Plan.md timing rules
        // Grace period: Sunday 15:00-15:30 UTC (weekly tournaments)
        const isGracePeriod = utcDay === 0 && utcHour === 15 && utcMinute >= 0 && utcMinute < 30;

        const tournamentStatus = {
            is_grace_period: isGracePeriod,
            current_utc: now.toISOString(),
            tournament_day: tournamentDay,
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
