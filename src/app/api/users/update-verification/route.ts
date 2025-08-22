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

        // Create Supabase client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('❌ Missing Supabase environment variables');
            return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Get current tournament info (for tournament_id)
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const currentTournamentId = `tournament-${today}`;

        // Update user verification status
        const { error } = await supabase
            .from('users')
            .update({
                world_id: nullifier_hash, // Store World ID identifier
                last_verified_date: new Date(verification_date).toISOString().split('T')[0], // Store date only
                last_verified_tournament_id: currentTournamentId,
            })
            .eq('wallet', wallet)
            .select();

        if (error) {
            console.error('❌ Error updating user verification:', error);
            return NextResponse.json(
                { success: false, error: 'Database update failed' },
                { status: 500 }
            );
        }

        console.log('✅ User verification status updated:', {
            wallet: wallet,
            verified_date: verification_date,
            tournament_id: currentTournamentId
        });

        return NextResponse.json({
            success: true,
            data: {
                verified_date: verification_date,
                tournament_id: currentTournamentId,
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
