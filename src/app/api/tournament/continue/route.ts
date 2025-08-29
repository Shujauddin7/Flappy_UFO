import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    console.log('🎮 Tournament continue API called');

    try {
        // Get session
        const session = await auth();
        if (!session?.user?.walletAddress) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { payment_reference, continue_amount, score } = await req.json();

        // Validate required fields
        if (!payment_reference || !continue_amount || score === undefined) {
            return NextResponse.json({
                error: 'Missing required fields'
            }, { status: 400 });
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

        console.log('📝 Continue request:', { wallet, continue_amount, score, today });

        // Step 1: Find active tournament for today
        const { data: tournament } = await supabase
            .from('tournaments')
            .select('id')
            .eq('tournament_day', today)
            .eq('is_active', true)
            .single();

        if (!tournament) {
            return NextResponse.json({ error: 'No active tournament found' }, { status: 400 });
        }

        // Step 2: Find user by wallet
        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', wallet)
            .single();

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 400 });
        }

        // Step 3: Find user's tournament record
        const { data: tournamentRecord } = await supabase
            .from('user_tournament_records')
            .select('id, total_continues_used, total_continue_payments, verified_entry_paid, standard_entry_paid')
            .eq('user_id', user.id)
            .eq('tournament_id', tournament.id)
            .single();

        console.log('🔍 Tournament record found:', {
            record_exists: !!tournamentRecord,
            verified_paid: tournamentRecord?.verified_entry_paid,
            standard_paid: tournamentRecord?.standard_entry_paid
        });

        if (!tournamentRecord) {
            return NextResponse.json({
                error: 'Tournament entry not found. Please enter the tournament first.'
            }, { status: 400 });
        }

        // Step 4: Check if user has paid for tournament entry
        const hasPaidEntry = tournamentRecord.verified_entry_paid || tournamentRecord.standard_entry_paid;

        if (!hasPaidEntry) {
            return NextResponse.json({
                error: 'No tournament entry payment found. Please enter the tournament first.'
            }, { status: 400 });
        }

        // Step 5: Update tournament record with continue payment (only continue-specific columns)
        const { error: updateError } = await supabase
            .from('user_tournament_records')
            .update({
                total_continues_used: tournamentRecord.total_continues_used + 1,
                total_continue_payments: tournamentRecord.total_continue_payments + continue_amount,
                updated_at: new Date().toISOString()
            })
            .eq('id', tournamentRecord.id);

        if (updateError) {
            console.error('❌ Update error:', updateError);
            return NextResponse.json({ error: 'Failed to record continue payment' }, { status: 500 });
        }

        // Step 6: Update the current game score record with continue info
        try {
            // Find the most recent game score for this user and tournament
            const { data: recentScore } = await supabase
                .from('game_scores')
                .select('id, continues_used_in_game, continue_payments_for_game')
                .eq('user_id', user.id)
                .eq('tournament_id', tournament.id)
                .order('submitted_at', { ascending: false })
                .limit(1)
                .single();

            if (recentScore) {
                // Update the most recent game score with continue info
                await supabase
                    .from('game_scores')
                    .update({
                        continues_used_in_game: recentScore.continues_used_in_game + 1,
                        continue_payments_for_game: recentScore.continue_payments_for_game + continue_amount
                    })
                    .eq('id', recentScore.id);

                console.log('✅ Game score continue info updated');
            }
        } catch (gameScoreError) {
            console.warn('⚠️ Failed to update game score continue info:', gameScoreError);
            // Don't fail the whole request - continue tracking is working in user_tournament_records
        }

        console.log('✅ Continue payment recorded successfully');

        return NextResponse.json({
            success: true,
            message: `Continue payment of ${continue_amount} WLD recorded successfully`
        });

    } catch (error) {
        console.error('❌ Continue API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}