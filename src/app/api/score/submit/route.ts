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

        const { user_tournament_record_id, wallet, score, game_duration, used_continue, continue_amount } = await req.json();
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

        // Get user ID and username from users table
        const walletToCheck = wallet || session.user.walletAddress;
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, username')
            .eq('wallet', walletToCheck)
            .single();

        if (userError || !user) {
            return NextResponse.json({
                error: `User not found: ${userError?.message || 'No user found'}`
            }, { status: 404 });
        }

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
            return NextResponse.json({
                success: false,
                error: 'Duplicate submission',
                data: { is_duplicate: true }
            });
        }

        // Find the user tournament record - either by record_id or by user_id + today's date
        const today = new Date().toISOString().split('T')[0];
        let recordQuery = supabase
            .from('user_tournament_records')
            .select('id, user_id, highest_score, tournament_day, tournament_id, verified_at, verified_games_played, unverified_games_played, total_games_played, verified_entry_paid, standard_entry_paid, verified_paid_at, standard_paid_at, verified_entry_games, standard_entry_games, total_continues_used, total_continue_payments')
            .eq('user_id', user.id)
            .eq('tournament_day', today);

        if (user_tournament_record_id) {
            recordQuery = recordQuery.eq('id', user_tournament_record_id);
        }

        const { data: records, error: recordError } = await recordQuery;

        if (recordError) {
            return NextResponse.json({
                error: `Database error: ${recordError.message}`
            }, { status: 500 });
        }

        if (!records || records.length === 0) {
            return NextResponse.json({
                error: 'Tournament entry not found. Please pay entry fee first.'
            }, { status: 404 });
        }

        // Use the first (or specified) record
        const record = records[0];

        // Determine if this is a verified game based on MOST RECENT entry payment
        // If user paid for both entries, use the most recent one based on timestamps
        let isVerifiedGame = false;

        if (record.verified_entry_paid && record.standard_entry_paid) {
            // Both paid - check which was more recent
            const verifiedTime = new Date(record.verified_paid_at || 0);
            const standardTime = new Date(record.standard_paid_at || 0);
            isVerifiedGame = verifiedTime > standardTime;
        } else if (record.verified_entry_paid) {
            // Only verified paid
            isVerifiedGame = true;
        } else if (record.standard_entry_paid) {
            // Only standard paid  
            isVerifiedGame = false;
        } else {
            // No payment found - shouldn't happen but default to false
            isVerifiedGame = false;
        }

        // Auto-detect if continue was used by checking tournament totals vs previous games
        const { data: previousGames, error: prevGamesError } = await supabase
            .from('game_scores')
            .select('continues_used_in_game')
            .eq('user_id', user.id)
            .eq('tournament_id', record.tournament_id)
            .order('submitted_at', { ascending: false });

        // Calculate continues used in previous games
        let continuesUsedInPreviousGames = 0;
        if (previousGames && !prevGamesError) {
            continuesUsedInPreviousGames = previousGames.reduce((sum, game) => sum + (game.continues_used_in_game || 0), 0);
        }

        // If tournament total > previous games total, then this game used a continue
        const tournamentContinuesUsed = record.total_continues_used || 0;
        const gameUsedContinue = tournamentContinuesUsed > continuesUsedInPreviousGames;

        // Calculate continue amount for this game
        const tournamentContinuePayments = record.total_continue_payments || 0;
        let continuePaymentsInPreviousGames = 0;
        if (previousGames && !prevGamesError) {
            const { data: previousPayments } = await supabase
                .from('game_scores')
                .select('continue_payments_for_game')
                .eq('user_id', user.id)
                .eq('tournament_id', record.tournament_id)
                .order('submitted_at', { ascending: false });

            if (previousPayments) {
                continuePaymentsInPreviousGames = previousPayments.reduce((sum, game) => sum + (game.continue_payments_for_game || 0), 0);
            }
        }

        const gamesContinuePayment = tournamentContinuePayments - continuePaymentsInPreviousGames;

        // Use frontend data if provided, otherwise use auto-detected data
        const finalContinuesUsed = used_continue !== undefined ? (used_continue ? 1 : 0) : (gameUsedContinue ? 1 : 0);
        const finalContinuePayments = continue_amount || gamesContinuePayment;

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
                was_verified_game: isVerifiedGame, // Properly determined based on entry payment
                entry_type: isVerifiedGame ? 'verified' : 'standard', // NEW: Set the clear entry type
                continues_used_in_game: finalContinuesUsed, // 0 or 1 (max 1 per game)
                continue_payments_for_game: finalContinuePayments, // Continue cost if used
                submitted_at: new Date().toISOString()
            });

        if (gameScoreError) {
            // Don't fail the entire request if we can't log the individual score
        }

        // Check if this is a new high score
        if (score > (record.highest_score || 0)) {
            // Update tournament record with new high score

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
                    gameCountUpdates.verified_entry_games = (record.verified_entry_games || 0) + 1;
                } else {
                    gameCountUpdates.unverified_games_played = (record.unverified_games_played || 0) + 1;
                    gameCountUpdates.standard_entry_games = (record.standard_entry_games || 0) + 1;
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
                    // Game count update failed, but don't fail the whole request
                }

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
            gameCountUpdates.verified_entry_games = (record.verified_entry_games || 0) + 1;
        } else {
            gameCountUpdates.unverified_games_played = (record.unverified_games_played || 0) + 1;
            gameCountUpdates.standard_entry_games = (record.standard_entry_games || 0) + 1;
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
            // Game count update failed, but don't fail the whole request
        }

        // Also update user statistics (total games played only, no high score)
        await updateUserStatistics(supabase, user.id, score);

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
