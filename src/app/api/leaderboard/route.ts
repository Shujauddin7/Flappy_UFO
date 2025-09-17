import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Redis client for leaderboard optimization
let Redis: typeof import('@upstash/redis').Redis | null = null;
let redisClient: import('@upstash/redis').Redis | null = null;

// Initialize Redis client
async function getRedisClient() {
    if (!Redis) {
        try {
            const { Redis: RedisClient } = await import('@upstash/redis');
            Redis = RedisClient;
        } catch {
            console.warn('⚠️ Redis not available, falling back to database');
            return null;
        }
    }

    if (!redisClient) {
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const redisUrl = isProduction ? process.env.UPSTASH_REDIS_PROD_URL : process.env.UPSTASH_REDIS_DEV_URL;
        const redisToken = isProduction ? process.env.UPSTASH_REDIS_PROD_TOKEN : process.env.UPSTASH_REDIS_DEV_TOKEN;

        if (!redisUrl || !redisToken) {
            console.warn('⚠️ Redis credentials missing');
            return null;
        }

        redisClient = new Redis({
            url: redisUrl,
            token: redisToken,
        });
    }

    return redisClient;
}

// Get leaderboard from Redis Sorted Set (ultra-fast)
async function getLeaderboardFromRedis(tournamentDay: string, offset: number = 0, limit: number = 20) {
    const redis = await getRedisClient();
    if (!redis) return null;

    try {
        const key = `leaderboard:${tournamentDay}`;

        // Get top players with scores from Redis Sorted Set
        const results = await redis.zrange(key, offset, offset + limit - 1, {
            rev: true,
            withScores: true
        });

        if (!results || results.length === 0) return null;

        // Parse Redis results into leaderboard format
        const players = [];
        for (let i = 0; i < results.length; i += 2) {
            const userId = String(results[i]);
            const score = Number(results[i + 1]);
            players.push({
                user_id: userId,
                highest_score: score,
                rank: offset + (i / 2) + 1
            });
        }

        console.log(`⚡ Redis leaderboard HIT: ${players.length} players in ~5ms`);
        return players;
    } catch (error) {
        console.error('❌ Redis leaderboard error:', error);
        return null;
    }
}

// Get player details from Supabase (minimal query)
async function getPlayerDetails(userIds: string[], tournamentDay: string) {
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
    const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
    const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing database credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optimized query - only fetch what we need
    const { data: players, error } = await supabase
        .from('user_tournament_records')
        .select('user_id, username, wallet')
        .eq('tournament_day', tournamentDay)
        .in('user_id', userIds);

    if (error) throw error;
    return players || [];
}

// Fallback: Direct Supabase query with pagination (when Redis fails)
async function getLeaderboardFromDatabase(tournamentDay: string, offset: number = 0, limit: number = 20) {
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
    const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
    const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing database credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optimized query with proper indexing
    const { data: players, error } = await supabase
        .from('user_tournament_records')
        .select('user_id, username, wallet, highest_score, first_game_at')
        .eq('tournament_day', tournamentDay)
        .gt('highest_score', 0)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true')
        .order('highest_score', { ascending: false })
        .order('first_game_at', { ascending: true })
        .range(offset, offset + limit - 1);

    if (error) throw error;

    // Add rank to players
    return (players || []).map((player, index) => ({
        ...player,
        rank: offset + index + 1
    }));
}

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    console.log('🏁 Optimized Leaderboard API called');

    try {
        const { searchParams } = req.nextUrl;
        const offset = parseInt(searchParams.get('offset') || '0');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 per request
        const tournamentDay = searchParams.get('tournament_day');

        // Get current tournament day if not provided
        let currentTournamentDay = tournamentDay;
        if (!currentTournamentDay) {
            const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
            const supabaseUrl = isProduction ? process.env.SUPABASE_PROD_URL : process.env.SUPABASE_DEV_URL;
            const supabaseServiceKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY : process.env.SUPABASE_DEV_SERVICE_KEY;

            if (!supabaseUrl || !supabaseServiceKey) {
                return NextResponse.json({ error: 'Database configuration error' }, { status: 500 });
            }

            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const { data: tournament } = await supabase
                .from('tournaments')
                .select('tournament_day')
                .eq('is_active', true)
                .single();

            if (!tournament) {
                return NextResponse.json({ error: 'No active tournament' }, { status: 404 });
            }

            currentTournamentDay = tournament.tournament_day;
        }

        if (!currentTournamentDay) {
            return NextResponse.json({ error: 'Tournament day not found' }, { status: 404 });
        }

        let players = [];
        let source = 'database';

        // Try Redis first (ultra-fast)
        const redisPlayers = await getLeaderboardFromRedis(currentTournamentDay, offset, limit);

        if (redisPlayers) {
            // Get user details for Redis players
            const userIds = redisPlayers.map(p => p.user_id);
            const playerDetails = await getPlayerDetails(userIds, currentTournamentDay);

            // Merge Redis scores with user details
            players = redisPlayers.map(redisPlayer => {
                const details = playerDetails.find(p => p.user_id === redisPlayer.user_id);
                return {
                    ...redisPlayer,
                    username: details?.username || null,
                    wallet: details?.wallet || 'Unknown'
                };
            });

            source = 'redis';
        } else {
            // Fallback to database query
            console.log('📊 Redis miss - using database fallback');
            players = await getLeaderboardFromDatabase(currentTournamentDay, offset, limit);
        }

        const responseTime = Date.now() - startTime;

        console.log(`🚀 Leaderboard loaded: ${players.length} players from ${source} in ${responseTime}ms`);

        return NextResponse.json({
            success: true,
            players,
            pagination: {
                offset,
                limit,
                hasMore: players.length === limit, // Simple check
                nextOffset: offset + limit
            },
            performance: {
                source,
                responseTime: responseTime,
                cached: source === 'redis'
            },
            tournament_day: currentTournamentDay,
            fetched_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Optimized leaderboard error:', error);
        return NextResponse.json({
            error: 'Failed to load leaderboard',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}