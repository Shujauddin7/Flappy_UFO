import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

// Helper function to update user's tournament participation count
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateUserTournamentCount(supabase: any, userId: string) {
    try {
        // Count unique tournaments this user has participated in
        const { data, error } = await supabase
            .from('user_tournament_records')
            .select('tournament_id')
            .eq('user_id', userId);

        if (error) {
            console.error('❌ Error counting user tournaments:', error);
            return;
        }

        const tournamentCount = data?.length || 0;

        // Update user with tournament count
        const { error: updateError } = await supabase
            .from('users')
            .update({
                total_tournaments_played: tournamentCount
            })
            .eq('id', userId);

        if (updateError) {
            console.error('❌ Error updating user tournament count:', updateError);
        } else {
            console.log('✅ User tournament count updated:', tournamentCount);
        }
    } catch (error) {
        console.error('❌ Error in updateUserTournamentCount:', error);
    }
}

// Helper function to update tournament player count and analytics (NEW: guarantee system per Plan.md)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateTournamentPlayerCount(supabase: any, tournamentId: string) {
    try {
        // Count unique users in user_tournament_records for this tournament and get ALL payment data
        const { data, error } = await supabase
            .from('user_tournament_records')
            .select('user_id, verified_paid_amount, standard_paid_amount, total_continue_payments')
            .eq('tournament_id', tournamentId);

        if (error) {
            console.error('❌ Error counting tournament players:', error);
            return;
        }

        const uniquePlayerCount = data?.length || 0;
        // Calculate total revenue from ALL payments: entry payments + continue payments
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalRevenue = data?.reduce((sum: number, record: any) => {
            const entryPayments = (record.verified_paid_amount || 0) + (record.standard_paid_amount || 0);
            const continuePayments = record.total_continue_payments || 0;
            return sum + entryPayments + continuePayments;
        }, 0) || 0;

        // NEW GUARANTEE SYSTEM (per Plan.md): Admin adds 1 WLD per top 10 winner when total collected < 72 WLD
        let guaranteeAmount = 0;
        const adminFeeAmount = totalRevenue * 0.30; // Always 30%
        const basePrizePool = totalRevenue * 0.70; // Always 70%

        if (totalRevenue < 72) {
            const top10Winners = Math.min(uniquePlayerCount, 10);
            guaranteeAmount = top10Winners * 1.0; // Admin adds 1 WLD per top 10 winner
        }

        const totalPrizePool = basePrizePool; // Store only base 70% in database (guarantee applied only at payout time per Plan.md)
        const adminNetResult = adminFeeAmount - guaranteeAmount; // Can be negative

        console.log('💰 NEW Guarantee system calculation:', {
            totalRevenue,
            basePrizePool: basePrizePool,
            guaranteeAmount,
            totalPrizePoolStored: totalPrizePool, // What gets stored in DB (base 70% only)
            finalPrizePoolWithGuarantee: basePrizePool + guaranteeAmount, // What admin pays (base + guarantee)
            adminFeeAmount,
            adminNetResult
        });

        // Update tournament with NEW guarantee system
        const { error: updateError } = await supabase
            .from('tournaments')
            .update({
                total_tournament_players: uniquePlayerCount, // FIXED: This is payment count, not sign-in count
                total_prize_pool: totalPrizePool,
                total_collected: totalRevenue,
                admin_fee: adminFeeAmount,
                guarantee_amount: guaranteeAmount,
                admin_net_result: adminNetResult
            })
            .eq('id', tournamentId);

        if (updateError) {
            console.error('❌ Error updating tournament analytics:', updateError);
        } else {
            console.log('✅ Tournament analytics updated with guarantee system:', {
                players: uniquePlayerCount,
                total_collected: totalRevenue,
                base_prize_pool: basePrizePool,
                guarantee_amount: guaranteeAmount,
                total_prize_pool: totalPrizePool,
                admin_fee: adminFeeAmount,
                admin_net_result: adminNetResult
            });
        }
    } catch (error) {
        console.error('❌ Error in updateTournamentPlayerCount:', error);
    }
}

export async function POST(req: NextRequest) {
    console.log('🚀 Tournament entry API called');

    try {
        // Environment-specific database configuration (following Plan.md specification)
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

        const supabaseUrl = isProduction
            ? process.env.SUPABASE_PROD_URL
            : process.env.SUPABASE_DEV_URL;

        const supabaseServiceKey = isProduction
            ? process.env.SUPABASE_PROD_SERVICE_KEY
            : process.env.SUPABASE_DEV_SERVICE_KEY;

        console.log('🔧 Environment check:', {
            environment: isProduction ? 'PRODUCTION' : 'DEVELOPMENT',
            supabaseUrl: supabaseUrl ? '✅ Set (' + supabaseUrl.substring(0, 30) + '...)' : '❌ Missing',
            serviceKey: supabaseServiceKey ? '✅ Set (length: ' + supabaseServiceKey.length + ')' : '❌ Missing'
        });

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

        const { payment_reference, paid_amount, is_verified_entry, wallet } = await req.json();

        // Validate required fields
        if (!payment_reference || !paid_amount || is_verified_entry === undefined) {
            return NextResponse.json({
                error: 'Missing required fields: payment_reference, paid_amount, is_verified_entry'
            }, { status: 400 });
        }

        // Validate wallet matches session
        if (wallet !== session.user.walletAddress) {
            return NextResponse.json({ error: 'Wallet mismatch' }, { status: 403 });
        }

        // Get current active tournament (don't create - tournaments are created via admin/create-tournament only)
        const { data: tournament, error: tournamentFetchError } = await supabase
            .from('tournaments')
            .select('id, tournament_day, start_time, end_time')
            .eq('is_active', true)
            .single();

        console.log('🔍 Tournament fetch result:', { tournament, error: tournamentFetchError });

        if (tournamentFetchError || !tournament) {
            console.error('❌ No active tournament found:', tournamentFetchError);
            return NextResponse.json({
                error: 'No active tournament found. Please contact support at flappyufo.help@gmail.com.',
                details: tournamentFetchError?.message || 'No tournament available'
            }, { status: 404 });
        }

        // 🔥 CRITICAL: Grace Period Validation (per Plan.md)
        // During grace period (15:00-15:30 UTC Sunday), reject NEW entries but allow existing players to continue
        const currentTime = new Date();
        const tournamentEndTime = new Date(tournament.end_time);
        const gracePeriodStart = new Date(tournamentEndTime.getTime() - 30 * 60 * 1000); // 30 minutes before end
        const isGracePeriod = currentTime >= gracePeriodStart && currentTime < tournamentEndTime;

        if (isGracePeriod) {
            console.log('⏰ Grace period detected - rejecting new tournament entry:', {
                current_time: currentTime.toISOString(),
                grace_period_start: gracePeriodStart.toISOString(),
                tournament_end: tournamentEndTime.toISOString(),
                is_grace_period: isGracePeriod
            });

            return NextResponse.json({
                error: 'Tournament is in grace period. No new entries allowed.',
                details: 'Tournament ends soon. Existing players can finish their games, but new entries are not permitted.'
            }, { status: 403 });
        }

        const finalTournament = tournament;

        // Get user ID and current verification status from users table, create if doesn't exist
        console.log('👤 Looking for user with wallet:', wallet);
        let user;

        const userFetchResult = await supabase
            .from('users')
            .select('id, last_verified_date, last_verified_tournament_id, username, world_id')
            .eq('wallet', wallet)
            .single();

        user = userFetchResult.data;
        const userError = userFetchResult.error;

        console.log('👤 User fetch result:', { user, error: userError });

        // If user doesn't exist, create them
        if (userError && userError.code === 'PGRST116') {
            console.log('👤 User not found, creating new user...');

            // Get username from session if available
            const usernameFromSession = session?.user?.username || null;

            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert({
                    wallet: wallet,
                    username: usernameFromSession, // Use session username
                    world_id: null,
                    total_tournaments_played: 0,
                    total_games_played: 0,
                    highest_score_ever: 0
                })
                .select('id, last_verified_date, last_verified_tournament_id, username, world_id')
                .single();

            if (createError) {
                console.error('❌ Error creating user:', createError);
                return NextResponse.json({
                    error: `Failed to create user: ${createError.message}`
                }, { status: 500 });
            }

            user = newUser;
            console.log('✅ New user created:', user);
        } else if (userError) {
            console.error('❌ Error fetching user:', userError);
            return NextResponse.json({
                error: `User database error: ${userError.message}`
            }, { status: 500 });
        }

        if (!user) {
            console.error('❌ Failed to get or create user');
            return NextResponse.json({
                error: 'User setup failed'
            }, { status: 500 });
        }

        // Update username if user exists but has no username and session has one
        if (!user.username && session?.user?.username) {
            console.log('👤 Updating user username from session...');
            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({ username: session.user.username })
                .eq('id', user.id)
                .select('id, last_verified_date, last_verified_tournament_id, username, world_id')
                .single();

            if (!updateError && updatedUser) {
                user = updatedUser;
                console.log('✅ User username updated:', user.username);
            }
        }

        // Check verification status - user must be verified for today's tournament
        // Check if user is verified for this tournament (verification is tournament-specific)
        const actuallyVerified = !!(user.last_verified_date === finalTournament.tournament_day &&
            user.last_verified_tournament_id === finalTournament.id);

        console.log('🔍 Verification check:', {
            frontend_says_verified: is_verified_entry,
            user_last_verified_date: user.last_verified_date,
            user_last_verified_tournament: user.last_verified_tournament_id,
            current_tournament_id: finalTournament.id,
            tournament_day: finalTournament.tournament_day,
            final_verification_status: actuallyVerified
        });

        // Create or get user tournament record (single row per user per tournament)
        console.log('🎮 Getting or creating user tournament record:', {
            user_id: user.id,
            tournament_id: finalTournament.id,
            tournament_day: finalTournament.tournament_day,
            is_verified_entry: actuallyVerified,
            paid_amount,
            payment_reference
        });

        // Create or get user tournament record using UPSERT to prevent duplicate key issues
        // Don't use the database function as it uses CURRENT_DATE instead of tournament boundary logic
        const { data: tournamentRecord, error: recordError } = await supabase
            .from('user_tournament_records')
            .upsert({
                user_id: user.id,
                tournament_id: finalTournament.id,
                username: user.username,
                wallet: wallet,
                tournament_day: finalTournament.tournament_day, // Use the active tournament date
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,tournament_id',
                ignoreDuplicates: false // Update existing record
            })
            .select('id')
            .single();

        if (recordError) {
            console.error('❌ Error upserting tournament record:', recordError);
            return NextResponse.json({
                error: `Failed to create/update tournament record: ${recordError.message}`
            }, { status: 500 });
        }

        const recordId = tournamentRecord.id;
        console.log('✅ Tournament record created/updated:', recordId, 'with username:', user.username);

        // Now update the payment information (preserve existing payments)
        // First get current payment status to avoid overwriting existing payments
        const { data: currentRecord, error: fetchError } = await supabase
            .from('user_tournament_records')
            .select('verified_entry_paid, verified_paid_amount, verified_payment_ref, verified_paid_at, standard_entry_paid, standard_paid_amount, standard_payment_ref, standard_paid_at, current_entry_type')
            .eq('id', recordId)
            .single();

        if (fetchError) {
            console.error('❌ Error fetching current payment status:', fetchError);
            return NextResponse.json({
                error: `Failed to fetch current payment status: ${fetchError.message}`
            }, { status: 500 });
        }

        // Determine entry type based on PAYMENT AMOUNT
        // 0.9 WLD = Verified entry (discounted price)
        // 1.0+ WLD = Standard entry (regular price)
        const isVerifiedEntryByAmount = paid_amount <= 0.9;

        const paymentUpdate: {
            updated_at: string;
            verified_entry_paid?: boolean;
            verified_paid_amount?: number;
            verified_payment_ref?: string;
            verified_paid_at?: string;
            standard_entry_paid?: boolean;
            standard_paid_amount?: number;
            standard_payment_ref?: string;
            standard_paid_at?: string;
            current_entry_type?: string;
        } = {
            updated_at: new Date().toISOString()
        };

        if (isVerifiedEntryByAmount) {
            // Update verified payment fields while preserving standard payment
            paymentUpdate.verified_entry_paid = true;
            // ACCUMULATE payments instead of overwriting
            paymentUpdate.verified_paid_amount = (currentRecord.verified_paid_amount || 0) + paid_amount;
            paymentUpdate.verified_payment_ref = payment_reference; // Store latest payment reference
            paymentUpdate.verified_paid_at = new Date().toISOString();
            paymentUpdate.current_entry_type = 'verified';

            // Preserve existing standard payment fields
            if (currentRecord.standard_entry_paid) {
                paymentUpdate.standard_entry_paid = currentRecord.standard_entry_paid;
                paymentUpdate.standard_paid_amount = currentRecord.standard_paid_amount;
                paymentUpdate.standard_payment_ref = currentRecord.standard_payment_ref;
                paymentUpdate.standard_paid_at = currentRecord.standard_paid_at;
            }
        } else {
            // Update standard payment fields while preserving verified payment
            paymentUpdate.standard_entry_paid = true;
            // ACCUMULATE payments instead of overwriting
            paymentUpdate.standard_paid_amount = (currentRecord.standard_paid_amount || 0) + paid_amount;
            paymentUpdate.standard_payment_ref = payment_reference; // Store latest payment reference
            paymentUpdate.standard_paid_at = new Date().toISOString();
            paymentUpdate.current_entry_type = 'standard';

            // Preserve existing verified payment fields
            if (currentRecord.verified_entry_paid) {
                paymentUpdate.verified_entry_paid = currentRecord.verified_entry_paid;
                paymentUpdate.verified_paid_amount = currentRecord.verified_paid_amount;
                paymentUpdate.verified_payment_ref = currentRecord.verified_payment_ref;
                paymentUpdate.verified_paid_at = currentRecord.verified_paid_at;
            }
        }

        const { data: updatedRecord, error: updateError } = await supabase
            .from('user_tournament_records')
            .update(paymentUpdate)
            .eq('id', recordId)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Error updating payment info:', updateError);
            return NextResponse.json({
                error: `Failed to update payment information: ${updateError.message}`
            }, { status: 500 });
        }

        // Update tournament total players count and prize pool after payment update
        await updateTournamentPlayerCount(supabase, finalTournament.id);

        // Update user's total tournament count
        await updateUserTournamentCount(supabase, user.id);

        console.log('✅ Tournament record created/updated successfully:', {
            record_id: recordId,
            tournament_id: finalTournament.id,
            user_id: user.id,
            paid_amount,
            is_verified_entry: actuallyVerified,
            verification_details: {
                frontend_claimed: is_verified_entry,
                database_verified: actuallyVerified,
                user_last_verified_date: user.last_verified_date,
                tournament_date: finalTournament.tournament_day
            }
        });

        // 🔄 SYNC: Update tournament_sign_ins aggregates (no fake data; real user-only)
        try {
            // Check if sign-in row exists
            const { data: signInRow } = await supabase
                .from('tournament_sign_ins')
                .select('wallet, total_tournaments_visited, total_amount_paid, first_tournament_id')
                .eq('wallet', wallet)
                .single();

            if (!signInRow) {
                // Create initial row
                await supabase
                    .from('tournament_sign_ins')
                    .insert({
                        wallet,
                        username: user.username,
                        world_id: user.world_id || 'unknown',
                        first_tournament_id: finalTournament.id,
                        total_tournaments_visited: 1,
                        total_amount_paid: paid_amount
                    });
            } else {
                await supabase
                    .from('tournament_sign_ins')
                    .update({
                        total_tournaments_visited: (signInRow.total_tournaments_visited || 0) + 1,
                        total_amount_paid: (Number(signInRow.total_amount_paid) || 0) + Number(paid_amount),
                        first_tournament_id: signInRow.first_tournament_id || finalTournament.id,
                        username: user.username
                    })
                    .eq('wallet', wallet);
            }
        } catch (e) {
            console.log('Sign-in aggregates update skipped (non-critical):', e);
        }

        // 🚨 INSTANT SSE BROADCAST: New tournament entry affects prize pool + total players
        console.log('📡 Broadcasting tournament stats update via SSE (new player joined)...');
        try {
            const { setCached } = await import('@/lib/redis');
            const updateKey = `tournament_stats_updates:${finalTournament.tournament_day}`;
            await setCached(updateKey, Date.now().toString(), 300); // 5 min TTL
            console.log('✅ Tournament stats SSE trigger set - all users will see updated prize pool & total players');
        } catch (sseError) {
            console.log('Tournament stats SSE trigger failed (non-critical):', sseError);
        }

        return NextResponse.json({
            success: true,
            data: {
                user_tournament_record_id: recordId,
                tournament_id: finalTournament.id,
                paid_amount: paid_amount,
                is_verified_entry: actuallyVerified,
                created_at: updatedRecord.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Tournament entry creation error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
