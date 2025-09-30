// Quick script to diagnose and fix leaderboard data issues
// Run with: node fix-leaderboard.js

const { createClient } = require('@supabase/supabase-js');
const { Redis } = require('@upstash/redis');

// You'll need to set these environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function fixLeaderboard() {
    console.log('🔧 Fixing leaderboard data...');

    // Initialize clients
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const redis = new Redis({
        url: UPSTASH_REDIS_REST_URL,
        token: UPSTASH_REDIS_REST_TOKEN,
    });

    try {
        // 1. Get current tournament day
        const today = new Date().toISOString().split('T')[0];
        console.log(`📅 Current tournament day: ${today}`);

        // 2. Check tournament records in database
        const { data: tournamentRecords, error: recordsError } = await supabase
            .from('user_tournament_records')
            .select('user_id, username, wallet, highest_score, tournament_day')
            .eq('tournament_day', today)
            .order('highest_score', { ascending: false });

        if (recordsError) {
            console.error('❌ Error fetching tournament records:', recordsError);
            return;
        }

        console.log(`📊 Found ${tournamentRecords?.length || 0} tournament records`);

        if (tournamentRecords?.length > 0) {
            console.log('🔍 Sample records:');
            tournamentRecords.slice(0, 3).forEach((record, i) => {
                console.log(`  ${i + 1}. User: ${record.user_id}`);
                console.log(`     Username: ${record.username || 'NULL'}`);
                console.log(`     Wallet: ${record.wallet || 'NULL'}`);
                console.log(`     Score: ${record.highest_score}`);
                console.log('');
            });
        }

        // 3. Check Redis leaderboard
        const leaderboardKey = `leaderboard:${today}`;
        const redisPlayers = await redis.zrevrange(leaderboardKey, 0, 10, { withScores: true });

        console.log(`🔗 Redis leaderboard entries: ${redisPlayers.length / 2}`);

        // 4. Clear Redis cache if it exists
        if (redisPlayers.length > 0) {
            console.log('🧹 Clearing Redis leaderboard cache...');
            await redis.del(leaderboardKey);

            // Also clear player details cache
            const playerDetailsKeys = [];
            for (let i = 0; i < redisPlayers.length; i += 2) {
                const userId = redisPlayers[i];
                playerDetailsKeys.push(`player:${userId}`);
            }

            if (playerDetailsKeys.length > 0) {
                await redis.del(...playerDetailsKeys);
                console.log(`🧹 Cleared ${playerDetailsKeys.length} player detail caches`);
            }
        }

        // 5. Trigger leaderboard sync
        console.log('🔄 Triggering leaderboard sync...');

        // This should be called from your app's sync endpoint
        console.log('✅ Manual fix complete!');
        console.log('');
        console.log('🎯 Next steps:');
        console.log('1. Open your app and navigate to /api/leaderboard/sync');
        console.log('2. Or call the sync API to repopulate Redis with fresh data');
        console.log('3. Refresh the leaderboard page');

        return {
            tournamentRecords: tournamentRecords?.length || 0,
            redisEntriesCleared: redisPlayers.length / 2
        };

    } catch (error) {
        console.error('❌ Fix script error:', error);
    }
}

// Only run if called directly
if (require.main === module) {
    fixLeaderboard().then(result => {
        console.log('🏁 Script completed:', result);
        process.exit(0);
    }).catch(error => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });
}

module.exports = { fixLeaderboard };