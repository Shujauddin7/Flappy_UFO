import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface OrbCapabilityRequest {
    wallet: string;
}

interface OrbCapabilityResponse {
    success: boolean;
    data?: {
        hasOrbVerification: boolean;
        lastOrbVerificationDate?: string | null;
        canUseOrbDiscount: boolean;
    };
    error?: string;
}

/**
 * Check if user has Orb verification capability based on their verification history
 * This determines whether to show the Orb verification button as enabled or dimmed
 */
export async function POST(req: NextRequest) {
    try {
        const { wallet } = await req.json() as OrbCapabilityRequest;

        if (!wallet) {
            return NextResponse.json({
                success: false,
                error: 'Wallet address required'
            } as OrbCapabilityResponse, { status: 400 });
        }

        // Environment-specific database configuration
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
                success: false,
                error: `Server configuration error: Missing ${isProduction ? 'production' : 'development'} database credentials`
            } as OrbCapabilityResponse, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check if user exists and get their verification history
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', wallet)
            .single();

        if (userError && userError.code !== 'PGRST116') {
            console.error('❌ Error checking user:', userError);
            return NextResponse.json({
                success: false,
                error: 'Database query failed'
            } as OrbCapabilityResponse, { status: 500 });
        }

        if (!userData) {
            // New user - they can potentially use Orb verification
            return NextResponse.json({
                success: true,
                data: {
                    hasOrbVerification: false,
                    canUseOrbDiscount: true,
                    lastOrbVerificationDate: null
                }
            } as OrbCapabilityResponse);
        }

        // Check user's verification history for Orb verifications
        const { data: verificationHistory, error: historyError } = await supabase
            .from('user_tournament_records')
            .select('world_id_proof, verified_at')
            .eq('user_id', userData.id)
            .not('world_id_proof', 'is', null)
            .order('verified_at', { ascending: false });

        if (historyError) {
            console.error('❌ Error getting verification history:', historyError);
            return NextResponse.json({
                success: false,
                error: 'Failed to check verification history'
            } as OrbCapabilityResponse, { status: 500 });
        }

        // Look for Orb verifications in history
        const orbVerifications = verificationHistory?.filter(record => {
            const proof = record.world_id_proof as { nullifier_hash: string; verification_level?: string };
            return proof?.verification_level === 'Orb';
        }) || [];

        const hasOrbVerification = orbVerifications.length > 0;
        const lastOrbVerificationDate = orbVerifications.length > 0
            ? orbVerifications[0].verified_at
            : null;

        // User can use Orb discount if:
        // 1. They have used Orb verification before, OR
        // 2. They haven't verified yet (new users can try Orb verification)
        const canUseOrbDiscount = hasOrbVerification || verificationHistory?.length === 0;

        return NextResponse.json({
            success: true,
            data: {
                hasOrbVerification,
                lastOrbVerificationDate,
                canUseOrbDiscount
            }
        } as OrbCapabilityResponse);

    } catch (error) {
        console.error('❌ Error in orb-verification-capability API:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        } as OrbCapabilityResponse, { status: 500 });
    }
}