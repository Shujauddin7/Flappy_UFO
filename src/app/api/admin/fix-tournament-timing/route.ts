import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    console.log('🔧 Fix tournament timing called');

    try {
        // Environment-specific database configuration
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({
                error: `Missing ${isProduction ? 'production' : 'development'} database credentials`
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get the current active tournament
        const { data: tournament, error: fetchError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('is_active', true)
            .single();

        if (fetchError || !tournament) {
            return NextResponse.json({
                error: 'No active tournament found',
                details: fetchError?.message
            }, { status: 404 });
        }

        console.log('📅 Current tournament:', {
            id: tournament.id,
            tournament_day: tournament.tournament_day,
            current_start_time: tournament.start_time,
            current_end_time: tournament.end_time
        });

        // Calculate correct start and end times based on tournament_day
        const tournamentDate = new Date(tournament.tournament_day + 'T00:00:00.000Z');
        
        const correctStartTime = new Date(tournamentDate);
        correctStartTime.setUTCHours(15, 30, 0, 0); // 15:30 UTC on tournament day

        const correctEndTime = new Date(correctStartTime);
        correctEndTime.setUTCDate(correctEndTime.getUTCDate() + 7); // 7 days later
        correctEndTime.setUTCHours(15, 30, 0, 0);

        console.log('🔧 Fixing tournament times:', {
            tournament_day: tournament.tournament_day,
            new_start_time: correctStartTime.toISOString(),
            new_end_time: correctEndTime.toISOString()
        });

        // Update the tournament with correct times
        const { data: updatedTournament, error: updateError } = await supabase
            .from('tournaments')
            .update({
                start_time: correctStartTime.toISOString(),
                end_time: correctEndTime.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', tournament.id)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Error updating tournament:', updateError);
            return NextResponse.json({
                error: 'Failed to update tournament timing',
                details: updateError.message
            }, { status: 500 });
        }

        console.log('✅ Tournament timing fixed successfully');

        return NextResponse.json({
            success: true,
            message: 'Tournament timing fixed successfully',
            tournament: {
                id: updatedTournament.id,
                tournament_day: updatedTournament.tournament_day,
                old_start_time: tournament.start_time,
                new_start_time: updatedTournament.start_time,
                old_end_time: tournament.end_time,
                new_end_time: updatedTournament.end_time,
                is_active: updatedTournament.is_active
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Fix tournament timing error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}