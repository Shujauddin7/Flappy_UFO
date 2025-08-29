import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
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
            console.error('❌ Missing Supabase credentials:', {
                hasUrl: !!supabaseUrl,
                hasKey: !!supabaseServiceKey,
                environment: isProduction ? 'production' : 'development'
            });
            return NextResponse.json({
                error: `Server configuration error: Missing ${isProduction ? 'production' : 'development'} database credentials`
            }, { status: 500 });
        }

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get session
        const session = await auth();
        if (!session?.user?.walletAddress) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { payment_reference, continue_amount, score } = await req.json();

        // Validate required fields
        if (!payment_reference || !continue_amount || score === undefined) {
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

        if (tournamentError) {
            console.error('❌ Error fetching tournament:', tournamentError);
            return NextResponse.json({
                error: 'No active tournament found'
            }, { status: 404 });
        }

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', wallet)
            .single();

        if (userError || !user) {
            console.error('❌ User not found:', userError);
            return NextResponse.json({
                error: 'User not found'
            }, { status: 404 });
        }

        // Get user tournament record
        const { data: userRecord, error: recordError } = await supabase
            .from('user_tournament_records')
            .select('id, total_continues_used, total_continue_payments, current_entry_type')
            .eq('user_id', user.id)
            .eq('tournament_id', tournament.id)
            .single();

        if (recordError || !userRecord) {
            console.error('❌ User tournament record not found:', recordError);
            return NextResponse.json({
                error: 'Tournament entry not found. Please create a tournament entry first.'
            }, { status: 404 });
        }

        console.log('🎮 Processing tournament continue:', {
            user_id: user.id,
            tournament_record_id: userRecord.id,
            current_continues_used: userRecord.total_continues_used,
            continue_amount,
            score
        });

        // Update the tournament record with continue payment
        const { data: updatedRecord, error: updateError } = await supabase
            .from('user_tournament_records')
            .update({
                total_continues_used: userRecord.total_continues_used + 1,
                total_continue_payments: userRecord.total_continue_payments + continue_amount,
                updated_at: new Date().toISOString()
            })
            .eq('id', userRecord.id)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Error updating continue payment:', updateError);
            return NextResponse.json({
                error: `Failed to record continue payment: ${updateError.message}`
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
