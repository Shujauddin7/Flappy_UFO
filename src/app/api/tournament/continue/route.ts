import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { publishPrizePoolUpdate } from '@/lib/redis';

// Helper function to update tournament analytics (includes entry + continue payments)
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

        // Calculate total revenue from ALL payments: entry payments + continue payments
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalRevenue = data?.reduce((sum: number, record: any) => {
            const entryPayments = (record.verified_paid_amount || 0) + (record.standard_paid_amount || 0);
            const continuePayments = record.total_continue_payments || 0;
            return sum + entryPayments + continuePayments;
        }, 0) || 0;

        // Count total players for guarantee calculation
        const totalPlayers = data?.length || 0;

        // NEW GUARANTEE SYSTEM (per Plan.md): Admin adds 1 WLD per top 10 winner when total collected < 72 WLD
        let guaranteeAmount = 0;
        const adminFeeAmount = totalRevenue * 0.30; // Always 30%
        const basePrizePool = totalRevenue * 0.70; // Always 70%

        if (totalRevenue < 72) {
            const top10Winners = Math.min(totalPlayers, 10);
            guaranteeAmount = top10Winners * 1.0; // Admin adds 1 WLD per top 10 winner
        }

        const totalPrizePool = basePrizePool + guaranteeAmount; // 70% + guarantee (if needed)
        const adminNetResult = adminFeeAmount - guaranteeAmount; // Can be negative

        console.log('💰 Tournament analytics recalculation after continue (NEW guarantee system):', {
            totalRevenue,
            basePrizePool,
            guaranteeAmount,
            totalPrizePool,
            adminFeeAmount,
            adminNetResult
        });

        // Update tournament with NEW guarantee system
        const { error: updateError } = await supabase
            .from('tournaments')
            .update({
                total_prize_pool: totalPrizePool,
                total_collected: totalRevenue,
                total_tournament_players: totalPlayers,
                admin_fee: adminFeeAmount,
                guarantee_amount: guaranteeAmount,
                admin_net_result: adminNetResult
            })
            .eq('id', tournamentId);

        if (updateError) {
            console.error('❌ Error updating tournament analytics:', updateError);
        } else {
            console.log('✅ Tournament analytics updated with guarantee system:', {
                total_collected: totalRevenue,
                base_prize_pool: basePrizePool,
                guarantee_amount: guaranteeAmount,
                total_prize_pool: totalPrizePool,
                admin_fee: adminFeeAmount,
                admin_net_result: adminNetResult
            });
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

        // Calculate tournament day using weekly tournament boundary logic (Sunday 15:30 UTC)
        const now = new Date();
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();

        // Tournament week starts at 15:30 UTC Sunday, so if it's before 15:30, use last week's Sunday
        const tournamentDate = new Date(now);
        if (utcHour < 15 || (utcHour === 15 && utcMinute < 30)) {
            tournamentDate.setUTCDate(tournamentDate.getUTCDate() - 1);
        }

        // Get the Sunday of this week for tournament_day
        const dayOfWeek = tournamentDate.getUTCDay(); // 0 = Sunday
        const daysToSubtract = dayOfWeek; // Days since last Sunday
        const tournamentSunday = new Date(tournamentDate);
        tournamentSunday.setUTCDate(tournamentDate.getUTCDate() - daysToSubtract);

        const today = tournamentSunday.toISOString().split('T')[0];

        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, username')
            .eq('wallet', wallet)
            .single();

        if (userError || !user) {
            console.error('❌ Continue payment failed: User not found', { wallet, userError });
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        console.log('✅ User found:', { user_id: user.id, wallet });

        // Get today's tournament
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('id, tournament_day')
            .eq('tournament_day', today)
            .eq('is_active', true)
            .single();

        if (tournamentError || !tournament) {
            console.error('❌ Continue payment failed: No active tournament', { today, tournamentError });
            return NextResponse.json({ error: 'No active tournament found' }, { status: 404 });
        }

        console.log('✅ Tournament found:', { tournament_id: tournament.id, tournament_day: tournament.tournament_day });

        // Find the user's tournament record for the active tournament
        const { data: tournamentRecord, error: recordError } = await supabase
            .from('user_tournament_records')
            .select('id, total_continues_used, total_continue_payments')
            .eq('user_id', user.id)
            .eq('tournament_id', tournament.id)
            .single();

        if (recordError || !tournamentRecord) {
            console.error('❌ Continue payment failed: Tournament entry not found', {
                user_id: user.id,
                tournament_id: tournament.id,
                recordError
            });
            return NextResponse.json({
                error: 'Tournament entry not found. Please pay entry fee first.',
                details: recordError?.message
            }, { status: 404 });
        }

        console.log('✅ Tournament record found:', { record_id: tournamentRecord.id });

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

        // 📡 Broadcast prize pool update via Socket.IO for instant cross-device updates
        console.log('📡 Attempting to broadcast continue payment prize pool update...');
        try {
            const { data: updatedTournament, error: fetchError } = await supabase
                .from('tournaments')
                .select('total_prize_pool, total_tournament_players')
                .eq('id', tournament.id)
                .single();

            if (fetchError) {
                console.error('❌ Failed to fetch updated tournament data:', fetchError);
            } else if (updatedTournament) {
                console.log('✅ Broadcasting prize pool update:', {
                    tournament_id: tournament.id,
                    new_prize_pool: updatedTournament.total_prize_pool,
                    total_players: updatedTournament.total_tournament_players,
                    increment_amount: continue_amount
                });

                await publishPrizePoolUpdate(tournament.id, {
                    new_prize_pool: updatedTournament.total_prize_pool,
                    total_players: updatedTournament.total_tournament_players,
                    increment_amount: continue_amount
                });

                console.log('✅ Prize pool update broadcast successful');
            }
        } catch (socketError) {
            console.error('❌ Socket.IO broadcast failed:', socketError);
        }

        // �🔄 SYNC: Update tournament_sign_ins aggregates (amount and games count best-effort)
        try {
            // Ensure row exists and accumulate continue amount
            await supabase
                .from('tournament_sign_ins')
                .upsert({
                    wallet,
                    username: user.username,
                    total_amount_paid: continue_amount,
                }, { onConflict: 'wallet', ignoreDuplicates: false });

            // Optional RPC to increment safely if present
            // If not present, ignore silently
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: rpcError } = await (supabase as any).rpc?.('increment_signin_payment', {
                p_wallet: wallet,
                p_amount: continue_amount
            });
            if (rpcError) {
                console.log('increment_signin_payment RPC not available or failed (non-critical)');
            }
        } catch (e) {
            console.log('Sign-in aggregates update skipped (non-critical):', e);
        }

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