import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    console.log('🔍 Tournament sign-in tracking API called');

    try {
        const { wallet, username, worldId, tournamentId } = await req.json();

        if (!wallet || !username || !worldId || !tournamentId) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: wallet, username, worldId, tournamentId' },
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
            console.log('✅ New user signed in:', { wallet, username, tournamentId });
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

            console.log('✅ Existing user visited new tournament:', { wallet, tournamentId });
        }

        // Update tournament total_players count (sign-ins for THIS tournament)
        await updateTournamentSignInCount(supabase, tournamentId);

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateTournamentSignInCount(supabase: any, tournamentId: string) {
    try {
        // Count unique sign-ins for THIS tournament only
        // This counts users who visited this specific tournament
        const { data: userRecords, error: countError } = await supabase
            .from('users')
            .select('wallet')
            .eq('tournament_id', tournamentId);

        if (countError) {
            console.error('❌ Error counting tournament sign-ins:', countError);
            return;
        }

        const signInCount = userRecords?.length || 0;

        // Update tournament total_players (sign-in count for THIS tournament)
        const { error: updateError } = await supabase
            .from('tournaments')
            .update({
                total_players: signInCount
            })
            .eq('id', tournamentId);

        if (updateError) {
            console.error('❌ Error updating tournament sign-in count:', updateError);
        } else {
            console.log('✅ Tournament sign-in count updated:', { tournamentId, signInCount });
        }

    } catch (error) {
        console.error('❌ Error in updateTournamentSignInCount:', error);
    }
}