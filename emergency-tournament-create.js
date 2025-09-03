// Emergency tournament creator for development
const { createClient } = require('@supabase/supabase-js');

async function createTournament() {
    // Use dev environment
    const supabaseUrl = process.env.SUPABASE_DEV_URL || 'https://ufdrwrcawwvtqnwuucgo.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_DEV_SERVICE_KEY || 'your-service-key-here';

    console.log('🚀 Creating emergency tournament...');
    console.log('URL:', supabaseUrl);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate tournament day (15:30 UTC boundary)
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();

    const tournamentDate = new Date(now);
    if (utcHour < 15 || (utcHour === 15 && utcMinute < 30)) {
        tournamentDate.setUTCDate(tournamentDate.getUTCDate() - 1);
    }

    const tournamentDay = tournamentDate.toISOString().split('T')[0];

    // Deactivate any existing tournaments
    console.log('🔄 Deactivating existing tournaments...');
    const { error: deactivateError } = await supabase
        .from('tournaments')
        .update({ is_active: false })
        .neq('id', 'never_match');

    if (deactivateError) {
        console.error('❌ Error deactivating tournaments:', deactivateError);
    }

    // Create new tournament
    const tournamentStartTime = new Date();
    tournamentStartTime.setUTCHours(15, 30, 0, 0);

    const tournamentEndTime = new Date(tournamentStartTime);
    tournamentEndTime.setUTCDate(tournamentEndTime.getUTCDate() + 1);
    tournamentEndTime.setUTCHours(15, 0, 0, 0);

    console.log('🎯 Creating tournament for day:', tournamentDay);

    const { data: tournament, error: createError } = await supabase
        .from('tournaments')
        .insert([{
            tournament_day: tournamentDay,
            start_time: tournamentStartTime.toISOString(),
            end_time: tournamentEndTime.toISOString(),
            is_active: true,
            total_players: 0,
            total_prize_pool: 0
        }])
        .select()
        .single();

    if (createError) {
        console.error('❌ Error creating tournament:', createError);
        return;
    }

    console.log('✅ Tournament created successfully!', tournament);
}

createTournament().catch(console.error);
