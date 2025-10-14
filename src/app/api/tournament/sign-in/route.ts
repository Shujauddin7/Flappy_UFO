import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

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

        // Create user_tournament_record for this tournament (if doesn't exist)
        await ensureUserTournamentRecord(supabase, wallet, username, worldId, tournamentId);

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

// Helper function to ensure user_tournament_record exists (user should already exist in users table)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureUserTournamentRecord(supabase: any, wallet: string, username: string, worldId: string, tournamentId: string) {
    try {
        // Get tournament info
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('tournament_day')
            .eq('id', tournamentId)
            .single();

        if (tournamentError) {
            console.error('❌ Error getting tournament for record creation:', tournamentError);
            return;
        }

        // Get user ID from users table (user should exist from /api/users call)
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', wallet)
            .single();

        if (userError) {
            console.error('❌ User not found in users table:', userError);
            console.error('❌ Make sure /api/users was called first');
            return;
        }

        // Check if user_tournament_record already exists
        const { error: recordCheckError } = await supabase
            .from('user_tournament_records')
            .select('id')
            .eq('user_id', user.id)
            .eq('tournament_id', tournamentId)
            .single();

        if (recordCheckError && recordCheckError.code === 'PGRST116') {
            // Record doesn't exist, create it
            const { error: createRecordError } = await supabase
                .from('user_tournament_records')
                .insert({
                    user_id: user.id,
                    tournament_id: tournamentId,
                    username,
                    wallet,
                    tournament_day: tournament.tournament_day
                });

            if (createRecordError) {
                console.error('❌ Error creating user tournament record:', createRecordError);
            } else {
            }
        } else if (recordCheckError) {
            console.error('❌ Error checking user tournament record:', recordCheckError);
        } else {
        }

    } catch (error) {
        console.error('❌ Error in ensureUserTournamentRecord:', error);
    }
}

// Helper function to update tournament sign-in count
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateTournamentSignInCount(supabase: any, tournamentId: string) {
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