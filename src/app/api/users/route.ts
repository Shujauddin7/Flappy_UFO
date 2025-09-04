import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    try {
        const { wallet, username, world_id } = await request.json();

        console.log('📊 Creating/updating user:', { wallet, username, world_id });

        if (!wallet) {
            return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
        }

        // Environment-specific database configuration (improved detection)
        // Environment-specific database configuration (following Plan.md specification)
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

        const supabaseUrl = isProduction
            ? process.env.SUPABASE_PROD_URL
            : process.env.SUPABASE_DEV_URL;

        const supabaseServiceKey = isProduction
            ? process.env.SUPABASE_PROD_SERVICE_KEY
            : process.env.SUPABASE_DEV_SERVICE_KEY;

        console.log('🔧 Environment check:', {
            NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
            NODE_ENV: process.env.NODE_ENV,
            VERCEL_ENV: process.env.VERCEL_ENV,
            VERCEL_URL: process.env.VERCEL_URL,
            detectedEnvironment: isProduction ? 'PRODUCTION' : 'DEVELOPMENT',
            supabaseUrl: supabaseUrl ? '✅ Set' : '❌ Missing',
            serviceKey: supabaseServiceKey ? '✅ Set' : '❌ Missing'
        });

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('❌ Missing environment variables for', isProduction ? 'PRODUCTION' : 'DEVELOPMENT');
            return NextResponse.json({
                error: `Server configuration error: Missing ${isProduction ? 'production' : 'development'} database credentials`
            }, { status: 500 });
        }

        // Use service key for admin operations
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check if user exists first
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('wallet')
            .eq('wallet', wallet)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
            console.error('❌ Error checking existing user:', checkError);
            return NextResponse.json({
                error: `Database check failed: ${checkError.message}`
            }, { status: 500 });
        }

        let data, error;

        if (existingUser) {
            // User exists - only update username, preserve stats and world_id
            const updateData: { updated_at: string; username?: string | null } = {
                updated_at: new Date().toISOString()
            };
            if (username !== undefined) updateData.username = username;
            // Do NOT update world_id here - it should only be set during verification

            const result = await supabase
                .from('users')
                .update(updateData)
                .eq('wallet', wallet)
                .select();

            data = result.data;
            error = result.error;
            console.log('✅ Updated existing user (preserved stats)');
        } else {
            // User doesn't exist - create new user with initial stats
            const result = await supabase
                .from('users')
                .insert({
                    wallet: wallet,
                    username: username || null,
                    world_id: world_id || null,
                    total_tournaments_played: 0,
                    total_games_played: 0,
                    highest_score_ever: 0,
                    updated_at: new Date().toISOString()
                })
                .select();

            data = result.data;
            error = result.error;
            console.log('✅ Created new user with initial stats');
        }

        if (error) {
            console.error('❌ Database error:', error);
            return NextResponse.json({
                error: `Database operation failed: ${error.message}`
            }, { status: 500 });
        }

        console.log('✅ User operation completed successfully:', data);
        return NextResponse.json({ success: true, user: data?.[0] || null });

    } catch (error) {
        console.error('❌ API route error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}