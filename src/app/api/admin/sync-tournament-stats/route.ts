import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
    try {
        // Get environment config
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({
                error: 'Missing database credentials'
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get active tournament
        const { data: tournament } = await supabase
            .from('tournaments')
            .select('id, tournament_day')
            .eq('is_active', true)
            .single();

        if (!tournament) {
            return NextResponse.json({
                error: 'No active tournament found'
            }, { status: 404 });
        }

        // Get user tournament records for this tournament
        const { data: userData, error: userError } = await supabase
            .from('user_tournament_records')
            .select('user_id, verified_paid_amount, standard_paid_amount')
            .eq('tournament_id', tournament.id);

        if (userError) {
            console.error('❌ Error fetching user records:', userError);
            return NextResponse.json({
                error: `Database error: ${userError.message}`
            }, { status: 500 });
        }

        const totalPlayers = userData?.length || 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalPrizePool = userData?.reduce((sum: number, record: any) =>
            sum + (record.verified_paid_amount || 0) + (record.standard_paid_amount || 0), 0
        ) * 0.7 || 0;

        // Update tournament table
        const { error: updateError } = await supabase
            .from('tournaments')
            .update({
                total_players: totalPlayers,
                total_prize_pool: totalPrizePool
            })
            .eq('id', tournament.id);

        if (updateError) {
            console.error('❌ Error updating tournament:', updateError);
            return NextResponse.json({
                error: `Update error: ${updateError.message}`
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            tournament_id: tournament.id,
            tournament_day: tournament.tournament_day,
            updated_stats: {
                total_players: totalPlayers,
                total_prize_pool: totalPrizePool
            }
        });

    } catch (error) {
        console.error('❌ Tournament sync error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
