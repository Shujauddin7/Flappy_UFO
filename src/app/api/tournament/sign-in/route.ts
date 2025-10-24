import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const { wallet, username, worldId, tournamentId } = await req.json();

        if (!wallet || !username || !tournamentId) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: wallet, username, tournamentId' },
                { status: 400 }
            );
        }

        const supabase = createServerSupabaseClient();

        // Check if user exists in permanent sign-ins table
        const { data: existingUser, error: checkError } = await supabase
            .from('tournament_sign_ins')
            .select('*')
            .eq('wallet', wallet)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('❌ Error checking existing user:', checkError);
            return NextResponse.json(
                { success: false, error: 'Database error checking user' },
                { status: 500 }
            );
        }

        let isNewUser = false;

        if (!existingUser) {
            // New user - create permanent record
            const { error: insertError } = await supabase
                .from('tournament_sign_ins')
                .insert({
                    wallet,
                    username,
                    world_id: worldId,
                    first_tournament_id: tournamentId,
                    total_tournaments_visited: 1
                });

            if (insertError) {
                console.error('❌ Error creating new user sign-in:', insertError);
                return NextResponse.json(
                    { success: false, error: 'Failed to create user sign-in record' },
                    { status: 500 }
                );
            }

            isNewUser = true;
        } else {
            // Existing user - update tournaments visited
            const { error: updateError } = await supabase
                .from('tournament_sign_ins')
                .update({
                    total_tournaments_visited: (existingUser.total_tournaments_visited || 0) + 1
                })
                .eq('wallet', wallet);

            if (updateError) {
                console.error('❌ Error updating user tournaments visited:', updateError);
                return NextResponse.json(
                    { success: false, error: 'Failed to update user sign-in record' },
                    { status: 500 }
                );
            }

        }

        // Update tournament total_players count (ALL sign-ins for admin reference)
        await updateTournamentSignInCount(supabase, tournamentId);

        // REMOVED: Do NOT create user_tournament_record on sign-in
        // REASON: user_tournament_record should ONLY be created when user PAYS in /api/tournament/entry
        // This prevents counting sign-ins as tournament players in leaderboard

        return NextResponse.json({
            success: true,
            isNewUser,
            message: isNewUser ? 'New user signed in successfully' : 'User tournament visit updated'
        });

    } catch (error) {
        console.error('❌ Tournament sign-in API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Helper function to update tournament total_players count (ALL sign-ins)
async function updateTournamentSignInCount(supabase: SupabaseClient, tournamentId: string) {
    try {
        // Count DISTINCT users who have user_tournament_records OR sign-ins for this tournament
        // Strategy: Count all unique wallets that either paid OR signed in for this tournament

        // Get unique wallets who paid (from user_tournament_records)
        const { data: paidUsers, error: paidError } = await supabase
            .from('user_tournament_records')
            .select('wallet')
            .eq('tournament_id', tournamentId);

        if (paidError) {
            console.error('❌ Error counting paid users:', paidError);
            return;
        }

        // Get unique wallets from tournament_sign_ins who signed in for this tournament
        // This captures users who signed in but may not have paid yet
        const { data: signedInUsers, error: signInError } = await supabase
            .from('tournament_sign_ins')
            .select('wallet, first_tournament_id')
            .eq('first_tournament_id', tournamentId);

        if (signInError) {
            console.error('❌ Error counting signed-in users:', signInError);
            return;
        }

        // Combine both lists and get unique wallets
        const allWallets = new Set<string>();
        paidUsers?.forEach(u => allWallets.add(u.wallet));
        signedInUsers?.forEach(u => allWallets.add(u.wallet));

        const totalSignIns = allWallets.size;

        // Update tournaments.total_players column (admin reference for ALL sign-ins)
        const { error: updateError } = await supabase
            .from('tournaments')
            .update({ total_players: totalSignIns })
            .eq('id', tournamentId);

        if (updateError) {
            console.error('❌ Error updating tournament total_players:', updateError);
            return;
        }

        console.log(`✅ Updated tournament ${tournamentId} total_players: ${totalSignIns} unique users (sign-ins + paid)`);

    } catch (error) {
        console.error('❌ Error in updateTournamentSignInCount:', error);
    }
}