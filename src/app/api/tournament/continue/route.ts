import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

// Helper function to update tournament prize pool (includes entry + continue payments)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateTournamentPrizePool(supabase: any, tournamentId: string) {
    try {
        // Get ALL payment data for this tournament
        const { data, error } = await supabase
            .from('user_tournament_records')
            .select('verified_paid_amount, standard_paid_amount, total_continue_payments')
            .eq('tournament_id', tournamentId);

        if (error) {
            console.error('❌ Error fetching tournament payments:', error);
            return;
        }

        // Calculate total prize pool from ALL payments: entry payments + continue payments
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalCollected = data?.reduce((sum: number, record: any) => {
            const entryPayments = (record.verified_paid_amount || 0) + (record.standard_paid_amount || 0);
            const continuePayments = record.total_continue_payments || 0;
            return sum + entryPayments + continuePayments;
        }, 0) || 0;

        const totalPrizePool = totalCollected * 0.7; // 70% goes to prize pool

        console.log('💰 Prize pool recalculation after continue:', {
            totalCollected,
            totalPrizePool
        });

        // Update tournament prize pool
        const { error: updateError } = await supabase
            .from('tournaments')
            .update({ total_prize_pool: totalPrizePool })
            .eq('id', tournamentId);

        if (updateError) {
            console.error('❌ Error updating tournament prize pool:', updateError);
        } else {
            console.log('✅ Tournament prize pool updated:', totalPrizePool);
        }
    } catch (error) {
        console.error('❌ Error in updateTournamentPrizePool:', error);
    }
}

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

        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const wallet = session.user.walletAddress;

        // Calculate tournament day using tournament boundary logic (15:30 UTC)
        const now = new Date();
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();

        // Tournament day starts at 15:30 UTC, so if it's before 15:30, use yesterday's date
        const tournamentDate = new Date(now);
        if (utcHour < 15 || (utcHour === 15 && utcMinute < 30)) {
            tournamentDate.setUTCDate(tournamentDate.getUTCDate() - 1);
        }

        const today = tournamentDate.toISOString().split('T')[0];

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

        // Find the user's tournament record for today
        const { data: tournamentRecord, error: recordError } = await supabase
            .from('user_tournament_records')
            .select('id, total_continues_used, total_continue_payments')
            .eq('user_id', user.id)
            .eq('tournament_id', tournament.id)
            .single();

        if (recordError || !tournamentRecord) {
            return NextResponse.json({
                error: 'Tournament entry not found. Please pay entry fee first.',
                details: recordError?.message
            }, { status: 404 });
        }

        // Update the continue totals in user_tournament_records
        const { error: updateError } = await supabase
            .from('user_tournament_records')
            .update({
                total_continues_used: (tournamentRecord.total_continues_used || 0) + 1,
                total_continue_payments: (tournamentRecord.total_continue_payments || 0) + continue_amount,
                updated_at: new Date().toISOString()
            })
            .eq('id', tournamentRecord.id);

        if (updateError) {
            return NextResponse.json({
                error: 'Failed to update continue totals',
                details: updateError.message
            }, { status: 500 });
        }

        // Update tournament prize pool to include this continue payment (70% rule)
        await updateTournamentPrizePool(supabase, tournament.id);

        return NextResponse.json({
            success: true,
            message: 'Continue payment recorded and prize pool updated',
            data: {
                user_tournament_record_id: tournamentRecord.id,
                total_continues_used: (tournamentRecord.total_continues_used || 0) + 1,
                total_continue_payments: (tournamentRecord.total_continue_payments || 0) + continue_amount,
                continue_amount: continue_amount
            }
        });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}