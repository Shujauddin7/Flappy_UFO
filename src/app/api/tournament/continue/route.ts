import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        // Get session
        const session = await auth();
        if (!session?.user?.walletAddress) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { continue_amount } = await req.json();

        if (!continue_amount) {
            return NextResponse.json({ error: 'Missing continue_amount' }, { status: 400 });
        }

        // Environment-specific database credentials
        const isProduction = process.env.NODE_ENV === 'production';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const wallet = session.user.walletAddress;
        const today = new Date().toISOString().split('T')[0];

        // Get current values first
        const { data: currentRecord } = await supabase
            .from('user_tournament_records')
            .select('id, user_id, tournament_id, total_continues_used, total_continue_payments')
            .eq('wallet', wallet)
            .eq('tournament_day', today)
            .single();

        if (!currentRecord) {
            return NextResponse.json({ error: 'Tournament record not found' }, { status: 400 });
        }

        // Update user_tournament_records: increment continue counters
        const { error: userRecordError } = await supabase
            .from('user_tournament_records')
            .update({
                total_continues_used: currentRecord.total_continues_used + 1,
                total_continue_payments: currentRecord.total_continue_payments + continue_amount
            })
            .eq('wallet', wallet)
            .eq('tournament_day', today);

        if (userRecordError) {
            console.error('❌ User tournament record update error:', userRecordError);
            return NextResponse.json({ error: 'Failed to record continue in tournament record' }, { status: 500 });
        }

        // Update game_scores: find the most recent game score and update continue info
        const { data: recentGameScore } = await supabase
            .from('game_scores')
            .select('id, continues_used_in_game, continue_payments_for_game')
            .eq('user_id', currentRecord.user_id)
            .eq('tournament_id', currentRecord.tournament_id)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .single();

        if (recentGameScore) {
            const { error: gameScoreError } = await supabase
                .from('game_scores')
                .update({
                    continues_used_in_game: recentGameScore.continues_used_in_game + 1,
                    continue_payments_for_game: recentGameScore.continue_payments_for_game + continue_amount
                })
                .eq('id', recentGameScore.id);

            if (gameScoreError) {
                console.error('❌ Game score update error:', gameScoreError);
                // Don't fail the request - user tournament record was already updated
                console.warn('⚠️ Continue recorded in tournament record but failed to update game score');
            }
        } else {
            console.warn('⚠️ No recent game score found to update continue info');
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('❌ Continue API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}