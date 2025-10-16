import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { publishPlayerJoined, publishPrizePoolUpdate } from '@/lib/redis';
import { validatePaymentAmount } from '@/constants/payments';
import { checkRateLimit, getTournamentEntryLimiter } from '@/utils/rate-limit';

// Helper function to update user's tournament participation count
async function updateUserTournamentCount(supabase: SupabaseClient, userId: string) {
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
        }
    } catch (error) {
        console.error('❌ Error in updateUserTournamentCount:', error);
    }
}

// Fallback helper to manually update prize pool if trigger fails
async function updateTournamentPlayerCountFallback(supabase: SupabaseClient, tournamentId: string) {
    try {
        const { data, error } = await supabase
            .from('user_tournament_records')
            .select('user_id, verified_paid_amount, standard_paid_amount, total_continue_payments')
            .eq('tournament_id', tournamentId);

        if (error) {
            console.error('❌ Error counting for fallback:', error);
            return;
        }

        const uniquePlayerCount = data?.length || 0;
        const totalRevenue = data?.reduce((sum: number, record: { verified_paid_amount?: number; standard_paid_amount?: number; total_continue_payments?: number }) => {
            const entryPayments = (record.verified_paid_amount || 0) + (record.standard_paid_amount || 0);
            const continuePayments = record.total_continue_payments || 0;
            return sum + entryPayments + continuePayments;
        }, 0) || 0;

        let guaranteeAmount = 0;
        const adminFeeAmount = totalRevenue * 0.30;
        const basePrizePool = totalRevenue * 0.70;

        if (totalRevenue < 72) {
            const top10Winners = Math.min(uniquePlayerCount, 10);
            guaranteeAmount = top10Winners * 1.0;
        }

        const totalPrizePool = basePrizePool;
        const adminNetResult = adminFeeAmount - guaranteeAmount;

        await supabase
            .from('tournaments')
            .update({
                total_tournament_players: uniquePlayerCount,
                total_prize_pool: totalPrizePool,
                total_collected: totalRevenue,
                admin_fee: adminFeeAmount,
                guarantee_amount: guaranteeAmount,
                admin_net_result: adminNetResult
            })
            .eq('id', tournamentId);
    } catch (error) {
        console.error('❌ Fallback update error:', error);
    }
}

export async function POST(req: NextRequest) {
    try {
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

        // Initialize Supabase client with environment-specific credentials
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get session using the new auth() function
        const session = await auth();
        if (!session?.user?.walletAddress) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        // Rate limiting: 5 tournament entries per minute per user
        const rateLimitResult = await checkRateLimit(
            session.user.walletAddress,
            getTournamentEntryLimiter()
        );

        if (!rateLimitResult.success) {
            return NextResponse.json({
                error: 'Too many tournament entry attempts. Please wait before trying again.',
                limit: rateLimitResult.limit,
                remaining: rateLimitResult.remaining,
                reset: rateLimitResult.reset
            }, {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': rateLimitResult.limit.toString(),
                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                    'X-RateLimit-Reset': rateLimitResult.reset.toString(),
                }
            });
        }

        const { payment_reference, paid_amount, is_verified_entry, wallet } = await req.json();

        // Validate required fields
        if (!payment_reference || !paid_amount || is_verified_entry === undefined) {
            return NextResponse.json({
                error: 'Missing required fields: payment_reference, paid_amount, is_verified_entry'
            }, { status: 400 });
        }

        // Validate payment amount against server-side constants
        const paymentValidation = validatePaymentAmount(paid_amount, is_verified_entry, false);
        if (!paymentValidation.valid) {
            return NextResponse.json({
                error: `Invalid payment amount. Expected ${paymentValidation.expected} WLD, received ${paid_amount} WLD`,
                expected_amount: paymentValidation.expected
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
            return NextResponse.json({
                error: 'Tournament is in grace period. No new entries allowed.',
                details: 'Tournament ends soon. Existing players can finish their games, but new entries are not permitted.'
            }, { status: 403 });
        }

        const finalTournament = tournament;

        // Get user ID and current verification status from users table, create if doesn't exist
        let user;

        const userFetchResult = await supabase
            .from('users')
            .select('id, last_verified_date, last_verified_tournament_id, username, world_id')
            .eq('wallet', wallet)
            .single();

        user = userFetchResult.data;
        const userError = userFetchResult.error;

        // If user doesn't exist, create them
        if (userError && userError.code === 'PGRST116') {
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
            const { data: updatedUser, error: updateError } = await supabase
                .from('users')
                .update({ username: session.user.username })
                .eq('id', user.id)
                .select('id, last_verified_date, last_verified_tournament_id, username, world_id')
                .single();

            if (!updateError && updatedUser) {
                user = updatedUser;
            }
        }

        // Check verification status - user must be verified for today's tournament
        // Check if user is verified for this tournament (verification is tournament-specific)
        const actuallyVerified = !!(user.last_verified_date === finalTournament.tournament_day &&
            user.last_verified_tournament_id === finalTournament.id);

        // Create or get user tournament record (single row per user per tournament)
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

        // Database trigger updates tournament stats automatically
        // Fallback: Also call manual update to ensure it works if trigger fails (DEV safety)
        await updateTournamentPlayerCountFallback(supabase, finalTournament.id);

        // 🔄 NEW: Publish realtime updates to Socket.IO server
        // Publish player joined event
        await publishPlayerJoined(finalTournament.id, {
            user_id: user.id,
            username: user.username || `Player ${user.id.slice(0, 8)}`,
            entry_type: isVerifiedEntryByAmount ? 'verified' : 'standard'
        });

        // Get updated tournament data for prize pool update
        const updatedTournament = await supabase
            .from('tournaments')
            .select('total_prize_pool, total_tournament_players')
            .eq('id', finalTournament.id)
            .single();

        if (updatedTournament.data) {
            await publishPrizePoolUpdate(finalTournament.id, {
                new_prize_pool: updatedTournament.data.total_prize_pool || 0,
                total_players: updatedTournament.data.total_tournament_players || 0,
                increment_amount: paid_amount
            });
        }

        // Update user's total tournament count
        await updateUserTournamentCount(supabase, user.id);

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
        } catch {
        }

        // 🚨 INSTANT SSE BROADCAST: New tournament entry affects prize pool + total players
        try {
            const { invalidateTournamentStatsCache } = await import('@/utils/tournament-cache-helpers');
            await invalidateTournamentStatsCache({
                tournamentDay: finalTournament.tournament_day,
                rewarmCache: true,
                source: 'new_tournament_entry'
            });
        } catch {
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
