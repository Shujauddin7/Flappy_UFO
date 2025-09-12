import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
    try {
        // Get session for admin validation
        const session = await auth();
        if (!session?.user?.walletAddress) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Validate admin access
        const primaryAdminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET;
        const backupAdminWallet = process.env.NEXT_PUBLIC_BACKUP_ADMIN_WALLET;
        const validAdminWallets = [primaryAdminWallet, backupAdminWallet].filter(Boolean);

        if (!validAdminWallets.includes(session.user.walletAddress)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const {
            winnerWallet,
            transactionId,
            tournamentId,
            rank,
            finalScore,
            prizeAmount,
            username
        } = await req.json();

        if (!winnerWallet || !transactionId || !tournamentId || !rank || !prizeAmount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Get user_id from user_tournament_records (players already exist there)
        const { data: userRecord } = await supabase
            .from('user_tournament_records')
            .select('user_id, tournament_day')
            .eq('wallet', winnerWallet)
            .eq('tournament_id', tournamentId)
            .single();

        if (!userRecord) {
            console.error('❌ User not found in tournament records for wallet:', winnerWallet, 'tournament:', tournamentId);
            return NextResponse.json({ error: 'User not found in tournament records' }, { status: 404 });
        }

        const userId = userRecord.user_id;
        const tournamentDay = userRecord.tournament_day;

        console.log('💾 Saving payment to prizes table:', {
            user_id: userId,
            tournament_id: tournamentId,
            username: username,
            wallet: winnerWallet,
            tournament_day: tournamentDay,
            final_rank: rank,
            final_score: finalScore || 0,
            prize_amount: prizeAmount,
            transaction_hash: transactionId
        });

        // Insert into prizes table to mark as sent
        const { error } = await supabase
            .from('prizes')
            .insert({
                user_id: userId,
                tournament_id: tournamentId,
                username: username,
                wallet: winnerWallet,
                tournament_day: tournamentDay,
                final_rank: rank,
                final_score: finalScore || 0,
                prize_amount: prizeAmount,
                transaction_hash: transactionId,
                sent_at: new Date().toISOString()
            });

        if (error) {
            console.error('❌ Error saving prize record:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to save payment record',
                details: error.message
            }, { status: 500 });
        }

        console.log('✅ Payment successfully saved to prizes table');

        return NextResponse.json({
            success: true,
            message: 'Payment recorded successfully'
        });

    } catch (error) {
        console.error('Error in payment recording:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
