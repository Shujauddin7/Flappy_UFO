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

        // Update tournament total_players count (sign-ins for THIS tournament)
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

// Helper function to update tournament sign-in count
async function updateTournamentSignInCount(supabase: SupabaseClient, tournamentId: string) {
    try {
        // Count unique users who have tournament records for this tournament
        // This is the correct way based on database.md schema
        const { data: userRecords, error: countError } = await supabase
            .from('user_tournament_records')
            .select('user_id')
            .eq('tournament_id', tournamentId);

        if (countError) {
            console.error('❌ Error counting tournament sign-ins:', countError);
            return;
        }

        const signInCount = userRecords?.length || 0;

        // REMOVED: No longer updating tournament table from sign-ins
        // REASON: PROD_4 script dropped 'total_players' column from tournaments table
        // Tournament uses 'total_tournament_players' which is updated by entry/route.ts when users PAY
        // Sign-ins are tracked separately in tournament_sign_ins table for analytics only
        console.log(`✅ Sign-in count for tournament ${tournamentId}: ${signInCount} (analytics only, not saved to tournament table)`);

    } catch (error) {
        console.error('❌ Error in updateTournamentSignInCount:', error);
    }
}