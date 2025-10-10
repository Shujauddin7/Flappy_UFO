import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET() {
    try {
        const supabase = createServerSupabaseClient();

        // Check tournament_sign_ins table
        const { data: signIns, error: signInsError } = await supabase
            .from('tournament_sign_ins')
            .select('*');

        if (signInsError) {
            console.error('❌ Error querying tournament_sign_ins:', signInsError);
        }

        // Check users table for current tournament day
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('*')
            .eq('tournament_day', '2025-09-14');

        if (usersError) {
            console.error('❌ Error querying users:', usersError);
        }

        // Check current tournament
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('tournament_day', '2025-09-14')
            .single();

        if (tournamentError) {
            console.error('❌ Error querying tournament:', tournamentError);
        }

        return NextResponse.json({
            success: true,
            debug_data: {
                tournament_sign_ins_count: signIns?.length || 0,
                tournament_sign_ins: signIns || [],
                users_for_current_tournament_count: users?.length || 0,
                users_for_current_tournament: users || [],
                current_tournament: tournament,
                expected_tournament_day: '2025-09-14'
            }
        });

    } catch (error) {
        console.error('❌ Debug API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Debug API error'
        }, { status: 500 });
    }
}