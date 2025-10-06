import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    console.log('🔍 Previous Tournament API called');

    try {
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

        const supabaseUrl = isProduction
            ? process.env.SUPABASE_PROD_URL
            : process.env.SUPABASE_DEV_URL;

        const supabaseServiceKey = isProduction
            ? process.env.SUPABASE_PROD_SERVICE_KEY
            : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({
                error: 'Server configuration error'
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get the most recent INACTIVE tournament (the one that just ended)
        const { data: tournaments, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('is_active', false)
            .order('tournament_day', { ascending: false })
            .limit(1);

        if (tournamentError) {
            console.error('❌ Previous tournament fetch error:', tournamentError);
            return NextResponse.json({
                error: 'Failed to fetch previous tournament',
                details: tournamentError.message
            }, { status: 500 });
        }

        if (!tournaments || tournaments.length === 0) {
            return NextResponse.json({
                error: 'No previous tournament found',
                message: 'This might be the first tournament, or all tournaments are still active'
            }, { status: 404 });
        }

        const tournament = tournaments[0];

        console.log('✅ Previous tournament found:', {
            tournament_id: tournament.id,
            tournament_day: tournament.tournament_day,
            total_collected: tournament.total_collected
        });

        return NextResponse.json({
            tournament,
            fetched_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Previous tournament API error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
