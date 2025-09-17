import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Redis client for unified leaderboard + tournament data
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

// Get current tournament day in PST
function getTournamentDay(): string {
    const now = new Date();
    const pstOffset = -8 * 60;
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const pstTime = new Date(utc + (pstOffset * 60000));
    return pstTime.toISOString().split('T')[0];
}

// Calculate tournament time remaining
function getTournamentTimeRemaining() {
    const now = new Date();
    const pstOffset = -8 * 60;
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const pstTime = new Date(utc + (pstOffset * 60000));

    const currentHour = pstTime.getHours();
    const currentMinute = pstTime.getMinutes();

    // Tournament resets at midnight PST (00:00)
    const hoursUntilMidnight = 23 - currentHour;
    const minutesUntilMidnight = 59 - currentMinute;

    return {
        hours_left: hoursUntilMidnight,
        minutes_left: minutesUntilMidnight
    };
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    console.log('🚀 [UNIFIED API] Starting unified leaderboard request...');

    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Allow tournament day override for testing, otherwise use current day
        const tournamentDay = searchParams.get('tournament_day') || getTournamentDay();
        const timeRemaining = getTournamentTimeRemaining();

        console.log(`📅 Tournament day: ${tournamentDay}, Limit: ${limit}, Offset: ${offset}`);

        // Try Redis first for leaderboard data
        const redis = await getRedisClient();
        let players: Array<{
            user_id: string;
            username: string | null;
            wallet: string;
            highest_score: number;
            rank: number;
        }> = [];
        let totalPlayers = 0;
        let source = 'database';
        let prizePool = 0;

        if (redis) {
            try {
                console.log('⚡ Trying Redis for unified data...');

                // Get leaderboard data from Redis sorted set
                const redisKey = `leaderboard:${tournamentDay}`;
                const leaderboardData = await redis.zrange(redisKey, offset, offset + limit - 1, {
                    rev: true,
                    withScores: true
                });

                // Get total player count
                const totalCount = await redis.zcard(redisKey);

                // Get cached tournament info
                const tournamentInfoKey = `tournament:${tournamentDay}`;
                const cachedTournamentInfo = await redis.hgetall(tournamentInfoKey);

                if (leaderboardData && leaderboardData.length > 0 && totalCount > 0) {
                    console.log(`✅ Redis hit! Found ${leaderboardData.length / 2} players, total: ${totalCount}`);

                    // Parse Redis data (format: [userId, score, userId, score, ...])
                    const parsedPlayers = [];
                    for (let i = 0; i < leaderboardData.length; i += 2) {
                        const userId = leaderboardData[i] as string;
                        const score = parseInt(leaderboardData[i + 1] as string);
                        parsedPlayers.push({
                            user_id: userId,
                            score: score,
                            rank: offset + (i / 2) + 1
                        });
                    }

                    // Get user details for these players
                    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
                    const supabaseUrl = isProduction ? process.env.NEXT_PUBLIC_SUPABASE_URL! : process.env.NEXT_PUBLIC_SUPABASE_URL!;
                    const supabaseKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY! : process.env.SUPABASE_DEV_SERVICE_KEY!;
                    const supabase = createClient(supabaseUrl, supabaseKey);

                    const userIds = parsedPlayers.map(p => p.user_id);
                    const { data: userDetails } = await supabase
                        .from('users')
                        .select('user_id, username, wallet')
                        .in('user_id', userIds);

                    // Merge user details with scores and ranks
                    players = parsedPlayers.map(player => {
                        const userDetail = userDetails?.find(u => u.user_id === player.user_id);
                        return {
                            user_id: player.user_id,
                            username: userDetail?.username || null,
                            wallet: userDetail?.wallet || '',
                            highest_score: player.score,
                            rank: player.rank
                        };
                    });

                    totalPlayers = totalCount;
                    source = 'redis';

                    // Use cached prize pool if available, otherwise calculate
                    if (cachedTournamentInfo?.total_prize_pool) {
                        prizePool = parseInt(cachedTournamentInfo.total_prize_pool as string);
                    } else {
                        prizePool = totalCount * 0.01; // Fallback calculation
                        // Cache the tournament info for next time
                        await redis.hset(tournamentInfoKey, {
                            total_prize_pool: prizePool.toString(),
                            total_players: totalCount.toString(),
                            last_updated: new Date().toISOString()
                        });
                    }                } else {
                    console.log('❌ Redis miss, falling back to database...');
                }

            } catch (redisError) {
                console.error('❌ Redis error:', redisError);
            }
        }

        // Fallback to database if Redis failed
        if (players.length === 0) {
            console.log('💾 Using database fallback...');

            const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
            const supabaseUrl = isProduction ? process.env.NEXT_PUBLIC_SUPABASE_URL! : process.env.NEXT_PUBLIC_SUPABASE_URL!;
            const supabaseKey = isProduction ? process.env.SUPABASE_PROD_SERVICE_KEY! : process.env.SUPABASE_DEV_SERVICE_KEY!;
            const supabase = createClient(supabaseUrl, supabaseKey);

            // Get leaderboard with pagination
            const { data: leaderboardData, error: leaderboardError } = await supabase
                .from('user_tournament_records')
                .select('user_id, username, wallet, highest_score, first_game_at')
                .eq('tournament_day', tournamentDay)
                .gt('highest_score', 0)
                .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true')
                .order('highest_score', { ascending: false })
                .order('first_game_at', { ascending: true })
                .range(offset, offset + limit - 1);

            if (leaderboardError) {
                throw new Error(`Leaderboard query failed: ${leaderboardError.message}`);
            }

            // Get total count
            const { count } = await supabase
                .from('user_tournament_records')
                .select('*', { count: 'exact', head: true })
                .eq('tournament_day', tournamentDay)
                .gt('highest_score', 0)
                .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true');

            players = leaderboardData?.map((row, index: number) => ({
                user_id: row.user_id,
                username: row.username || null,
                wallet: row.wallet || '',
                highest_score: row.highest_score,
                rank: offset + index + 1
            })) || [];

            totalPlayers = count || 0;
            prizePool = totalPlayers * 0.01; // $0.01 per player
            source = 'database';
        }

        const responseTime = Date.now() - startTime;

        const response = {
            success: true,
            // Tournament info
            tournament: {
                tournament_day: tournamentDay,
                total_prize_pool: parseFloat(prizePool.toFixed(2)),
                total_players: totalPlayers,
                hours_left: timeRemaining.hours_left,
                minutes_left: timeRemaining.minutes_left
            },
            // Leaderboard data
            players,
            pagination: {
                offset,
                limit,
                hasMore: offset + players.length < totalPlayers,
                nextOffset: offset + limit,
                totalPlayers
            },
            performance: {
                source,
                responseTime,
                cached: source === 'redis'
            },
            fetched_at: new Date().toISOString()
        };

        console.log(`✅ [UNIFIED API] Response ready in ${responseTime}ms from ${source}`);
        console.log(`📊 Tournament: ${totalPlayers} players, $${prizePool} prize pool`);
        console.log(`🏆 Players ${offset + 1}-${offset + players.length} of ${totalPlayers}`);

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30'
            }
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`❌ [UNIFIED API] Error after ${responseTime}ms:`, error);

        return NextResponse.json({
            success: false,
            error: 'Failed to fetch unified leaderboard data',
            details: error instanceof Error ? error.message : 'Unknown error',
            performance: {
                source: 'error',
                responseTime,
                cached: false
            }
        }, {
            status: 500,
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
    }
}