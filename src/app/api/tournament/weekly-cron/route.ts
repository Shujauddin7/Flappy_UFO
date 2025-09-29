import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteCached } from '@/lib/redis';

export async function GET(req: NextRequest) {
    console.log('🕐 MANUAL Tournament Creation Backup Triggered at:', new Date().toISOString());
    console.log('📝 NOTE: Primary automation now runs via Supabase pg_cron - this is backup/manual trigger only');

    try {
        // Enhanced authentication for manual triggers (no longer used by Vercel cron)
        const userAgent = req.headers.get('user-agent');
        const vercelCronHeader = req.headers.get('vercel-cron');
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        // Multiple ways to authenticate Vercel cron jobs (they can vary)
        const isVercelCron = userAgent?.includes('vercel-cron') ||
            userAgent?.includes('node') ||
            vercelCronHeader === '1' ||
            req.headers.get('x-vercel-cron') === '1';

        const isManualTrigger = authHeader === `Bearer ${cronSecret}` && cronSecret;

        // Log authentication details for debugging
        console.log('🔐 Authentication check:', {
            userAgent,
            vercelCronHeader,
            hasAuthHeader: !!authHeader,
            isVercelCron,
            isManualTrigger,
            cronSecretExists: !!cronSecret
        });

        if (!isVercelCron && !isManualTrigger) {
            console.error('❌ Unauthorized cron job access attempt', {
                userAgent,
                vercelCronHeader,
                authHeader: authHeader ? 'present' : 'missing'
            });
            return NextResponse.json({
                error: 'Unauthorized',
                debug: process.env.NODE_ENV === 'development' ? { userAgent, vercelCronHeader } : undefined
            }, { status: 401 });
        }

        console.log('✅ Authentication successful:', isVercelCron ? 'Vercel Cron' : 'Manual Trigger');

        // Environment-specific database configuration (following Plan.md specification)
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

        const supabaseUrl = isProduction
            ? process.env.SUPABASE_PROD_URL
            : process.env.SUPABASE_DEV_URL;

        const supabaseServiceKey = isProduction
            ? process.env.SUPABASE_PROD_SERVICE_KEY
            : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            const errorMsg = `Missing environment variables for ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`;
            console.error('❌', errorMsg, {
                hasUrl: !!supabaseUrl,
                hasKey: !!supabaseServiceKey,
                environment: isProduction ? 'prod' : 'dev'
            });
            return NextResponse.json({
                error: `Server configuration error: Missing ${isProduction ? 'production' : 'development'} database credentials`,
                environment: isProduction ? 'production' : 'development'
            }, { status: 500 });
        }

        // Initialize Supabase client with service role key for admin operations
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Tournament date calculation (Sunday 15:30 UTC boundary)
        // Each tournament runs from Sunday 15:30 UTC to next Sunday 15:30 UTC
        // The tournament is NAMED after the Sunday when it ENDS
        const now = new Date();
        const utcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();

        // Calculate the Sunday for the tournament we should create/activate
        const tournamentSunday = new Date(now);

        if (utcDay === 0) {
            // It's Sunday
            if (utcHour < 15 || (utcHour === 15 && utcMinute < 30)) {
                // Before 15:30 UTC on Sunday - tournament ends TODAY (current week)
                // Use current Sunday
            } else {
                // At/After 15:30 UTC on Sunday - create NEXT week's tournament
                // Tournament ends next Sunday
                tournamentSunday.setUTCDate(now.getUTCDate() + 7);
            }
        } else {
            // Not Sunday - create tournament that ends on NEXT Sunday
            tournamentSunday.setUTCDate(now.getUTCDate() + (7 - utcDay));
        }

        // Normalize to start of day
        tournamentSunday.setUTCHours(0, 0, 0, 0);
        const tournamentDay = tournamentSunday.toISOString().split('T')[0];

        console.log('📅 Tournament date calculation:', {
            currentTime: now.toISOString(),
            utcDay: `${utcDay} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][utcDay]})`,
            utcTime: `${utcHour.toString().padStart(2, '0')}:${utcMinute.toString().padStart(2, '0')} UTC`,
            calculatedTournamentSunday: tournamentSunday.toISOString(),
            tournamentDay
        });
        // Remove the custom tournamentId - let the database generate the UUID

        console.log('📅 Processing tournament for day:', tournamentDay);

        // Step 1: Check if tournament already exists for this day
        console.log('🔍 Checking for existing tournament...');
        const { data: existingTournament, error: checkError } = await supabase
            .from('tournaments')
            .select('id, is_active, tournament_day, start_time, end_time')
            .eq('tournament_day', tournamentDay)
            .single();

        console.log('🔍 Tournament check result:', {
            found: !!existingTournament,
            tournamentId: existingTournament?.id,
            isActive: existingTournament?.is_active,
            error: checkError?.message
        });

        if (existingTournament) {
            // Tournament exists, just reactivate it and deactivate others
            console.log('♻️ Tournament exists, reactivating...');

            // Deactivate all other tournaments first
            const { error: deactivateOthersError } = await supabase
                .from('tournaments')
                .update({ is_active: false })
                .neq('id', existingTournament.id);

            if (deactivateOthersError) {
                console.error('❌ Error deactivating other tournaments:', deactivateOthersError);
            }

            // Reactivate the target tournament
            const { data: reactivatedTournament, error: reactivateError } = await supabase
                .from('tournaments')
                .update({ is_active: true })
                .eq('id', existingTournament.id)
                .select()
                .single();

            if (reactivateError) {
                console.error('❌ Error reactivating tournament:', reactivateError);
                return NextResponse.json({
                    error: 'Failed to reactivate tournament',
                    details: reactivateError.message
                }, { status: 500 });
            }

            console.log('✅ Tournament reactivated successfully:', reactivatedTournament);

            return NextResponse.json({
                success: true,
                message: 'Tournament reactivated successfully',
                tournament: {
                    id: reactivatedTournament.id,
                    tournament_day: reactivatedTournament.tournament_day,
                    start_time: reactivatedTournament.start_time,
                    end_time: reactivatedTournament.end_time,
                    is_active: reactivatedTournament.is_active
                },
                action: 'reactivated',
                timestamp: new Date().toISOString()
            });
        }

        // Step 2: No existing tournament, create new one
        console.log('🆕 No tournament exists, creating new one...');

        // Deactivate all current tournaments
        const { error: deactivateError } = await supabase
            .from('tournaments')
            .update({ is_active: false })
            .eq('is_active', true);

        if (deactivateError) {
            console.error('❌ Error deactivating previous tournaments:', deactivateError);
            return NextResponse.json({
                error: 'Failed to deactivate previous tournaments',
                details: deactivateError.message
            }, { status: 500 });
        }

        // Reset ALL users' verification status (as per Plan.md - verification resets weekly)
        console.log('🔄 Resetting user verification status...');
        const { error: resetVerificationError } = await supabase
            .from('users')
            .update({ last_verified_date: null })
            .neq('id', 'never_match'); // Update all users

        if (resetVerificationError) {
            console.error('❌ Error resetting user verification:', resetVerificationError);
            // Don't fail the entire process for this, just log it
            console.log('⚠️ Continuing despite verification reset error...');
        }

        // Create tournament start and end times
        const tournamentStartTime = new Date(tournamentDay + 'T15:30:00.000Z');
        const tournamentEndTime = new Date(tournamentStartTime);
        tournamentEndTime.setUTCDate(tournamentEndTime.getUTCDate() + 7);

        console.log('🕐 Tournament timing details:', {
            tournamentDay,
            startTime: tournamentStartTime.toISOString(),
            endTime: tournamentEndTime.toISOString(),
            durationDays: 7
        });

        console.log('🎯 Creating new weekly tournament...');
        const { data: newTournament, error: createError } = await supabase
            .from('tournaments')
            .insert([
                {
                    tournament_day: tournamentDay,
                    is_active: true,
                    total_players: 0,
                    total_prize_pool: 0.0,
                    total_collected: 0.0,
                    admin_fee: 0.0,
                    guarantee_amount: 0.0,
                    admin_net_result: 0.0,
                    start_time: tournamentStartTime.toISOString(),
                    end_time: tournamentEndTime.toISOString(),
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (createError) {
            console.error('❌ Tournament creation failed:', {
                error: createError.message,
                code: createError.code,
                details: createError.details,
                tournamentDay,
                startTime: tournamentStartTime.toISOString(),
                endTime: tournamentEndTime.toISOString()
            });
            return NextResponse.json({
                error: 'Failed to create new tournament',
                details: createError.message,
                tournamentDay,
                timestamp: new Date().toISOString()
            }, { status: 500 });
        }

        if (!newTournament) {
            console.error('❌ Tournament creation returned no data');
            return NextResponse.json({
                error: 'Tournament creation succeeded but returned no data'
            }, { status: 500 });
        }

        console.log('✅ Tournament created successfully:', newTournament);

        // Step 4: Clear all tournament and leaderboard caches for instant update
        console.log('🧹 Clearing all tournament caches for fresh start...');
        try {
            // Clear Redis caches
            await deleteCached('tournament:current');
            await deleteCached('tournament:leaderboard:current');
            await deleteCached('tournament:prizes:current');
            await deleteCached('tournament_stats_instant');

            // Clear any existing leaderboard cache for the old tournament
            // This will force a fresh load when clients access the new tournament
            console.log('✅ All tournament caches cleared successfully');
        } catch (cacheError) {
            console.warn('⚠️ Cache clearing failed (non-critical):', cacheError);
            // Don't fail the tournament creation for cache issues
        }

        // Step 5: Warm caches immediately for new tournament
        console.log('🔥 Warming caches for new tournament...');
        try {
            // Trigger cache warming in background (don't wait for it)
            fetch(`${req.nextUrl.origin}/api/admin/warm-cache`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.CRON_SECRET || 'no-secret'}`
                }
            }).catch(warmError => {
                console.warn('Cache warming failed (non-critical):', warmError);
            });
        } catch (warmError) {
            console.warn('⚠️ Cache warming trigger failed (non-critical):', warmError);
        }

        // Step 6: Verify the new tournament is active
        const { data: activeTournament, error: verifyError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('is_active', true)
            .single();

        if (verifyError || !activeTournament) {
            console.error('❌ Failed to verify new tournament creation:', verifyError);
            return NextResponse.json({
                error: 'Tournament creation verification failed'
            }, { status: 500 });
        }

        console.log('🎉 Weekly tournament automation completed successfully!');

        return NextResponse.json({
            success: true,
            message: 'Weekly tournament created successfully',
            tournament: {
                id: newTournament.id,
                tournament_day: newTournament.tournament_day,
                start_time: newTournament.start_time,
                end_time: newTournament.end_time,
                is_active: newTournament.is_active
            },
            verification_reset: resetVerificationError ? 'failed' : 'success',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('💥 Critical error in weekly tournament cron:', error);
        return NextResponse.json({
            error: 'Internal server error in tournament automation',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Also allow POST for manual testing
export async function POST(req: NextRequest) {
    console.log('🧪 Manual weekly tournament creation triggered');
    return GET(req);
}
