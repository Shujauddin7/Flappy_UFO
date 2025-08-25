import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface VerificationStatusRequest {
    wallet: string;
}

/**
 * Check if user is verified for today's tournament
 * Returns verification status and pricing info
 */
export async function POST(req: NextRequest) {
    try {
        const { wallet } = await req.json() as VerificationStatusRequest;

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

        // Get current tournament info - get actual tournament UUID
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        // Get today's tournament UUID from tournaments table
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('id')
            .eq('tournament_day', today)
            .single();

        if (tournamentError || !tournament) {
            console.log('ℹ️ No tournament found for today:', today);
            // Return not verified if no tournament exists
            return NextResponse.json({
                success: true,
                data: {
                    isVerified: false,
                    verifiedDate: null,
                    tournamentId: null,
                    currentTournamentId: null,
                    pricing: '1.0 WLD',
                    worldId: null,
                }
            });
        }

        const currentTournamentId = tournament.id;

        // Get user's verification status
        const { data, error } = await supabase
            .from('users')
            .select('last_verified_date, last_verified_tournament_id, world_id')
            .eq('wallet', wallet)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('❌ Error checking verification status:', error);
            return NextResponse.json(
                { success: false, error: 'Database query failed' },
                { status: 500 }
            );
        }

        // Check if user is verified for today's tournament
        // Note: We check against the tournament string ID format used during verification
        const isVerifiedToday = !!(data &&
            data.last_verified_date === today &&
            data.last_verified_tournament_id === currentTournamentId);

        const verificationStatus = {
            isVerified: isVerifiedToday,
            verifiedDate: data?.last_verified_date || null,
            tournamentId: data?.last_verified_tournament_id || null,
            currentTournamentId: currentTournamentId,
            pricing: isVerifiedToday ? '0.9 WLD' : '1.0 WLD',
            worldId: data?.world_id || null,
        };

        console.log('✅ Verification status checked:', {
            wallet: wallet,
            status: verificationStatus
        });

        return NextResponse.json({
            success: true,
            data: verificationStatus
        });

    } catch (error) {
        console.error('❌ Error in verification-status API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
