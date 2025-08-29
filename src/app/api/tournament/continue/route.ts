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
                error: 'No active tournament available'
            }, { status: 400 });
        }

        console.log('✅ Active tournament found:', tournament.id);

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', wallet)
            .single();

        if (userError || !user) {
            console.error('❌ User not found');
            return NextResponse.json({
                error: 'User not found'
            }, { status: 400 });
        }

        const userId = user.id;
        console.log('✅ User found:', userId);

        // Get user tournament record (must exist for continues)
        const { data: userRecord, error: recordError } = await supabase
            .from('user_tournament_records')
            .select('id, total_continues_used, total_continue_payments, verified_entry_paid, standard_entry_paid')
            .eq('user_id', userId)
            .eq('tournament_id', tournament.id)
            .single();

        if (recordError || !userRecord) {
            console.error('❌ Tournament entry not found');
            return NextResponse.json({
                error: 'Tournament entry not found. You must enter the tournament first before using continues.'
            }, { status: 400 });
        }

        // Check if user has paid for entry
        const hasPaidEntry = userRecord.verified_entry_paid || userRecord.standard_entry_paid;
        if (!hasPaidEntry) {
            console.error('❌ No valid tournament entry payment');
            return NextResponse.json({
                error: 'No valid tournament entry payment found'
            }, { status: 400 });
        }

        console.log('✅ Tournament record found:', userRecord.id);

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
                error: 'Failed to record continue payment'
            }, { status: 500 });
        }

        console.log('✅ Continue payment recorded successfully');

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