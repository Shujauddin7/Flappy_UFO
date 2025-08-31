import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface UpdateVerificationRequest {
    nullifier_hash: string;
    verification_date: string;
    wallet?: string; // Optional - can be passed if no session
}

/**
 * Update user verification status after successful World ID verification
 * This API tracks daily verification for tournament entry pricing
 */
export async function POST(req: NextRequest) {
    try {
        const { nullifier_hash, verification_date, wallet } = await req.json() as UpdateVerificationRequest;

        if (!nullifier_hash || !verification_date) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // For now, we'll require wallet to be passed since we don't have session management fully set up
        if (!wallet) {
            return NextResponse.json(
                { success: false, error: 'Wallet address required' },
                { status: 400 }
            );
        }

        // Environment-specific database configuration (use service keys)
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'production';

        const supabaseUrl = isProduction
            ? process.env.SUPABASE_PROD_URL
            : process.env.SUPABASE_DEV_URL;

        const supabaseServiceKey = isProduction
            ? process.env.SUPABASE_PROD_SERVICE_KEY
            : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Missing environment variables for', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
            return NextResponse.json({
                error: `Server configuration error: Missing ${isProduction ? 'production' : 'development'} database credentials`
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check if the user exists
        const { error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', wallet)
            .single();

        if (checkError) {
            if (checkError.code === 'PGRST116') {
                return NextResponse.json({
                    success: false,
                    error: 'User not found. Please sign in first to create your profile.'
                }, { status: 404 });
            }
            console.error('❌ Error checking user existence:', checkError);
            return NextResponse.json({
                success: false,
                error: 'Database query failed: ' + checkError.message
            }, { status: 500 });
        }

        // Get current tournament info (get actual tournament UUID)
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        // Get today's tournament UUID from tournaments table
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('id')
            .eq('tournament_day', today)
            .single();

        if (tournamentError || !tournament) {
            console.error('❌ No tournament found for today:', tournamentError);
            return NextResponse.json({
                success: false,
                error: 'No active tournament found for today'
            }, { status: 404 });
        }

        // Update user verification status with atomic operation (fixed approach)
        const { data: userData, error: userError } = await supabase
            .from('users')
            .update({
                world_id: nullifier_hash,
                last_verified_date: new Date(verification_date).toISOString().split('T')[0],
                last_verified_tournament_id: tournament.id,
                updated_at: new Date().toISOString()
            })
            .eq('wallet', wallet)
            .select('id, username')
            .single();

        if (userError) {
            console.error('❌ Error updating user verification:', userError);
            return NextResponse.json(
                { success: false, error: 'Database update failed: ' + userError.message },
                { status: 500 }
            );
        }

        if (!userData) {
            console.error('❌ No user found with wallet:', wallet);
            return NextResponse.json(
                { success: false, error: 'User not found. Please sign in first.' },
                { status: 404 }
            );
        }

        const user = userData;

        // IMPORTANT: Also update user_tournament_records table with verification data
        // Check if user has a tournament record for today
        const { data: tournamentRecord } = await supabase
            .from('user_tournament_records')
            .select('id')
            .eq('user_id', user.id)
            .eq('tournament_id', tournament.id)
            .eq('tournament_day', today)
            .single();

        if (tournamentRecord) {
            // Update existing tournament record with verification data
            const { error: updateRecordError } = await supabase
                .from('user_tournament_records')
                .update({
                    world_id_proof: { nullifier_hash }, // Store World ID proof
                    verified_at: new Date(verification_date).toISOString(), // Store full timestamp
                    updated_at: new Date().toISOString()
                })
                .eq('id', tournamentRecord.id);

            if (updateRecordError) {
                console.error('❌ Error updating tournament record verification:', updateRecordError);
                return NextResponse.json({
                    success: false,
                    error: `Failed to update tournament verification: ${updateRecordError.message}`
                }, { status: 500 });
            } else {
                console.log('✅ Tournament record updated with verification data');
            }
        } else {
            // Create a new tournament record with verification data
            console.log('ℹ️ No tournament record found, creating one with verification data');
            const { error: createRecordError } = await supabase
                .from('user_tournament_records')
                .insert({
                    user_id: user.id,
                    tournament_id: tournament.id,
                    username: user.username,
                    wallet: wallet,
                    tournament_day: today,
                    world_id_proof: { nullifier_hash },
                    verified_at: new Date(verification_date).toISOString(),
                    highest_score: 0,
                    total_games_played: 0,
                    verified_games_played: 0,
                    unverified_games_played: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (createRecordError) {
                console.error('❌ Error creating tournament record with verification:', createRecordError);
                return NextResponse.json({
                    success: false,
                    error: `Failed to create tournament record: ${createRecordError.message}`
                }, { status: 500 });
            } else {
                console.log('✅ Tournament record created with verification data');
            }
        }

        console.log('✅ User verification status updated:', {
            wallet: wallet,
            verified_date: verification_date,
            tournament_id: tournament.id,
            updated_user: user
        });

        return NextResponse.json({
            success: true,
            data: {
                verified_date: verification_date,
                tournament_id: tournament.id,
                pricing: '0.9 WLD' // Verified pricing
            }
        });

    } catch (error) {
        console.error('❌ Error in update-verification API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
