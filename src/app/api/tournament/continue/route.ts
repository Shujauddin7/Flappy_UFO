import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    console.log('🎮 Tournament continue API called');

    try {
        // Environment-specific database credentials
        const isProduction = process.env.NODE_ENV === 'production';
        const supabaseUrl = isProduction
            ? process.env.SUPABASE_PROD_URL
            : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction
            ? process.env.SUPABASE_PROD_SERVICE_KEY
            : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Missing Supabase credentials');
            return NextResponse.json({
                error: 'Server configuration error'
            }, { status: 500 });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get session
        const session = await auth();
        if (!session?.user?.walletAddress) {
            console.error('❌ No session or wallet address');
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { payment_reference, continue_amount, score } = await req.json();
        console.log('📝 Continue payment request:', { payment_reference, continue_amount, score, wallet: session.user.walletAddress });

        // Validate required fields
        if (!payment_reference || !continue_amount || score === undefined) {
            console.error('❌ Missing required fields');
            return NextResponse.json({
                error: 'Missing required fields: payment_reference, continue_amount, score'
            }, { status: 400 });
        }

        const wallet = session.user.walletAddress;
        const today = new Date().toISOString().split('T')[0];

        console.log('🔍 Continue API flow:', {
            wallet,
            today,
            payment_reference: payment_reference?.substring(0, 10) + '...',
            continue_amount,
            score
        });

        console.log('🔍 Looking for current tournament and user:', { wallet, today });

        // Get current active tournament
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('id')
            .eq('tournament_day', today)
            .eq('is_active', true)
            .single();

        if (tournamentError || !tournament) {
            console.error('❌ No active tournament found');
            return NextResponse.json({
                error: 'No active tournament available. Continue payments require an active tournament.',
                code: 'NO_ACTIVE_TOURNAMENT'
            }, { status: 400 });
        }

        console.log('✅ Active tournament found:', tournament.id);        // Get user (must exist for tournament continues)
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', wallet)
            .single();

        if (userError || !user) {
            console.error('❌ User not found - continues require tournament entry first');
            return NextResponse.json({
                error: 'User not found. You must enter the tournament first before using continues.',
                code: 'USER_NOT_FOUND'
            }, { status: 400 });
        }

        const userId = user.id;
        console.log('✅ User found with ID:', userId);

        // Get user tournament record (MUST exist for continues)
        const { data: userRecord, error: recordError } = await supabase
            .from('user_tournament_records')
            .select('id, total_continues_used, total_continue_payments, verified_entry_paid, standard_entry_paid')
            .eq('user_id', userId)
            .eq('tournament_id', tournament.id)
            .single();

        if (recordError || !userRecord) {
            console.error('❌ User tournament record not found:', {
                user_id: userId,
                tournament_id: tournament.id,
                error: recordError?.message || 'No record found',
                error_code: recordError?.code || 'NO_RECORD'
            });

            // Log all user tournament records for debugging
            const { data: allRecords, error: allRecordsError } = await supabase
                .from('user_tournament_records')
                .select('id, tournament_id, user_id, tournament_day, verified_entry_paid, standard_entry_paid')
                .eq('user_id', userId);

            console.log('🔍 Debug: All user tournament records:', allRecords, 'Error:', allRecordsError);

            return NextResponse.json({
                error: 'Tournament entry not found. You must enter the tournament first before using continues.',
                code: 'TOURNAMENT_ENTRY_REQUIRED',
                debug: {
                    user_id: userId,
                    tournament_id: tournament.id,
                    all_records: allRecords?.length || 0
                }
            }, { status: 400 });
        }        // Verify user has actually paid to enter the tournament
        const hasPaidEntry = userRecord.verified_entry_paid || userRecord.standard_entry_paid;
        if (!hasPaidEntry) {
            console.error('❌ User has not paid for tournament entry');
            return NextResponse.json({
                error: 'No valid tournament entry payment found. You must pay to enter the tournament before using continues.',
                code: 'PAYMENT_REQUIRED'
            }, { status: 400 });
        }

        console.log('✅ Tournament record found with valid entry payment:', {
            record_id: userRecord.id,
            continues_used: userRecord.total_continues_used,
            has_verified_payment: userRecord.verified_entry_paid,
            has_standard_payment: userRecord.standard_entry_paid
        });

        // Update the tournament record with continue payment
        const { data: updatedRecord, error: updateError } = await supabase
            .from('user_tournament_records')
            .update({
                total_continues_used: userRecord.total_continues_used + 1,
                total_continue_payments: userRecord.total_continue_payments + continue_amount,
                last_game_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', userRecord.id)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Error updating continue payment:', updateError);
            return NextResponse.json({
                error: 'Failed to record continue payment. Please try again.',
                code: 'UPDATE_FAILED'
            }, { status: 500 });
        }

        console.log('✅ Tournament continue payment recorded:', {
            record_id: userRecord.id,
            total_continues_used: updatedRecord.total_continues_used,
            total_continue_payments: updatedRecord.total_continue_payments,
            continue_amount
        });

        return NextResponse.json({
            success: true,
            data: {
                tournament_record_id: userRecord.id,
                continues_used: updatedRecord.total_continues_used,
                continue_payments: updatedRecord.total_continue_payments,
                message: `Continue payment of ${continue_amount} WLD recorded successfully`
            }
        });

    } catch (error) {
        console.error('❌ Tournament continue API error:', error);
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 });
    }
}