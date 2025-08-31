import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Clear user verification status (for development/testing)
 * This is called when DevSignOut is used to reset verification
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

        // Clear verification status for this user (atomic operation)
        const { error } = await supabase
            .from('users')
            .update({
                last_verified_date: null,
                last_verified_tournament_id: null,
                updated_at: new Date().toISOString() // Always update timestamp
            })
            .eq('wallet', wallet);

        if (error) {
            console.error('❌ Error clearing verification status:', error);
            return NextResponse.json({
                success: false,
                error: 'Failed to clear verification status'
            }, { status: 500 });
        }

        console.log('✅ Verification status cleared for wallet:', wallet);

        return NextResponse.json({
            success: true,
            data: { cleared: true, wallet: wallet }
        });

    } catch (error) {
        console.error('❌ Error in clear-verification API:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
