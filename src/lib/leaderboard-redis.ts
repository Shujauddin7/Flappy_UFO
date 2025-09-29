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
            console.error(`❌ Redis credentials missing for ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} environment`);
            console.error('Missing variables:', {
                hasUrl: !!redisUrl,
                hasToken: !!redisToken,
                environment: isProduction ? 'prod' : 'dev'
            });
            return null;
        }

        try {
            redisClient = new Redis({
                url: redisUrl,
                token: redisToken,
            });

            // Test the connection with a simple ping
            await redisClient.ping();
            console.log('✅ Redis connection established successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Redis connection:', error);
            redisClient = null;
            return null;
        }
    }

    return redisClient;
}

// Add or update a player's score and details in the leaderboard
export async function updateLeaderboardScore(
    tournamentDay: string,
    userId: string,
    score: number,
    playerDetails?: { username?: string | null; wallet?: string }
): Promise<boolean> {
    const redis = await getRedisClient();
    if (!redis) return false;

    try {
        const scoreKey = `leaderboard:${tournamentDay}`;
        const detailsKey = `leaderboard:${tournamentDay}:details`;

        // Add/update score in Redis Sorted Set (ZADD handles both insert and update)
        await redis.zadd(scoreKey, { score, member: userId });

        // Store player details in Redis Hash if provided
        if (playerDetails) {
            const playerData = JSON.stringify({
                username: playerDetails.username,
                wallet: playerDetails.wallet
            });
            await redis.hset(detailsKey, { [userId]: playerData });
        }

        // Set expiration for 48 hours (tournament lifecycle)
        await redis.expire(scoreKey, 48 * 60 * 60);
        await redis.expire(detailsKey, 48 * 60 * 60);

        console.log(`⚡ Redis leaderboard updated: ${userId} = ${score} points`);
        return true;
    } catch (error) {
        console.error('❌ Redis leaderboard update failed:', error);
        return false;
    }
}

// Bulk populate leaderboard from database (for initial sync) - ENHANCED
export async function populateLeaderboard(
    tournamentDay: string,
    players: Array<{ user_id: string; highest_score: number; username?: string | null; wallet?: string }>
): Promise<boolean> {
    const redis = await getRedisClient();
    if (!redis) return false;

    try {
        const scoreKey = `leaderboard:${tournamentDay}`;
        const detailsKey = `leaderboard:${tournamentDay}:details`;

        // Clear existing leaderboard data atomically (use pipeline for better performance)\n        // Note: Using separate operations to avoid issues with Redis MULTI/EXEC\n        const pipeline = redis.pipeline ? redis.pipeline() : null;\n        \n        if (pipeline) {\n            // Use pipeline for atomic operations if available\n            pipeline.del(scoreKey);\n            pipeline.del(detailsKey);\n            await pipeline.exec();\n        } else {\n            // Fallback to individual operations\n            await redis.del(scoreKey);\n            await redis.del(detailsKey);\n        }

        // Batch add all players (Redis ZADD supports multiple members)
        if (players.length > 0) {
            // Add scores in batches to avoid Redis command limits
            const batchSize = 100;
            for (let i = 0; i < players.length; i += batchSize) {
                const batch = players.slice(i, i + batchSize);
                const members = batch.map(p => ({ score: p.highest_score, member: p.user_id }));

                if (members.length === 1) {
                    await redis.zadd(scoreKey, members[0]);
                } else {
                    await redis.zadd(scoreKey, members[0], ...members.slice(1));
                }
            }

            // Add player details in batches
            for (let i = 0; i < players.length; i += batchSize) {
                const batch = players.slice(i, i + batchSize);
                const detailsData: Record<string, string> = {};

                batch.forEach(p => {
                    detailsData[p.user_id] = JSON.stringify({
                        username: p.username,
                        wallet: p.wallet
                    });
                });

                if (Object.keys(detailsData).length > 0) {
                    await redis.hset(detailsKey, detailsData);
                }
            }

            // Set expiration for 48 hours
            await redis.expire(scoreKey, 48 * 60 * 60);
            await redis.expire(detailsKey, 48 * 60 * 60);

            console.log(`⚡ Redis leaderboard populated: ${players.length} players for ${tournamentDay}`);
        }

        return true;
    } catch (error) {
        console.error('❌ Redis leaderboard population failed:', error);
        return false;
    }
}

// Get top N players from leaderboard with complete details (ultra-fast)
export async function getTopPlayers(
    tournamentDay: string,
    offset: number = 0,
    limit: number = 20
): Promise<Array<{ user_id: string; score: number; rank: number; username?: string | null; wallet?: string }> | null> {
    const redis = await getRedisClient();
    if (!redis) return null;

    try {
        const scoreKey = `leaderboard:${tournamentDay}`;
        const detailsKey = `leaderboard:${tournamentDay}:details`;

        // Get players with scores (sorted by score descending)
        const results = await redis.zrange(scoreKey, offset, offset + limit - 1, {
            rev: true,
            withScores: true
        });

        if (!results || results.length === 0) return null;

        // Extract user IDs for details lookup
        const userIds: string[] = [];
        for (let i = 0; i < results.length; i += 2) {
            userIds.push(String(results[i]));
        }

        // Get player details from Redis Hash - handle one by one for better compatibility
        const playerDetailsPromises = userIds.map(userId => redis.hget(detailsKey, userId));
        const playerDetailsRaw = await Promise.all(playerDetailsPromises);

        // Parse results into structured data with details
        const players = [];
        for (let i = 0; i < results.length; i += 2) {
            const userId = String(results[i]);
            const score = Number(results[i + 1]);
            const rank = offset + (i / 2) + 1;

            // Parse player details if available
            let playerDetails = { username: null, wallet: 'Unknown' };
            const detailsIndex = userIds.indexOf(userId);
            const rawDetails = playerDetailsRaw[detailsIndex];

            if (rawDetails && typeof rawDetails === 'string') {
                try {
                    playerDetails = JSON.parse(rawDetails);
                } catch {
                    console.warn(`Failed to parse player details for ${userId}`);
                }
            }

            players.push({
                user_id: userId,
                score: score,
                rank: rank,
                username: playerDetails.username,
                wallet: playerDetails.wallet
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