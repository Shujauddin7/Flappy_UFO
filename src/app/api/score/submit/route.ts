import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    console.log('🎯 Score submission API called');

    try {
        // Environment-specific database configuration
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

        // Initialize Supabase client with environment-specific credentials
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get session using the new auth() function
        const session = await auth();
        if (!session?.user?.walletAddress) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { entry_id, score, game_duration } = await req.json();

        // Validate required fields
        if (!entry_id || score === undefined || !game_duration) {
            return NextResponse.json({
                error: 'Missing required fields: entry_id, score, game_duration'
            }, { status: 400 });
        }

        // Validate score (anti-cheat)
        if (score < 0 || score > 999) {
            return NextResponse.json({
                error: 'Invalid score: must be between 0 and 999'
            }, { status: 400 });
        }

        // Validate game duration (anti-cheat - minimum 5 seconds)
        if (game_duration < 5000) { // 5000ms = 5 seconds
            return NextResponse.json({
                error: 'Invalid game duration: minimum 5 seconds required'
            }, { status: 400 });
        }

        console.log('📊 Score submission:', {
            entry_id,
            wallet: session.user.walletAddress,
            score,
            game_duration: game_duration + 'ms'
        });

        // Get user ID from users table
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', session.user.walletAddress)
            .single();

        if (userError || !user) {
            console.error('❌ Error fetching user:', userError);
            return NextResponse.json({
                error: `User not found: ${userError?.message || 'No user found'}`
            }, { status: 404 });
        }

        // Verify entry belongs to this user and is from today
        const today = new Date().toISOString().split('T')[0];
        const { data: entry, error: entryError } = await supabase
            .from('entries')
            .select('id, user_id, highest_score, tournament_day')
            .eq('id', entry_id)
            .eq('user_id', user.id)
            .eq('tournament_day', today)
            .single();

        if (entryError || !entry) {
            console.error('❌ Error fetching entry:', entryError);
            return NextResponse.json({
                error: 'Entry not found or does not belong to authenticated user'
            }, { status: 404 });
        }

        console.log('🎮 Current entry:', {
            entry_id: entry.id,
            current_highest: entry.highest_score,
            new_score: score
        });

        // Only update if new score is higher
        if (score > entry.highest_score) {
            console.log('🎉 New high score! Updating...');
            
            const { data: updatedEntry, error: updateError } = await supabase
                .from('entries')
                .update({
                    highest_score: score,
                    updated_at: new Date().toISOString()
                })
                .eq('id', entry_id)
                .eq('user_id', user.id)
                .select()
                .single();

            if (updateError) {
                console.error('❌ Error updating score:', updateError);
                return NextResponse.json({
                    error: `Failed to update score: ${updateError.message}`
                }, { status: 500 });
            }

            console.log('✅ Score updated successfully:', {
                entry_id,
                old_score: entry.highest_score,
                new_score: score
            });

            return NextResponse.json({
                success: true,
                data: {
                    entry_id,
                    previous_highest: entry.highest_score,
                    new_highest: score,
                    is_new_record: true,
                    updated_at: updatedEntry.updated_at
                }
            });
        } else {
            console.log('📊 Score not higher than current record');
            return NextResponse.json({
                success: true,
                data: {
                    entry_id,
                    current_highest: entry.highest_score,
                    submitted_score: score,
                    is_new_record: false,
                    message: 'Score submitted but not higher than current record'
                }
            });
        }

    } catch (error) {
        console.error('❌ Score submission error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
