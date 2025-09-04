import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    console.log('🧪 Manual tournament trigger called');

    try {
        // Get the base URL for the current request
        const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

        // Call the cron endpoint with proper authorization
        const cronResponse = await fetch(`${baseUrl}/api/tournament/daily-cron`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        const cronData = await cronResponse.json();

        if (!cronResponse.ok) {
            throw new Error(`Cron call failed: ${cronData.error}`);
        }

        // After tournament creation, sync the tournament stats from user_tournament_records
        if (cronData.success && cronData.tournament?.id) {
            try {
                // Get environment config
                const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
                const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
                const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

                if (supabaseUrl && supabaseServiceKey) {
                    const { createClient } = await import('@supabase/supabase-js');
                    const supabase = createClient(supabaseUrl, supabaseServiceKey);

                    // Get current tournament data to sync
                    const { data: userData } = await supabase
                        .from('user_tournament_records')
                        .select('user_id, verified_paid_amount, standard_paid_amount')
                        .eq('tournament_id', cronData.tournament.id);

                    if (userData && userData.length > 0) {
                        const totalPlayers = userData.length;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const totalPrizePool = userData.reduce((sum: number, record: any) =>
                            sum + (record.verified_paid_amount || 0) + (record.standard_paid_amount || 0), 0
                        ) * 0.7;

                        // Update tournament table with actual data
                        await supabase
                            .from('tournaments')
                            .update({
                                total_players: totalPlayers,
                                total_prize_pool: totalPrizePool,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', cronData.tournament.id);

                        console.log('✅ Tournament stats synced:', { players: totalPlayers, prize_pool: totalPrizePool });
                    }
                }
            } catch (syncError) {
                console.error('❌ Error syncing tournament stats:', syncError);
                // Don't fail the whole request if sync fails
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Tournament created successfully via manual trigger',
            data: cronData
        });

    } catch (error) {
        console.error('❌ Manual tournament trigger failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
