import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tournamentId = searchParams.get('tournament_id');

        if (!tournamentId) {
            return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 });
        }

        console.log('🔍 Fetching paid winners for tournament:', tournamentId);

        // Get all paid winners from prizes table for this tournament
        const { data: paidWinners, error } = await supabase
            .from('prizes')
            .select('wallet, final_rank, transaction_hash, sent_at')
            .eq('tournament_id', tournamentId)
            .order('final_rank', { ascending: true });

        console.log('📊 Paid winners query result:', { paidWinners, error });

        if (error) {
            console.error('Error fetching paid winners:', error);
            return NextResponse.json({
                error: 'Failed to fetch paid winners',
                details: error.message
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            winners: paidWinners || []
        });

    } catch (error) {
        console.error('Error in paid winners API:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
