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

        // DEBUG INFO TO RETURN
        const debugInfo = {
            wallet,
            today,
            continue_amount,
            step0_get_user: {} as Record<string, unknown>,
            step0_get_tournament: {} as Record<string, unknown>,
            step0_ensure_record: {} as Record<string, unknown>,
            step1_lookup_record: {} as Record<string, unknown>,
            step2_update_record: {} as Record<string, unknown>,
            step3_lookup_score: {} as Record<string, unknown>,
            step4_update_score: {} as Record<string, unknown>
        };

        // Step 0: Get user and tournament info to create record if needed
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, username')
            .eq('wallet', wallet)
            .single();

        debugInfo.step0_get_user = { found: !!user, error: userError?.message };

        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('id')
            .eq('tournament_day', today)
            .eq('is_active', true)
            .single();

        debugInfo.step0_get_tournament = { found: !!tournament, error: tournamentError?.message };

        if (!user || !tournament) {
            return NextResponse.json({
                error: 'User or tournament not found',
                debug: debugInfo
            }, { status: 400 });
        }

        // Step 0.5: Ensure tournament record exists using your database function
        const { data: ensureResult, error: ensureError } = await supabase
            .rpc('get_or_create_user_tournament_record', {
                p_user_id: user.id,
                p_tournament_id: tournament.id,
                p_username: user.username,
                p_wallet: wallet
            });

        debugInfo.step0_ensure_record = {
            success: !!ensureResult,
            error: ensureError?.message,
            record_id: ensureResult
        };

        // Now get the current record (it definitely exists)
        const { data: currentRecord, error: recordError } = await supabase
            .from('user_tournament_records')
            .select('total_continues_used, total_continue_payments, user_id, tournament_id')
            .eq('wallet', wallet)
            .eq('tournament_day', today)
            .single();

        debugInfo.step1_lookup_record = {
            found: !!currentRecord,
            error: recordError?.message,
            data: currentRecord
        };

        if (currentRecord) {
            // Update user tournament record with totals only
            const { error: updateError1 } = await supabase
                .from('user_tournament_records')
                .update({
                    total_continues_used: currentRecord.total_continues_used + 1,
                    total_continue_payments: currentRecord.total_continue_payments + continue_amount
                })
                .eq('wallet', wallet)
                .eq('tournament_day', today);

            debugInfo.step2_update_record = {
                success: !updateError1,
                error: updateError1?.message
            };
        }

        return NextResponse.json({
            success: true,
            debug: debugInfo
        });

    } catch (error) {
        console.error('❌ Continue API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
