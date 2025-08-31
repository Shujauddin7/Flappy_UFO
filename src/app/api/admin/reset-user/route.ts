import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * ADMIN ONLY: Reset a user's verification status and tournament records
 * This helps when testing or when a user needs to start fresh
 */
export async function POST(req: NextRequest) {
    try {
        const { wallet } = await req.json();

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

        // 1. Clear user verification status
        const { error: clearVerificationError } = await supabase
            .from('users')
            .update({
                last_verified_date: null,
                last_verified_tournament_id: null
            })
            .eq('wallet', wallet);

        if (clearVerificationError) {
            console.error('❌ Error clearing user verification:', clearVerificationError);
        } else {
            console.log('✅ User verification status cleared');
        }

        // 2. Delete user tournament records for today (fresh start)
        const today = new Date().toISOString().split('T')[0];
        const { error: deleteRecordsError } = await supabase
            .from('user_tournament_records')
            .delete()
            .eq('wallet', wallet)
            .eq('tournament_day', today);

        if (deleteRecordsError) {
            console.error('❌ Error deleting tournament records:', deleteRecordsError);
        } else {
            console.log('✅ Tournament records deleted for today');
        }

        // 3. Delete game scores for today (fresh start)
        const { error: deleteScoresError } = await supabase
            .from('game_scores')
            .delete()
            .eq('wallet', wallet)
            .eq('tournament_day', today);

        if (deleteScoresError) {
            console.error('❌ Error deleting game scores:', deleteScoresError);
        } else {
            console.log('✅ Game scores deleted for today');
        }

        console.log('✅ User reset completed for wallet:', wallet);

        return NextResponse.json({
            success: true,
            data: {
                wallet,
                reset: true,
                message: 'User verification and tournament data reset successfully'
            }
        });

    } catch (error) {
        console.error('❌ Error in reset-user API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
