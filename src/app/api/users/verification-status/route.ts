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

        // Get current tournament info using weekly tournament boundary logic (Sunday 15:30 UTC)
        const now = new Date();
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();

        // Tournament week starts at 15:30 UTC Sunday, so if it's before 15:30, use last week's Sunday
        const tournamentDate = new Date(now);
        if (utcHour < 15 || (utcHour === 15 && utcMinute < 30)) {
            tournamentDate.setUTCDate(tournamentDate.getUTCDate() - 1);
        }

        // Get the Sunday of this week for tournament_day
        const dayOfWeek = tournamentDate.getUTCDay(); // 0 = Sunday
        const daysToSubtract = dayOfWeek; // Days since last Sunday
        const tournamentSunday = new Date(tournamentDate);
        tournamentSunday.setUTCDate(tournamentDate.getUTCDate() - daysToSubtract);

        const today = tournamentSunday.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Get current week's tournament UUID from tournaments table
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('id')
            .eq('tournament_day', today)
            .single();

        if (tournamentError || !tournament) {
            console.log('ℹ️ No tournament found for week starting:', today);
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
