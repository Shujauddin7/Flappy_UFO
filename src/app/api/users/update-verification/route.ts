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

        // Find current active tournament (simplified approach)
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('id, tournament_day')
            .eq('is_active', true)
            .single();

        if (tournamentError || !tournament) {
            console.error('❌ No active tournament found:', tournamentError);
            return NextResponse.json({
                success: false,
                error: 'No active tournament found'
            }, { status: 404 });
        }

        const today = tournament.tournament_day;

        // Update user verification status with atomic operation (fixed approach)
        const { data: userData, error: userError } = await supabase
            .from('users')
            .update({
                world_id: nullifier_hash,
                last_verified_date: today, // Use tournament-day calculated today, not verification_date
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

        // IMPORTANT: Safely get or create user tournament record using ON CONFLICT
        // Don't use the database function as it uses CURRENT_DATE instead of tournament boundary logic
        const { data: tournamentRecord, error: recordError } = await supabase
            .from('user_tournament_records')
            .upsert({
                user_id: user.id,
                tournament_id: tournament.id,
                username: user.username,
                wallet: wallet,
                tournament_day: today, // Use the correct tournament boundary date
                world_id_proof: { nullifier_hash }, // Store World ID proof
                verified_at: new Date(verification_date).toISOString(), // Store full timestamp
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,tournament_id',
                ignoreDuplicates: false // Update existing record
            })
            .select('id')
            .single();

        if (recordError) {
            console.error('❌ Error upserting tournament record:', recordError);
            return NextResponse.json({
                success: false,
                error: `Failed to create/update tournament record: ${recordError.message}`
            }, { status: 500 });
        }

        console.log('✅ Tournament record created/updated with verification data:', tournamentRecord.id);

        // Update tournament table with player count and prize pool
        try {
            // Count unique users in user_tournament_records for this tournament
            const { data: playerData, error: playerCountError } = await supabase
                .from('user_tournament_records')
                .select('user_id, verified_paid_amount, standard_paid_amount')
                .eq('tournament_id', tournament.id);

            if (!playerCountError && playerData) {
                const uniquePlayerCount = playerData.length;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const totalPrizePool = playerData.reduce((sum: number, record: any) =>
                    sum + (record.verified_paid_amount || 0) + (record.standard_paid_amount || 0), 0
                ) * 0.7; // 70% goes to prize pool

                // Update tournament with player count and prize pool
                const { error: updateError } = await supabase
                    .from('tournaments')
                    .update({
                        total_players: uniquePlayerCount,
                        total_prize_pool: totalPrizePool
                    })
                    .eq('id', tournament.id);

                if (updateError) {
                    console.error('❌ Error updating tournament stats:', updateError);
                } else {
                    console.log('✅ Tournament stats updated:', { players: uniquePlayerCount, prize_pool: totalPrizePool });
                }
            }
        } catch (error) {
            console.error('❌ Error updating tournament stats:', error);
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
