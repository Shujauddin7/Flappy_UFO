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

        // Environment-specific database configuration (following Plan.md specification)
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

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

        // Get current tournament info using tournament boundary logic (15:30 UTC)
        const now = new Date();
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();

        // Tournament day starts at 15:30 UTC, so if it's before 15:30, use yesterday's date
        const tournamentDate = new Date(now);
        if (utcHour < 15 || (utcHour === 15 && utcMinute < 30)) {
            tournamentDate.setUTCDate(tournamentDate.getUTCDate() - 1);
        }

        const today = tournamentDate.toISOString().split('T')[0]; // YYYY-MM-DD format

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

        // IMPORTANT: Use the database function to safely get or create user tournament record
        // This prevents duplicate key constraint violations
        const { data: recordId, error: recordError } = await supabase
            .rpc('get_or_create_user_tournament_record', {
                p_user_id: user.id,
                p_tournament_id: tournament.id,
                p_username: user.username,
                p_wallet: wallet
            });

        if (recordError) {
            console.error('❌ Error getting/creating tournament record:', recordError);
            return NextResponse.json({
                success: false,
                error: `Failed to create tournament record: ${recordError.message}`
            }, { status: 500 });
        }

        console.log('✅ Tournament record ID obtained:', recordId);

        // Now update the tournament record with verification data
        const { error: updateRecordError } = await supabase
            .from('user_tournament_records')
            .update({
                world_id_proof: { nullifier_hash }, // Store World ID proof
                verified_at: new Date(verification_date).toISOString(), // Store full timestamp
                updated_at: new Date().toISOString()
            })
            .eq('id', recordId);

        if (updateRecordError) {
            console.error('❌ Error updating tournament record verification:', updateRecordError);
            return NextResponse.json({
                success: false,
                error: `Failed to update tournament verification: ${updateRecordError.message}`
            }, { status: 500 });
        }

        console.log('✅ Tournament record updated with verification data');

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
