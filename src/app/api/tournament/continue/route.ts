import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.walletAddress) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { continue_amount } = await req.json();
        if (!continue_amount) {
            return NextResponse.json({ error: 'Missing continue_amount' }, { status: 400 });
        }

        const isProduction = process.env.NODE_ENV === 'production';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const wallet = session.user.walletAddress;
        const today = new Date().toISOString().split('T')[0];

        // Get current values first, then increment

        // Update user_tournament_records
        const { data: currentRecord } = await supabase
            .from('user_tournament_records')
            .select('total_continues_used, total_continue_payments, user_id, tournament_id')
            .eq('wallet', wallet)
            .eq('tournament_day', today)
            .single();

        if (currentRecord) {
            // Update user tournament record
            await supabase
                .from('user_tournament_records')
                .update({
                    total_continues_used: currentRecord.total_continues_used + 1,
                    total_continue_payments: currentRecord.total_continue_payments + continue_amount
                })
                .eq('wallet', wallet)
                .eq('tournament_day', today);

            // Find and update most recent game score
            const { data: recentScore } = await supabase
                .from('game_scores')
                .select('id, continues_used_in_game, continue_payments_for_game')
                .eq('user_id', currentRecord.user_id)
                .eq('tournament_id', currentRecord.tournament_id)
                .order('submitted_at', { ascending: false })
                .limit(1)
                .single();

            if (recentScore) {
                await supabase
                    .from('game_scores')
                    .update({
                        continues_used_in_game: recentScore.continues_used_in_game + 1,
                        continue_payments_for_game: recentScore.continue_payments_for_game + continue_amount
                    })
                    .eq('id', recentScore.id);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('❌ Continue API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
