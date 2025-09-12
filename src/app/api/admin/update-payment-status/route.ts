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

        // Get user_id from wallet, create user if not exists
        let { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', winnerWallet)
            .single();

        if (!user) {
            // Create user if not exists (they might only exist in user_tournament_records)
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    wallet: winnerWallet,
                    username: username || null
                })
                .select('id')
                .single();

            if (createError) {
                console.error('Error creating user:', createError);
                return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
            }

            user = newUser;
        }

        // Insert into prizes table to mark as sent
        const { error } = await supabase
            .from('prizes')
            .insert({
                user_id: user.id,
                tournament_id: tournamentId,
                username: username,
                wallet: winnerWallet,
                tournament_day: new Date().toISOString().split('T')[0], // Current date
                final_rank: rank,
                final_score: finalScore || 0,
                prize_amount: prizeAmount,
                transaction_hash: transactionId,
                sent_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error saving prize record:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to save payment record',
                details: error.message
            }, { status: 500 });
        }

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
