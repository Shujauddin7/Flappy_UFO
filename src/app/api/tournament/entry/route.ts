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

// Helper function to update tournament player count and analytics (total_collected, admin_fee, protection_level)
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

        // Calculate protection level based on WLD amount collected (as per Plan.md)
        let prizePoolPercentage: number;
        let adminFeePercentage: number;
        let protectionLevelNumber: number;

        if (totalRevenue >= 72) {
            prizePoolPercentage = 70;
            adminFeePercentage = 30;
            protectionLevelNumber = 1;
        } else if (totalRevenue >= 30) {
            prizePoolPercentage = 85;
            adminFeePercentage = 15;
            protectionLevelNumber = 2;
        } else {
            prizePoolPercentage = 95;
            adminFeePercentage = 5;
            protectionLevelNumber = 3;
        }

        const totalPrizePool = totalRevenue * (prizePoolPercentage / 100);
        const adminFeeAmount = totalRevenue * (adminFeePercentage / 100);

        console.log('💰 Tournament analytics update:', {
            totalRevenue,
            totalPrizePool,
            adminFeeAmount,
            protectionLevel: protectionLevelNumber,
            entries: data?.length
        });

        // Update tournament with all analytics
        const { error: updateError } = await supabase
            .from('tournaments')
            .update({
                total_players: uniquePlayerCount,
                total_prize_pool: totalPrizePool,
                total_collected: totalRevenue,
                admin_fee: adminFeeAmount,
                protection_level: protectionLevelNumber
            })
            .eq('id', tournamentId);

        if (updateError) {
            console.error('❌ Error updating tournament analytics:', updateError);
        } else {
            console.log('✅ Tournament analytics updated:', {
                players: uniquePlayerCount,
                prize_pool: totalPrizePool,
                total_collected: totalRevenue,
                admin_fee: adminFeeAmount,
                protection_level: protectionLevelNumber
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

        // GRACE PERIOD VALIDATION - Check if we're in the Sunday grace period (15:00-15:30 UTC)
        const currentTime = new Date();
        const currentUtcDay = currentTime.getUTCDay(); // 0 = Sunday
        const currentUtcHour = currentTime.getUTCHours();
        const currentUtcMinute = currentTime.getUTCMinutes();

        // Grace period: Sunday 15:00-15:30 UTC (no new entries allowed)
        const isGracePeriod = currentUtcDay === 0 && currentUtcHour === 15 && currentUtcMinute >= 0 && currentUtcMinute < 30;

        if (isGracePeriod) {
            console.log('🚫 Tournament entry blocked - Grace period active:', {
                utc_time: currentTime.toISOString(),
                utc_day: currentUtcDay,
                utc_hour: currentUtcHour,
                utc_minute: currentUtcMinute
            });
            return NextResponse.json({
                error: 'Tournament entries are closed during the grace period',
                message: 'New entries are not allowed during Sunday 15:00-15:30 UTC while prizes are being calculated',
                grace_period: true,
                retry_after: '15:30 UTC Sunday'
            }, { status: 423 }); // 423 Locked status code
        }

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

        // Get or create current week's tournament using same logic as weekly-cron
        // Tournament week starts at 15:30 UTC Sunday, so if it's before 15:30, use last week's Sunday
        const tournamentTime = new Date();
        const tournamentUtcHour = tournamentTime.getUTCHours();
        const tournamentUtcMinute = tournamentTime.getUTCMinutes();

        const tournamentDate = new Date(tournamentTime);
        if (tournamentUtcHour < 15 || (tournamentUtcHour === 15 && tournamentUtcMinute < 30)) {
            tournamentDate.setUTCDate(tournamentDate.getUTCDate() - 1);
        }

        // Get the Sunday of this week for tournament_day
        const dayOfWeek = tournamentDate.getUTCDay(); // 0 = Sunday
        const daysToSubtract = dayOfWeek; // Days since last Sunday
        const tournamentSunday = new Date(tournamentDate);
        tournamentSunday.setUTCDate(tournamentDate.getUTCDate() - daysToSubtract);

        const today = tournamentSunday.toISOString().split('T')[0];
        console.log('🔍 Looking for weekly tournament on date:', today, '(using weekly tournament boundary logic)');

        // First, try to get existing tournament for today
        const { data: tournament, error: tournamentFetchError } = await supabase
            .from('tournaments')
            .select('id, tournament_day')
            .eq('tournament_day', today)
            .eq('is_active', true)
            .single();

        console.log('🔍 Tournament fetch result:', { tournament, error: tournamentFetchError });

        if (tournamentFetchError && tournamentFetchError.code !== 'PGRST116') {
            console.error('❌ Error fetching tournament:', tournamentFetchError);
            return NextResponse.json({
                error: `Database error fetching tournament: ${tournamentFetchError.message}`
            }, { status: 500 });
        }

        // Ensure we have a tournament (either existing or newly created)
        let finalTournament = tournament;

        // If no tournament exists for this week, create one
        if (!finalTournament) {
            console.log('🏆 Creating new weekly tournament for week starting:', today);
            const startTime = new Date(today + 'T15:30:00Z'); // 15:30 UTC Sunday
            const endTime = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later

            const { data: newTournament, error: tournamentCreateError } = await supabase
                .from('tournaments')
                .insert({
                    tournament_day: today,
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString(),
                    is_active: true
                })
                .select()
                .single();

            console.log('🏆 Tournament creation result:', { newTournament, error: tournamentCreateError });

            if (tournamentCreateError) {
                console.error('❌ Error creating tournament:', tournamentCreateError);
                return NextResponse.json({
                    error: `Failed to create tournament: ${tournamentCreateError.message}`
                }, { status: 500 });
            }

            finalTournament = newTournament;
        }

        // Ensure we have a valid tournament
        if (!finalTournament) {
            console.error('❌ Failed to get or create tournament');
            return NextResponse.json({ error: 'Tournament setup failed' }, { status: 500 });
        }

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
        const actuallyVerified = is_verified_entry &&
            user.last_verified_date === today &&
            user.last_verified_tournament_id === finalTournament.id;

        console.log('🔍 Verification check:', {
            frontend_says_verified: is_verified_entry,
            user_last_verified_date: user.last_verified_date,
            user_last_verified_tournament: user.last_verified_tournament_id,
            current_tournament_id: finalTournament.id,
            today,
            final_verification_status: actuallyVerified
        });

        // Create or get user tournament record (single row per user per tournament)
        console.log('🎮 Getting or creating user tournament record:', {
            user_id: user.id,
            tournament_id: finalTournament.id,
            tournament_day: today,
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
                tournament_day: today, // Use the correct tournament boundary date
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
        } const { data: updatedRecord, error: updateError } = await supabase
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
                tournament_date: today
            }
        });

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
