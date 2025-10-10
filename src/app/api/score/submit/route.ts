import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';
import { publishCombinedScoreUpdate } from '@/lib/redis';

// Helper function to update tournament analytics when continue payments are made
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateTournamentPrizePool(supabase: any, tournamentId: string) {
    try {
        // Get ALL payment data for this tournament
        const { data, error } = await supabase
            .from('user_tournament_records')
            .select('verified_paid_amount, standard_paid_amount, total_continue_payments')
            .eq('tournament_id', tournamentId);

        if (error) {
            console.error('❌ Error fetching tournament payments:', error);
            return;
        }

        // Calculate total revenue from ALL payments: entry payments + continue payments
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalRevenue = data?.reduce((sum: number, record: any) => {
            const entryPayments = (record.verified_paid_amount || 0) + (record.standard_paid_amount || 0);
            const continuePayments = record.total_continue_payments || 0;
            return sum + entryPayments + continuePayments;
        }, 0) || 0;

        // Simple 70/30 split - NO guarantee system for continue payments
        const adminFeeAmount = totalRevenue * 0.30; // Always 30%
        const totalPrizePool = totalRevenue * 0.70; // Always 70% - no guarantee added

        console.log('💰 Tournament totals updated after continue payment:', {
            totalRevenue,
            totalPrizePool,
            adminFeeAmount
        });

        // Update tournament with simple 70/30 split
        const { error: updateError } = await supabase
            .from('tournaments')
            .update({
                total_prize_pool: totalPrizePool,
                total_collected: totalRevenue,
                admin_fee: adminFeeAmount
            })
            .eq('id', tournamentId);

        if (updateError) {
            console.error('❌ Error updating tournament analytics:', updateError);
        } else {
            console.log('✅ Tournament analytics updated with continue payment:', {
                total_collected: totalRevenue,
                total_prize_pool: totalPrizePool,
                admin_fee: adminFeeAmount
            });
        }
    } catch (error) {
        console.error('❌ Error in updateTournamentPrizePool:', error);
    }
}

// Helper function to update user statistics safely (prevents race conditions)
async function updateUserStatistics(userId: string, newScore: number, shouldUpdateHighScore: boolean = false) {
    try {
        // Create a fresh service role client to ensure we have admin privileges
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
        const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return false;
        }

        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

        // Use atomic update to prevent race conditions - only update game stats, never verification fields
        const { error: updateError } = await adminSupabase.rpc('update_user_stats_safe', {
            p_user_id: userId,
            p_increment_games: 1,
            p_new_high_score: shouldUpdateHighScore ? newScore : null
        });

        if (updateError) {
            console.error('❌ Error updating user stats:', updateError);
            return false;
        }

        return true;
    } catch (error) {
        console.error('❌ Exception updating user stats:', error);
        return false;
    }
}

export async function POST(req: NextRequest) {
    try {
        console.log('🔥🔥🔥 SCORE API - DEPLOYED VERSION: DEC-26-2024-23:05 🔥🔥🔥');

        // Environment-specific database configuration (following Plan.md specification)
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

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

        // Get ACTIVE tournament (source of truth for tournament_id and tournament_day)
        const { data: activeTournament, error: activeTournamentError } = await supabase
            .from('tournaments')
            .select('id, tournament_day')
            .eq('is_active', true)
            .single();

        if (activeTournamentError || !activeTournament) {
            return NextResponse.json({
                error: 'No active tournament found'
            }, { status: 404 });
        }

        const tournamentDay = activeTournament.tournament_day;

        // Find the user tournament record - prefer explicit record_id, else by user_id + active tournament_id
        let recordQuery = supabase
            .from('user_tournament_records')
            .select('id, user_id, highest_score, tournament_day, tournament_id, verified_at, verified_games_played, unverified_games_played, total_games_played, verified_entry_paid, standard_entry_paid, verified_paid_at, standard_paid_at, verified_entry_games, standard_entry_games, total_continues_used, total_continue_payments, current_entry_type')
            .eq('user_id', user.id)
            .eq('tournament_id', activeTournament.id);

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
        // Prefer explicit current_entry_type if available; fallback to timestamps
        const currentEntryType: string | undefined = (record as unknown as { current_entry_type?: string }).current_entry_type;
        if (currentEntryType) {
            isVerifiedGame = currentEntryType === 'verified';
        } else if (record.verified_entry_paid && record.standard_entry_paid) {
            const verifiedTime = new Date(record.verified_paid_at || 0);
            const standardTime = new Date(record.standard_paid_at || 0);
            isVerifiedGame = verifiedTime > standardTime;
        } else if (record.verified_entry_paid) {
            isVerifiedGame = true;
        } else if (record.standard_entry_paid) {
            isVerifiedGame = false;
        } else {
            isVerifiedGame = false;
        }

        // Auto-detect if continue was used by checking tournament totals vs previous games
        const { data: previousGames, error: prevGamesError } = await supabase
            .from('game_scores')
            .select('continues_used_in_game, continue_payments_for_game')
            .eq('user_id', user.id)
            .eq('tournament_id', record.tournament_id)
            .order('submitted_at', { ascending: false });

        // Calculate continues used and payments in previous games
        let continuesUsedInPreviousGames = 0;
        let continuePaymentsInPreviousGames = 0;

        if (previousGames && !prevGamesError) {
            continuesUsedInPreviousGames = previousGames.reduce((sum, game) => sum + (game.continues_used_in_game || 0), 0);
            continuePaymentsInPreviousGames = previousGames.reduce((sum, game) => sum + (game.continue_payments_for_game || 0), 0);
        }

        // Get tournament totals
        const tournamentContinuesUsed = record.total_continues_used || 0;
        const tournamentContinuePayments = record.total_continue_payments || 0;

        // Calculate continues for this specific game
        const gameUsedContinue = tournamentContinuesUsed > continuesUsedInPreviousGames;
        const gamesContinuePayment = Math.max(0, tournamentContinuePayments - continuePaymentsInPreviousGames);

        // Use frontend data if provided, otherwise use calculated data
        // Ensure no negative values and proper defaults
        const finalContinuesUsed = used_continue !== undefined ? (used_continue ? 1 : 0) : (gameUsedContinue ? 1 : 0);
        const finalContinuePayments = continue_amount !== undefined ? continue_amount : (gamesContinuePayment > 0 ? gamesContinuePayment : 0);

        // 💰 CRITICAL FIX: Update user's continue payment total when payment is made
        if (finalContinuePayments > 0) {
            console.log('💳 Continue payment detected:', finalContinuePayments, 'WLD');

            // Update the user_tournament_records with new continue payment total
            const newContinueTotal = (record.total_continue_payments || 0) + finalContinuePayments;
            const { error: continueUpdateError } = await supabase
                .from('user_tournament_records')
                .update({
                    total_continue_payments: newContinueTotal,
                    total_continues_used: (record.total_continues_used || 0) + finalContinuesUsed,
                    updated_at: new Date().toISOString()
                })
                .eq('id', record.id);

            if (continueUpdateError) {
                console.error('❌ Failed to update continue payment total:', continueUpdateError);
                return NextResponse.json({
                    error: `Failed to record continue payment: ${continueUpdateError.message}`
                }, { status: 500 });
            }

            console.log('✅ Continue payment total updated:', newContinueTotal, 'WLD');
        }

        // First, always insert the individual score into game_scores table
        console.log('📊 Inserting game score:', {
            user_tournament_record_id: record.id,
            user_id: user.id,
            tournament_id: record.tournament_id,
            username: user.username,
            wallet: walletToCheck,
            tournament_day: tournamentDay,
            score: score,
            game_duration_ms: game_duration,
            was_verified_game: isVerifiedGame,
            entry_type: isVerifiedGame ? 'verified' : 'standard'
        });

        const { error: gameScoreError } = await supabase
            .from('game_scores')
            .insert({
                user_tournament_record_id: record.id,
                user_id: user.id,
                tournament_id: record.tournament_id,
                username: user.username || null, // Use the actual username from users table
                wallet: walletToCheck,
                tournament_day: tournamentDay,
                score: score,
                game_duration_ms: game_duration,
                was_verified_game: isVerifiedGame, // Properly determined based on entry payment
                entry_type: isVerifiedGame ? 'verified' : 'standard', // Set from current entry type when available
                continues_used_in_game: finalContinuesUsed, // 0 or 1 (max 1 per game)
                continue_payments_for_game: finalContinuePayments, // Continue cost if used
                submitted_at: new Date().toISOString()
            });

        if (gameScoreError) {
            console.error('❌ CRITICAL: Failed to insert game score:', gameScoreError);
            console.error('❌ Game score data that failed:', {
                user_tournament_record_id: record.id,
                user_id: user.id,
                tournament_id: record.tournament_id,
                score: score,
                game_duration_ms: game_duration
            });
            return NextResponse.json({
                error: `Failed to record game score: ${gameScoreError.message}`,
                debug: 'Game score insertion failed'
            }, { status: 500 });
        }

        console.log('✅ Game score inserted successfully into game_scores table');

        // Check if this is a new high score
        if (score > (record.highest_score || 0)) {
            // Update tournament record with new high score

            // Use the safe update function
            // 🔧 FIX: Use correct parameter name that matches dev database
            const { data: isUpdated, error: updateError } = await supabase
                .rpc('update_highest_score_safe', {
                    p_user_tournament_record_id: record.id,
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

                // Update user statistics with new high score (with retry for race conditions)
                let retryCount = 0;
                const maxRetries = 3;
                let statsUpdated = false;

                while (retryCount < maxRetries && !statsUpdated) {
                    statsUpdated = await updateUserStatistics(user.id, score, true);
                    if (!statsUpdated) {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            // Wait before retry (exponential backoff)
                            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
                        }
                    }
                }

                // 🚨 NEW HIGH SCORE: Update Redis leaderboard + publish realtime update (OPTIMIZED: 1 Redis call instead of 2)
                console.log('⚡ Updating Redis leaderboard and publishing score update...');
                await publishCombinedScoreUpdate(
                    tournamentDay,
                    record.tournament_id,
                    user.id,
                    score,
                    {
                        username: user.username,
                        wallet: walletToCheck,
                        old_score: record.highest_score || 0
                    }
                );

                // � CRITICAL FIX: Update tournament totals if continue payment was made (high score path)
                if (finalContinuePayments > 0) {
                    console.log('💰 Updating tournament prize pool after continue payment (high score)...');
                    await updateTournamentPrizePool(supabase, record.tournament_id);
                }

                // �🚨 NEW HIGH SCORE: Update all caches systematically
                console.log('🏆 New high score! Updating all caches systematically...');

                try {
                    const { invalidateAllTournamentCaches } = await import('@/utils/tournament-cache-helpers');
                    await invalidateAllTournamentCaches({
                        tournamentDay,

                        rewarmCache: true,
                        source: 'new_high_score'
                    });
                    console.log('✅ All caches updated for new high score');
                } catch (cacheError) {
                    console.error('❌ Cache update failed for new high score:', cacheError);
                    // Continue with the request even if caching fails
                }

                // 🔄 SYNC: Update tournament_sign_ins highest_score and total_games_played
                try {
                    await supabase
                        .from('tournament_sign_ins')
                        .upsert({
                            wallet: walletToCheck,
                            username: user.username,
                            highest_score: score
                        }, { onConflict: 'wallet', ignoreDuplicates: false });

                    // Increment total games
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { error: rpcError } = await (supabase as any).rpc?.('increment_signin_games', {
                        p_wallet: walletToCheck,
                        p_games: 1
                    });
                    if (rpcError) {
                        console.log('increment_signin_games RPC not available or failed (non-critical)');
                    }
                } catch (e) {
                    console.log('Sign-in score aggregate update skipped (non-critical):', e);
                }

                // 🎯 INSTANT RANK: Get user's new rank for immediate display
                let userRank: number | undefined;
                try {
                    const { getUserTournamentRank } = await import('@/utils/leaderboard-queries');
                    const rankData = await getUserTournamentRank(tournamentDay, walletToCheck);
                    userRank = rankData?.rank;
                    console.log('✅ User rank fetched:', userRank);
                } catch (rankError) {
                    console.warn('⚠️ Could not fetch user rank (non-critical):', rankError);
                }

                return NextResponse.json({
                    success: true,
                    data: {
                        user_tournament_record_id: record.id,
                        previous_highest_score: record.highest_score,
                        current_highest_score: score,
                        is_new_high_score: true,
                        current_rank: userRank,
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

        // Also update user statistics (total games played only, no high score) with retry
        let retryCount = 0;
        const maxRetries = 3;
        let statsUpdated = false;

        while (retryCount < maxRetries && !statsUpdated) {
            statsUpdated = await updateUserStatistics(user.id, score, false);
            if (!statsUpdated) {
                retryCount++;
                if (retryCount < maxRetries) {
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
                }
            }
        }

        // 🔄 Publish realtime score update for regular scores (OPTIMIZED: 1 Redis call instead of 2)
        console.log('📡 Publishing optimized combined score update to Socket.IO server (regular score)...');
        await publishCombinedScoreUpdate(
            tournamentDay,
            record.tournament_id,
            user.id,
            score > record.highest_score ? score : record.highest_score, // Use higher score for leaderboard
            {
                username: user.username,
                wallet: walletToCheck,
                old_score: record.highest_score || 0
            }
        );

        // � CRITICAL FIX: Update tournament totals if continue payment was made
        if (finalContinuePayments > 0) {
            console.log('💰 Updating tournament prize pool after continue payment...');
            await updateTournamentPrizePool(supabase, record.tournament_id);
        }

        // 🚀 CRITICAL FIX: Update BOTH tournament stats AND leaderboard for ALL scores
        // This ensures consistent Supabase Realtime update timing for both prize pool and player scores
        console.log('⚡ Updating ALL caches for consistent Supabase Realtime experience...');

        try {
            // CRITICAL: Force immediate cache clearing and rewarming for instant updates
            const { invalidateAllTournamentCaches } = await import('@/utils/tournament-cache-helpers');
            await invalidateAllTournamentCaches({
                tournamentDay,
                rewarmCache: true,
                source: 'score_submission_all_scores'
            });
            console.log('✅ Both tournament stats AND leaderboard updated for ALL score submissions');

            // CRITICAL: Clear ALL cache keys that could cause stale display
            const additionalCacheKeys = [
                'tournament_leaderboard_response',
                `tournament_leaderboard_response:${tournamentDay}`,
                'tournament_stats_instant',
                `leaderboard_data:${tournamentDay}`,
                `leaderboard_updates:${tournamentDay}`,
                `tournament_stats_updates:${tournamentDay}`
            ];

            const { deleteCached, setCached } = await import('@/lib/redis');
            await Promise.all(additionalCacheKeys.map(key => deleteCached(key)));

            // FORCE cache invalidation for instant Supabase Realtime updates
            await setCached(`leaderboard_updates:${tournamentDay}`, Date.now().toString(), 300);
            await setCached(`tournament_stats_updates:${tournamentDay}`, Date.now().toString(), 300);

            console.log('✅ All cache keys cleared - Supabase Realtime will handle instant cross-device updates');

        } catch (cacheError) {
            console.error('❌ Cache update failed but score recorded:', cacheError);
            // Don't fail the request if cache update fails
        }

        // 🎯 INSTANT RANK: Get user's rank for immediate display (even for non-high scores)
        let userRank: number | undefined;
        try {
            const { getUserTournamentRank } = await import('@/utils/leaderboard-queries');
            const rankData = await getUserTournamentRank(tournamentDay, walletToCheck);
            userRank = rankData?.rank;
            console.log('✅ User rank fetched:', userRank);
        } catch (rankError) {
            console.warn('⚠️ Could not fetch user rank (non-critical):', rankError);
        }

        return NextResponse.json({
            success: true,
            data: {
                user_tournament_record_id: record.id,
                current_highest_score: record.highest_score,
                submitted_score: score,
                is_new_high_score: false,
                current_rank: userRank,
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
