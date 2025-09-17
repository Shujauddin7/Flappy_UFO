// Redis Sorted Set operations for leaderboard optimization
import { Redis } from '@upstash/redis';

// Redis client singleton
let redisClient: Redis | null = null;

async function getRedisClient(): Promise<Redis | null> {
    if (!redisClient) {
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
        const redisUrl = isProduction ? process.env.UPSTASH_REDIS_PROD_URL : process.env.UPSTASH_REDIS_DEV_URL;
        const redisToken = isProduction ? process.env.UPSTASH_REDIS_PROD_TOKEN : process.env.UPSTASH_REDIS_DEV_TOKEN;

        if (!redisUrl || !redisToken) {
            console.warn('⚠️ Redis credentials missing for leaderboard');
            return null;
        }

        redisClient = new Redis({
            url: redisUrl,
            token: redisToken,
        });
    }

    return redisClient;
}

// Add or update a player's score in the leaderboard
export async function updateLeaderboardScore(
    tournamentDay: string,
    userId: string,
    score: number
): Promise<boolean> {
    const redis = await getRedisClient();
    if (!redis) return false;

    try {
        const key = `leaderboard:${tournamentDay}`;

        // Add/update score in Redis Sorted Set (ZADD handles both insert and update)
        await redis.zadd(key, { score, member: userId });

        // Set expiration for 48 hours (tournament lifecycle)
        await redis.expire(key, 48 * 60 * 60);

        console.log(`⚡ Redis leaderboard updated: ${userId} = ${score} points`);
        return true;
    } catch (error) {
        console.error('❌ Redis leaderboard update failed:', error);
        return false;
    }
}

// Bulk populate leaderboard from database (for initial sync)
export async function populateLeaderboard(
    tournamentDay: string,
    players: Array<{ user_id: string; highest_score: number }>
): Promise<boolean> {
    const redis = await getRedisClient();
    if (!redis) return false;

    try {
        const key = `leaderboard:${tournamentDay}`;

        // Clear existing leaderboard
        await redis.del(key);

        // Batch add all players (Redis ZADD supports multiple members)
        if (players.length > 0) {
            // Add players in batches to avoid Redis command limits
            const batchSize = 100;
            for (let i = 0; i < players.length; i += batchSize) {
                const batch = players.slice(i, i + batchSize);
                const members = batch.map(p => ({ score: p.highest_score, member: p.user_id }));

                if (members.length === 1) {
                    await redis.zadd(key, members[0]);
                } else {
                    await redis.zadd(key, members[0], ...members.slice(1));
                }
            }

            // Set expiration for 48 hours
            await redis.expire(key, 48 * 60 * 60);

            console.log(`⚡ Redis leaderboard populated: ${players.length} players for ${tournamentDay}`);
        }

        return true;
    } catch (error) {
        console.error('❌ Redis leaderboard population failed:', error);
        return false;
    }
}

// Get top N players from leaderboard (ultra-fast)
export async function getTopPlayers(
    tournamentDay: string,
    offset: number = 0,
    limit: number = 20
): Promise<Array<{ user_id: string; score: number; rank: number }> | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    try {
        const key = `leaderboard:${tournamentDay}`;

        // Get players with scores (sorted by score descending)
        const results = await redis.zrange(key, offset, offset + limit - 1, {
            rev: true,
            withScores: true
        });

        if (!results || results.length === 0) return null;

        // Parse results into structured data
        const players = [];
        for (let i = 0; i < results.length; i += 2) {
            players.push({
                user_id: String(results[i]),
                score: Number(results[i + 1]),
                rank: offset + (i / 2) + 1
            });
        }

        return players;
    } catch (error) {
        console.error('❌ Redis get top players failed:', error);
        return null;
    }
}

// Get player's rank in leaderboard
export async function getPlayerRank(
    tournamentDay: string,
    userId: string
): Promise<number | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    try {
        const key = `leaderboard:${tournamentDay}`;

        // Get rank (0-indexed, so add 1 for display)
        const rank = await redis.zrevrank(key, userId);

        return rank !== null ? rank + 1 : null;
    } catch (error) {
        console.error('❌ Redis get player rank failed:', error);
        return null;
    }
}

// Get total number of players in leaderboard
export async function getLeaderboardSize(tournamentDay: string): Promise<number> {
    const redis = await getRedisClient();
    if (!redis) return 0;

    try {
        const key = `leaderboard:${tournamentDay}`;
        const count = await redis.zcard(key);
        return count || 0;
    } catch (error) {
        console.error('❌ Redis get leaderboard size failed:', error);
        return 0;
    }
}

// Remove player from leaderboard (cleanup)
export async function removeFromLeaderboard(
    tournamentDay: string,
    userId: string
): Promise<boolean> {
    const redis = await getRedisClient();
    if (!redis) return false;

    try {
        const key = `leaderboard:${tournamentDay}`;
        await redis.zrem(key, userId);

        console.log(`⚡ Player removed from leaderboard: ${userId}`);
        return true;
    } catch (error) {
        console.error('❌ Redis remove from leaderboard failed:', error);
        return false;
    }
}

// Clear entire leaderboard (for new tournaments)
export async function clearLeaderboard(tournamentDay: string): Promise<boolean> {
    const redis = await getRedisClient();
    if (!redis) return false;

    try {
        const key = `leaderboard:${tournamentDay}`;
        await redis.del(key);

        console.log(`⚡ Leaderboard cleared for ${tournamentDay}`);
        return true;
    } catch (error) {
        console.error('❌ Redis clear leaderboard failed:', error);
        return false;
    }
}