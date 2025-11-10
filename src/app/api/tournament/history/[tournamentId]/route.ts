import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use environment-based variables (DEV or PROD)
const isDev = process.env.NEXT_PUBLIC_ENV === 'dev';
const supabaseUrl = isDev ? process.env.SUPABASE_DEV_URL : process.env.SUPABASE_PROD_URL;
const supabaseServiceKey = isDev ? process.env.SUPABASE_DEV_SERVICE_KEY : process.env.SUPABASE_PROD_SERVICE_KEY;

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tournamentId: string }> }
) {
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase credentials');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        const { tournamentId } = await context.params;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch tournament info
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .eq('is_active', false) // Only allow viewing past tournaments
            .single();

        if (tournamentError || !tournament) {
            return NextResponse.json(
                { error: 'Tournament not found or still active' },
                { status: 404 }
            );
        }

        // Fetch top 10 players from user_tournament_records (has all player data including usernames)
        const { data: topPlayers, error: playersError } = await supabase
            .from('user_tournament_records')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('highest_score', { ascending: false })
            .limit(10);

        if (playersError) {
            console.error('Error fetching tournament players:', playersError);
            return NextResponse.json(
                { error: 'Failed to fetch tournament players' },
                { status: 500 }
            );
        }

        // Fetch prizes to get prize amounts for winners
        const { data: prizes } = await supabase
            .from('prizes')
            .select('user_id, final_rank, prize_amount')
            .eq('tournament_id', tournamentId);

        console.log(`Tournament ${tournamentId} - Found ${prizes?.length || 0} prize records`);

        // Create a map of user_id to prize info
        const prizeMap = new Map(
            (prizes || []).map(p => [p.user_id, { rank: p.final_rank, amount: p.prize_amount }])
        );

        // Format response with player names and prize amounts
        const formattedWinners = (topPlayers || []).map((player, index) => {
            const rank = index + 1;
            const prizeInfo = prizeMap.get(player.user_id);
            
            if (rank <= 3) {
                console.log(`Rank ${rank}: user_id=${player.user_id}, has_prize=${!!prizeInfo}, amount=${prizeInfo?.amount}`);
            }

            return {
                id: player.id,
                user_id: player.user_id,
                username: player.username,
                wallet: player.wallet,
                highest_score: 0, // Hidden in history view
                tournament_day: player.tournament_day,
                created_at: player.created_at,
                rank: rank,
                prize_amount: prizeInfo?.amount || null
            };
        });

        // Cache for 1 hour (past tournaments don't change)
        return NextResponse.json({
            tournament,
            winners: formattedWinners,
            total_winners: formattedWinners.length
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400',
            }
        });
    } catch (error) {
        console.error('Tournament detail API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
