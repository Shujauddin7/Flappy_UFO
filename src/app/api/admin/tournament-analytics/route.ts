import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    try {
        // Environment-specific database configuration
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

        const supabaseUrl = isProduction
            ? process.env.SUPABASE_PROD_URL
            : process.env.SUPABASE_DEV_URL;

        const supabaseServiceKey = isProduction
            ? process.env.SUPABASE_PROD_SERVICE_KEY
            : process.env.SUPABASE_DEV_SERVICE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({
                error: `Missing ${isProduction ? 'production' : 'development'} database credentials`
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get query parameters
        const searchParams = req.nextUrl.searchParams;
        const tournament_day = searchParams.get('tournament_day');

        if (tournament_day) {
            // Get specific tournament analytics
            const { data: tournament, error } = await supabase
                .from('tournaments')
                .select('*')
                .eq('tournament_day', tournament_day)
                .single();

            if (error) {
                return NextResponse.json({
                    error: 'Tournament not found'
                }, { status: 404 });
            }

            // Get protection level name
            const protectionNames: Record<number, string> = {
                1: 'Level 1: Normal Operation (70% Prize Pool)',
                2: 'Level 2: Medium Protection (85% Prize Pool)',
                3: 'Level 3: Maximum Protection (95% Prize Pool)'
            };

            return NextResponse.json({
                success: true,
                data: {
                    tournament_day: tournament.tournament_day,
                    total_players: tournament.total_players,
                    total_collected: tournament.total_collected,
                    total_prize_pool: tournament.total_prize_pool,
                    admin_fee: tournament.admin_fee,
                    protection_level: tournament.protection_level,
                    protection_name: protectionNames[tournament.protection_level] || 'Unknown',
                    admin_fee_percentage: tournament.protection_level === 1 ? 30 :
                        tournament.protection_level === 2 ? 15 : 5
                }
            });

        } else {
            // Get all-time admin analytics
            const { data: tournaments, error } = await supabase
                .from('tournaments')
                .select('tournament_day, total_collected, admin_fee, total_players, protection_level')
                .order('tournament_day', { ascending: false });

            if (error) {
                return NextResponse.json({
                    error: 'Failed to fetch tournament analytics'
                }, { status: 500 });
            }

            // Calculate totals
            const totalCollectedAllTime = tournaments?.reduce((sum, t) => sum + (parseFloat(t.total_collected) || 0), 0) || 0;
            const totalAdminFeesAllTime = tournaments?.reduce((sum, t) => sum + (parseFloat(t.admin_fee) || 0), 0) || 0;
            const totalTournaments = tournaments?.length || 0;
            const totalPlayersAllTime = tournaments?.reduce((sum, t) => sum + (t.total_players || 0), 0) || 0;

            // Protection level breakdown
            const protectionBreakdown = {
                level_1_count: tournaments?.filter(t => t.protection_level === 1).length || 0,
                level_2_count: tournaments?.filter(t => t.protection_level === 2).length || 0,
                level_3_count: tournaments?.filter(t => t.protection_level === 3).length || 0
            };

            return NextResponse.json({
                success: true,
                data: {
                    // Your earnings summary
                    total_collected_all_time: totalCollectedAllTime,
                    total_admin_fees_all_time: totalAdminFeesAllTime,

                    // Tournament summary
                    total_tournaments: totalTournaments,
                    total_players_all_time: totalPlayersAllTime,
                    average_players_per_tournament: totalTournaments > 0 ? Math.round(totalPlayersAllTime / totalTournaments) : 0,

                    // Protection level breakdown
                    protection_breakdown: protectionBreakdown,

                    // Recent tournaments (last 10)
                    recent_tournaments: tournaments?.slice(0, 10).map(t => ({
                        tournament_day: t.tournament_day,
                        total_collected: parseFloat(t.total_collected) || 0,
                        admin_fee: parseFloat(t.admin_fee) || 0,
                        total_players: t.total_players,
                        protection_level: t.protection_level
                    })) || []
                }
            });
        }

    } catch (error) {
        console.error('❌ Admin analytics API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
