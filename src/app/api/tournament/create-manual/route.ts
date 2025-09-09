import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Create a manual tournament for immediate use
 * Safe to use - won't conflict with automatic tournament creation
 */
export async function POST() {
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

        // Calculate tournament day using same logic as cron job (15:30 UTC boundary)
        const now = new Date();
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();

        const tournamentDate = new Date(now);
        if (utcHour < 15 || (utcHour === 15 && utcMinute < 30)) {
            tournamentDate.setUTCDate(tournamentDate.getUTCDate() - 1);
        }

        const tournamentDay = tournamentDate.toISOString().split('T')[0];        // Check if tournament already exists (same logic as cron job)
        const { data: existingTournament } = await supabase
            .from('tournaments')
            .select('*')
            .eq('tournament_day', tournamentDay)
            .single();

        if (existingTournament) {
            // Reactivate existing tournament
            const { data: reactivated, error: updateError } = await supabase
                .from('tournaments')
                .update({ is_active: true })
                .eq('id', existingTournament.id)
                .select()
                .single();

            if (updateError) {
                console.error('❌ Error reactivating tournament:', updateError);
                return NextResponse.json({ error: 'Failed to reactivate tournament' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: 'Tournament reactivated successfully',
                tournament: reactivated,
                action: 'reactivated'
            });
        }

        // Create new tournament (same logic as cron job)
        // Deactivate any active tournaments first
        await supabase
            .from('tournaments')
            .update({ is_active: false })
            .eq('is_active', true);

        // Set tournament times
        const tournamentStartTime = new Date();
        tournamentStartTime.setUTCHours(15, 30, 0, 0);

        const tournamentEndTime = new Date(tournamentStartTime);
        tournamentEndTime.setUTCDate(tournamentEndTime.getUTCDate() + 7); // 7 days for weekly tournament
        tournamentEndTime.setUTCHours(15, 30, 0, 0); // Next Sunday 15:30 UTC

        // Reset ALL users' verification status (as per Plan.md - verification resets weekly)
        console.log('🔄 Resetting user verification status...');
        const { error: resetVerificationError } = await supabase
            .from('users')
            .update({ last_verified_date: null })
            .neq('id', 'never_match'); // Update all users

        if (resetVerificationError) {
            console.error('❌ Error resetting user verification:', resetVerificationError);
            console.log('⚠️ Continuing despite verification reset error...');
        }

        // Create the tournament
        const { data: newTournament, error: createError } = await supabase
            .from('tournaments')
            .insert([{
                tournament_day: tournamentDay,
                start_time: tournamentStartTime.toISOString(),
                end_time: tournamentEndTime.toISOString(),
                is_active: true,
                total_players: 0,
                total_prize_pool: 0,
                total_collected: 0.0,
                admin_fee: 0.0,
                guarantee_amount: 0.0,
                admin_net_result: 0.0
            }])
            .select()
            .single();

        if (createError) {
            console.error('❌ Error creating tournament:', createError);
            return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Manual tournament created successfully',
            tournament: newTournament,
            action: 'created'
        });

    } catch (error) {
        console.error('❌ Error in manual tournament creation:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
