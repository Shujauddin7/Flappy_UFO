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

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, username')
            .eq('wallet', wallet)
            .single();

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Get today's tournament
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('id')
            .eq('tournament_day', today)
            .eq('is_active', true)
            .single();

        if (tournamentError || !tournament) {
            return NextResponse.json({ error: 'No active tournament found' }, { status: 404 });
        }

        // First, try to get existing record
        const { data: existingRecord, error: fetchError } = await supabase
            .from('user_tournament_continue_totals')
            .select('total_continues_used, total_continue_payments')
            .eq('user_id', user.id)
            .eq('tournament_id', tournament.id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 is "not found", which is expected for new records
            return NextResponse.json({
                error: 'Database error',
                message: fetchError.message
            }, { status: 500 });
        }

        if (existingRecord) {
            // Update existing record
            const { error: updateError } = await supabase
                .from('user_tournament_continue_totals')
                .update({
                    total_continues_used: (existingRecord.total_continues_used || 0) + 1,
                    total_continue_payments: (existingRecord.total_continue_payments || 0) + continue_amount,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', user.id)
                .eq('tournament_id', tournament.id);

            if (updateError) {
                return NextResponse.json({
                    error: 'Failed to update continue totals',
                    message: updateError.message
                }, { status: 500 });
            }
        } else {
            // Create new record
            const { error: insertError } = await supabase
                .from('user_tournament_continue_totals')
                .insert({
                    user_id: user.id,
                    tournament_id: tournament.id,
                    total_continues_used: 1,
                    total_continue_payments: continue_amount
                });

            if (insertError) {
                return NextResponse.json({
                    error: 'Failed to create continue totals',
                    message: insertError.message
                }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Continue payment recorded successfully'
        });

    } catch (error) {
        console.error('Continue API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}