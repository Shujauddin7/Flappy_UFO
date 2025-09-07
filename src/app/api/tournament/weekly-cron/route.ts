import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    console.log('🕐 Weekly Tournament Cron Job Triggered at:', new Date().toISOString());

    try {
        // Vercel cron jobs are authenticated differently than manual calls
        const userAgent = req.headers.get('user-agent');
        const vercelCronHeader = req.headers.get('vercel-cron');

        // Allow Vercel cron jobs (they have specific user-agent) or manual calls with CRON_SECRET
        const isVercelCron = userAgent?.includes('vercel-cron') || vercelCronHeader;
        const isManualTrigger = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;

        if (!isVercelCron && !isManualTrigger) {
            console.error('❌ Unauthorized cron job access attempt');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        // Initialize Supabase client with service role key for admin operations
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Calculate tournament day (Sunday 15:30 UTC boundary for weekly tournaments)
        const now = new Date();
        const utcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();

        // Weekly tournament starts every Sunday at 15:30 UTC
        // If it's Sunday and past 15:30, use current Sunday
        // Otherwise use the previous Sunday
        const tournamentDate = new Date(now);

        if (utcDay === 0 && (utcHour > 15 || (utcHour === 15 && utcMinute >= 30))) {
            // It's Sunday after 15:30 UTC, use current Sunday
            // Keep current date
        } else {
            // Go back to the most recent Sunday
            const daysBack = utcDay === 0 ? 7 : utcDay; // If Sunday before 15:30, go back 7 days
            tournamentDate.setUTCDate(tournamentDate.getUTCDate() - daysBack);
        }

        const tournamentDay = tournamentDate.toISOString().split('T')[0];
        // Remove the custom tournamentId - let the database generate the UUID

        console.log('📅 Processing tournament for day:', tournamentDay);

        // Step 1: Check if tournament already exists for this day
        console.log('🔍 Checking for existing tournament...');
        const { data: existingTournament, error: checkError } = await supabase
            .from('tournaments')
            .select('id, is_active, tournament_day')
            .eq('tournament_day', tournamentDay)
            .single();

        console.log('🔍 Existing tournament check result:', { existingTournament, error: checkError });

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

        // Create new weekly tournament
        const tournamentStartTime = new Date();
        tournamentStartTime.setUTCHours(15, 30, 0, 0); // 15:30 UTC on Sunday

        const tournamentEndTime = new Date(tournamentStartTime);
        tournamentEndTime.setUTCDate(tournamentEndTime.getUTCDate() + 7); // Next Sunday 15:30 UTC
        tournamentEndTime.setUTCHours(15, 30, 0, 0);

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
                    protection_level: 3,  // Start with maximum protection (95%) for 0 WLD collected
                    start_time: tournamentStartTime.toISOString(),
                    end_time: tournamentEndTime.toISOString(),
                    created_at: new Date().toISOString()
                }
            ])
            .select()
            .single();

        if (createError) {
            console.error('❌ Error creating new tournament:', createError);
            return NextResponse.json({
                error: 'Failed to create new tournament',
                details: createError.message
            }, { status: 500 });
        }

        console.log('✅ Tournament created successfully:', newTournament);

        // Step 4: Verify the new tournament is active
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
