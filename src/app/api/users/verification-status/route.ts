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

        // Find current active tournament (simplified approach)
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('id, tournament_day')
            .eq('is_active', true)
            .single();

        if (tournamentError || !tournament) {
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
        const today = tournament.tournament_day;

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
