import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const isProduction = process.env.NODE_ENV === 'production';
        const supabaseUrl = isProduction ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL_LOCAL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY_LOCAL;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({
                error: `Missing ${isProduction ? 'production' : 'development'} database credentials`
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get the tournament_day to activate from request body
        const body = await req.json();
        const targetTournamentDay = body.tournament_day || '2025-09-08'; // Default to the correct one

        console.log(`🔧 Admin Fix: Setting tournament ${targetTournamentDay} as active`);

        // Step 1: Deactivate ALL tournaments
        const { error: deactivateAllError } = await supabase
            .from('tournaments')
            .update({ is_active: false })
            .eq('is_active', true);

        if (deactivateAllError) {
            console.error('❌ Error deactivating all tournaments:', deactivateAllError);
            return NextResponse.json({ error: 'Failed to deactivate tournaments' }, { status: 500 });
        }

        // Step 2: Activate the target tournament
        const { data: activatedTournament, error: activateError } = await supabase
            .from('tournaments')
            .update({ is_active: true })
            .eq('tournament_day', targetTournamentDay)
            .select()
            .single();

        if (activateError) {
            console.error('❌ Error activating target tournament:', activateError);
            return NextResponse.json({ error: 'Failed to activate target tournament' }, { status: 500 });
        }

        // Step 3: Verify only one tournament is active
        const { data: activeTournaments, error: verifyError } = await supabase
            .from('tournaments')
            .select('tournament_day, is_active')
            .eq('is_active', true);

        if (verifyError) {
            console.error('❌ Error verifying active tournaments:', verifyError);
        }

        return NextResponse.json({
            success: true,
            message: `Tournament ${targetTournamentDay} is now active`,
            activated_tournament: activatedTournament,
            active_tournaments_count: activeTournaments?.length || 0,
            all_active: activeTournaments
        });

    } catch (error) {
        console.error('❌ Admin fix error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
