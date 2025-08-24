import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        // Initialize Supabase client with service role key for database operations
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

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

        // Get or create today's tournament
        const today = new Date().toISOString().split('T')[0];
        
        // First, try to get existing tournament for today
        const { data: tournament, error: tournamentFetchError } = await supabase
            .from('tournaments')
            .select('id, tournament_day')
            .eq('tournament_day', today)
            .eq('is_active', true)
            .single();

        if (tournamentFetchError && tournamentFetchError.code !== 'PGRST116') {
            console.error('❌ Error fetching tournament:', tournamentFetchError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        // Ensure we have a tournament (either existing or newly created)
        let finalTournament = tournament;

        // If no tournament exists for today, create one
        if (!finalTournament) {
            const startTime = new Date(today + 'T15:30:00Z'); // 15:30 UTC
            const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

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

            if (tournamentCreateError) {
                console.error('❌ Error creating tournament:', tournamentCreateError);
                return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
            }

            finalTournament = newTournament;
        }

        // Ensure we have a valid tournament
        if (!finalTournament) {
            console.error('❌ Failed to get or create tournament');
            return NextResponse.json({ error: 'Tournament setup failed' }, { status: 500 });
        }

        // Get user ID from users table
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('wallet', wallet)
            .single();

        if (userError || !user) {
            console.error('❌ Error fetching user:', userError);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Create tournament entry
        const { data: entry, error: entryError } = await supabase
            .from('entries')
            .insert({
                user_id: user.id,
                tournament_id: finalTournament.id,
                tournament_day: today,
                is_verified_entry,
                paid_amount,
                payment_reference,
                highest_score: 0,
                continue_used: false,
                world_id_proof: null // Will be updated later if needed
            })
            .select()
            .single();

        if (entryError) {
            console.error('❌ Error creating entry:', entryError);
            
            // Check if it's a duplicate payment reference
            if (entryError.code === '23505') { // Unique constraint violation
                return NextResponse.json({ 
                    error: 'Payment reference already used' 
                }, { status: 409 });
            }
            
            return NextResponse.json({ error: 'Failed to create tournament entry' }, { status: 500 });
        }

        console.log('✅ Tournament entry created successfully:', {
            entry_id: entry.id,
            tournament_id: finalTournament.id,
            user_id: user.id,
            paid_amount,
            is_verified_entry
        });

        return NextResponse.json({
            success: true,
            data: {
                entry_id: entry.id,
                tournament_id: finalTournament.id,
                paid_amount: entry.paid_amount,
                is_verified_entry: entry.is_verified_entry,
                created_at: entry.created_at
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
