import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
    console.log('🔍 Debug sign-in simulation - checking what happens during MiniKit sign-in');

    try {
        const { wallet, username, worldId } = await req.json();

        console.log('Simulating sign-in for:', { wallet, username, worldId });

        const supabase = createServerSupabaseClient();

        // Step 1: Get current tournament
        console.log('Step 1: Getting current tournament...');
        const tournamentResponse = await fetch('https://flappyufo-git-dev-shujauddin.vercel.app/api/tournament/current');
        const tournamentData = await tournamentResponse.json();
        console.log('Tournament data:', tournamentData);

        if (!tournamentData.tournament?.id) {
            return NextResponse.json({
                success: false,
                error: 'No active tournament',
                debug: { tournamentData }
            });
        }

        // Step 2: Call sign-in API
        console.log('Step 2: Calling sign-in API...');
        const signInResponse = await fetch('https://flappyufo-git-dev-shujauddin.vercel.app/api/tournament/sign-in', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                wallet,
                username,
                worldId,
                tournamentId: tournamentData.tournament.id
            }),
        });

        const signInResult = await signInResponse.json();
        console.log('Sign-in result:', signInResult);

        // Step 3: Check what was created
        console.log('Step 3: Checking what was created...');

        const { data: signInsData } = await supabase
            .from('tournament_sign_ins')
            .select('*')
            .eq('wallet', wallet);

        const { data: usersData } = await supabase
            .from('users')
            .select('*')
            .eq('wallet', wallet)
            .eq('tournament_day', tournamentData.tournament.tournament_day);

        const { data: updatedTournament } = await supabase
            .from('tournaments')
            .select('total_players')
            .eq('id', tournamentData.tournament.id)
            .single();

        return NextResponse.json({
            success: true,
            debug_results: {
                tournament_found: !!tournamentData.tournament,
                tournament_id: tournamentData.tournament.id,
                tournament_day: tournamentData.tournament.tournament_day,
                sign_in_api_result: signInResult,
                created_in_tournament_sign_ins: signInsData,
                created_in_users_table: usersData,
                tournament_total_players_after: updatedTournament?.total_players
            }
        });

    } catch (error) {
        console.error('❌ Debug sign-in simulation error:', error);
        return NextResponse.json({
            success: false,
            error: 'Debug simulation failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}