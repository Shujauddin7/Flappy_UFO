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
            tournamentId,
            rank,
            finalScore,
            prizeAmount,
            username,
            tournamentDay
        } = await req.json();

        if (!winnerWallet || !tournamentId || !rank || !prizeAmount) {
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

        // Check if pending prize already exists for this user/tournament/rank
        const { data: existing } = await supabase
            .from('pending_prizes')
            .select('id, attempt_count')
            .eq('user_id', user.id)
            .eq('tournament_id', tournamentId)
            .eq('final_rank', rank)
            .single();

        if (existing) {
            // Update attempt count
            const { error } = await supabase
                .from('pending_prizes')
                .update({
                    attempt_count: existing.attempt_count + 1,
                    last_attempt_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (error) {
                console.error('Error updating pending prize attempt:', error);
                return NextResponse.json({ error: 'Failed to update pending prize' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: 'Pending prize attempt updated',
                attempt_count: existing.attempt_count + 1
            });
        } else {
            // Insert new pending prize
            const { error } = await supabase
                .from('pending_prizes')
                .insert({
                    user_id: user.id,
                    tournament_id: tournamentId,
                    username: username,
                    wallet: winnerWallet,
                    tournament_day: tournamentDay || new Date().toISOString().split('T')[0],
                    final_rank: rank,
                    final_score: finalScore || 0,
                    prize_amount: prizeAmount,
                    attempt_count: 1,
                    last_attempt_at: new Date().toISOString(),
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error('Error creating pending prize:', error);
                return NextResponse.json({ error: 'Failed to create pending prize' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: 'Pending prize created',
                attempt_count: 1
            });
        }

    } catch (error) {
        console.error('Error in pending prizes API:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
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

        const { searchParams } = new URL(req.url);
        const tournamentId = searchParams.get('tournament_id');
        const rank = searchParams.get('rank');
        const walletAddress = searchParams.get('wallet');

        if (!tournamentId || !rank || !walletAddress) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Delete pending prize (payment succeeded)
        const { error } = await supabase
            .from('pending_prizes')
            .delete()
            .eq('tournament_id', tournamentId)
            .eq('final_rank', parseInt(rank))
            .eq('wallet', walletAddress);

        if (error) {
            console.error('Error deleting pending prize:', error);
            return NextResponse.json({ error: 'Failed to delete pending prize' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Pending prize removed' });

    } catch (error) {
        console.error('Error in pending prizes deletion:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
