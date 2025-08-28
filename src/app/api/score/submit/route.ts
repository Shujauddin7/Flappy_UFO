import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

// Helper function to update user statistics
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateUserStatistics(supabase: any, userId: string, newScore: number) {
    try {
        // Get current user statistics
        const { data: currentUser, error: fetchError } = await supabase
            .from('users')
            .select('total_games_played, highest_score_ever')
            .eq('id', userId)
            .single();

        if (fetchError) {
            console.error('❌ Error fetching user stats:', fetchError);
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = {
            total_games_played: (currentUser?.total_games_played || 0) + 1
        };

        // Update highest score if this is a new ALL-TIME high score (regardless of tournament high score)
        const currentHighest = currentUser?.highest_score_ever || 0;
        if (newScore > currentHighest) {
            updates.highest_score_ever = newScore;
            console.log(`🏆 New all-time high score! ${currentHighest} -> ${newScore}`);
        }

        const { error: updateError } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId);

        if (updateError) {
            console.error('❌ Error updating user stats:', updateError);
        } else {
            console.log('✅ User statistics updated:', updates);
        }
    } catch (error) {
        console.error('❌ Error in updateUserStatistics:', error);
    }
}

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

        const { user_tournament_record_id, wallet, score, game_duration } = await req.json();

        // Validate required fields - either user_tournament_record_id OR wallet must be provided
        if ((!user_tournament_record_id && !wallet) || score === undefined || !game_duration) {
            return NextResponse.json({
                error: 'Missing required fields: (user_tournament_record_id OR wallet), score, game_duration'
            }, { status: 400 });
        }

        // Validate score (anti-cheat)
        if (score < 0 || score > 100000) {
            return NextResponse.json({
                error: 'Invalid score: must be between 0 and 100,000'
            }, { status: 400 });
        }

        // Note: Removed minimum game duration requirement as requested by user

        console.log('📊 Score submission:', {
            user_tournament_record_id,
            wallet: wallet || session.user.walletAddress,
            score,
            game_duration: game_duration + 'ms'
        });

        // Get user ID and username from users table
        const walletToCheck = wallet || session.user.walletAddress;
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, username')
            .eq('wallet', walletToCheck)
            .single();

        if (userError || !user) {
            console.error('❌ Error fetching user:', userError);
            return NextResponse.json({
                error: `User not found: ${userError?.message || 'No user found'}`
            }, { status: 404 });
        }

        console.log('👤 User found:', { id: user.id, username: user.username });

        // Prevent duplicate submissions - check if this exact score was already submitted recently
        const recentSubmission = await supabase
            .from('game_scores')
            .select('id')
            .eq('user_id', user.id)
            .eq('score', score)
            .eq('game_duration_ms', game_duration)
            .gte('submitted_at', new Date(Date.now() - 30000).toISOString()) // Within last 30 seconds
            .limit(1);

        if (recentSubmission.data && recentSubmission.data.length > 0) {
            console.log('⚠️ Duplicate submission detected, ignoring...');
            return NextResponse.json({
                success: true,
                data: {
                    message: 'Duplicate submission ignored',
                    is_duplicate: true
                }
            });
        }

        // Find the user tournament record - either by record_id or by user_id + today's date
        const today = new Date().toISOString().split('T')[0];
        let recordQuery = supabase
            .from('user_tournament_records')
            .select('id, user_id, highest_score, tournament_day, tournament_id, verified_at, verified_games_played, standard_games_played, total_games_played, verified_entry_paid, standard_entry_paid')
            .eq('user_id', user.id)
            .eq('tournament_day', today);

        if (user_tournament_record_id) {
            recordQuery = recordQuery.eq('id', user_tournament_record_id);
        }

        const { data: records, error: recordError } = await recordQuery;

        if (recordError) {
            console.error('❌ Error fetching tournament record:', recordError);
            return NextResponse.json({
                error: 'Database query failed: ' + recordError.message
            }, { status: 500 });
        }

        if (!records || records.length === 0) {
            console.error('❌ No tournament record found for user today');
            return NextResponse.json({
                error: 'No tournament entry found for today. Please make a payment first.'
            }, { status: 404 });
        }

        // Use the first (or specified) record
        const record = records[0];

        // Determine if this is a verified game based on entry type (payment amount)
        // If verified_entry_paid > 0, user paid for verified entry (0.9 WLD)
        // If standard_entry_paid > 0, user paid for standard entry (1.0 WLD)
        const isVerifiedGame = (record.verified_entry_paid || 0) > 0;

        console.log('🎮 Current tournament record:', {
            record_id: record.id,
            current_highest: record.highest_score,
            new_score: score,
            is_verified_game: isVerifiedGame,
            verified_entry_paid: record.verified_entry_paid,
            standard_entry_paid: record.standard_entry_paid,
            verified_at: record.verified_at
        });

        // First, always insert the individual score into game_scores table
        const { error: gameScoreError } = await supabase
            .from('game_scores')
            .insert({
                user_tournament_record_id: record.id,
                user_id: user.id,
                tournament_id: record.tournament_id,
                username: user.username || null, // Use the actual username from users table
                wallet: walletToCheck,
                tournament_day: today,
                score: score,
                game_duration_ms: game_duration,
                was_verified_game: isVerifiedGame, // Properly determined based on verification status
                continues_used_in_game: 0, // Default for now
                continue_payments_for_game: 0,
                submitted_at: new Date().toISOString()
            });

        if (gameScoreError) {
            console.error('❌ Error inserting game score:', gameScoreError);
            // Don't fail the entire request if we can't log the individual score
        } else {
            console.log('✅ Game score recorded with username:', user.username);
        }

        // Only update highest score if new score is higher
        if (score > record.highest_score) {
            console.log('🎉 New high score! Updating...');

            // Use the safe update function
            const { data: isUpdated, error: updateError } = await supabase
                .rpc('update_highest_score_safe', {
                    p_record_id: record.id,
                    p_new_score: score
                });

            if (updateError) {
                console.error('❌ Error updating score:', updateError);
                return NextResponse.json({
                    error: `Failed to update score: ${updateError.message}`
                }, { status: 500 });
            }

            if (isUpdated) {
                // Update game counts properly - verified vs unverified and total
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const gameCountUpdates: any = {
                    total_games_played: (record.total_games_played || 0) + 1,
                    updated_at: new Date().toISOString()
                };

                if (isVerifiedGame) {
                    gameCountUpdates.verified_games_played = (record.verified_games_played || 0) + 1;
                } else {
                    gameCountUpdates.standard_games_played = (record.standard_games_played || 0) + 1;
                }

                // Set first_game_at if this is the first game
                if ((record.total_games_played || 0) === 0) {
                    gameCountUpdates.first_game_at = new Date().toISOString();
                }

                // Always update last_game_at
                gameCountUpdates.last_game_at = new Date().toISOString();

                const { error: gameCountError } = await supabase
                    .from('user_tournament_records')
                    .update(gameCountUpdates)
                    .eq('id', record.id);

                if (gameCountError) {
                    console.error('❌ Error updating game count:', gameCountError);
                } else {
                    console.log('✅ Game counts updated:', gameCountUpdates);
                }

                // Also update user statistics (highest score, total games played)
                await updateUserStatistics(supabase, user.id, score);

                console.log('✅ Score updated successfully:', {
                    record_id: record.id,
                    old_score: record.highest_score,
                    new_score: score
                });

                return NextResponse.json({
                    success: true,
                    data: {
                        user_tournament_record_id: record.id,
                        previous_highest_score: record.highest_score,
                        current_highest_score: score,
                        is_new_high_score: true,
                        updated_at: new Date().toISOString()
                    }
                });
            }
        }

        // Score was not higher, but still update game count properly
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gameCountUpdates: any = {
            total_games_played: (record.total_games_played || 0) + 1,
            updated_at: new Date().toISOString()
        };

        if (isVerifiedGame) {
            gameCountUpdates.verified_games_played = (record.verified_games_played || 0) + 1;
        } else {
            gameCountUpdates.standard_games_played = (record.standard_games_played || 0) + 1;
        }

        // Set first_game_at if this is the first game
        if ((record.total_games_played || 0) === 0) {
            gameCountUpdates.first_game_at = new Date().toISOString();
        }

        // Always update last_game_at
        gameCountUpdates.last_game_at = new Date().toISOString();

        const { error: gameCountError } = await supabase
            .from('user_tournament_records')
            .update(gameCountUpdates)
            .eq('id', record.id);

        if (gameCountError) {
            console.error('❌ Error updating game count:', gameCountError);
        } else {
            console.log('✅ Game counts updated (non-high score):', gameCountUpdates);
        }

        // Also update user statistics (total games played only, no high score)
        await updateUserStatistics(supabase, user.id, score);

        console.log('📊 Score not higher than current record');
        return NextResponse.json({
            success: true,
            data: {
                user_tournament_record_id: record.id,
                current_highest_score: record.highest_score,
                submitted_score: score,
                is_new_high_score: false,
                message: 'Score submitted but not higher than current record'
            }
        });

    } catch (error) {
        console.error('❌ Score submission error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
