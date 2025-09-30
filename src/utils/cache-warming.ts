import { getCached, setCached } from '@/lib/redis';
import { getCurrentActiveTournament } from './database';
import { getTournamentStats } from './leaderboard-queries';
import { CACHE_TTL } from './leaderboard-cache';

/**
 * Cache Warming System for Professional Mobile Game Performance
 * Pre-populates Redis cache so users NEVER see "loading tournament" messages
 * Enhanced with Circuit Breaker pattern to prevent cascade failures
 */

// Circuit Breaker State Management
interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    nextAttemptTime: number;
}

class CircuitBreaker {
    private static instances = new Map<string, CircuitBreakerState>();

    private static readonly FAILURE_THRESHOLD = 3;
    private static readonly RECOVERY_TIMEOUT = 30000; // 30 seconds
    private static readonly HALF_OPEN_MAX_CALLS = 1;

    static getState(key: string): CircuitBreakerState {
        if (!this.instances.has(key)) {
            this.instances.set(key, {
                failures: 0,
                lastFailureTime: 0,
                state: 'CLOSED',
                nextAttemptTime: 0
            });
        }
        return this.instances.get(key)!;
    }

    static async execute<T>(
        key: string,
        operation: () => Promise<T>,
        fallback?: () => Promise<T>
    ): Promise<T> {
        const state = this.getState(key);
        const now = Date.now();

        // Check circuit breaker state
        if (state.state === 'OPEN') {
            if (now < state.nextAttemptTime) {
                console.log(`🔴 Circuit breaker OPEN for ${key}, using fallback`);
                if (fallback) {
                    return await fallback();
                }
                throw new Error(`Circuit breaker OPEN for ${key}`);
            } else {
                // Try to recover
                state.state = 'HALF_OPEN';
                console.log(`🟡 Circuit breaker HALF_OPEN for ${key}, attempting recovery`);
            }
        }

        try {
            const result = await operation();

            // Success - reset failures
            if (state.state === 'HALF_OPEN') {
                state.state = 'CLOSED';
                console.log(`🟢 Circuit breaker CLOSED for ${key}, recovery successful`);
            }
            state.failures = 0;

            return result;

        } catch (error) {
            state.failures++;
            state.lastFailureTime = now;

            if (state.failures >= this.FAILURE_THRESHOLD) {
                state.state = 'OPEN';
                state.nextAttemptTime = now + this.RECOVERY_TIMEOUT;
                console.log(`🔴 Circuit breaker OPEN for ${key} after ${state.failures} failures`);
            }

            if (fallback && state.state === 'OPEN') {
                console.log(`🔄 Using fallback for ${key}`);
                return await fallback();
            }

            throw error;
        }
    }
}

// Non-blocking cache warming with timeout
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
}

/**
 * Warm tournament stats cache with circuit breaker protection
 * Call this function regularly to ensure instant loading
 */
export async function warmTournamentStatsCache(): Promise<boolean> {
    return CircuitBreaker.execute(
        'tournament-stats-cache',
        async () => {
            console.log('🔥 WARMING TOURNAMENT STATS CACHE...');

            const cacheKey = 'tournament_stats_instant';

            // Use timeout wrapper for non-blocking operation
            const result = await withTimeout((async () => {
                // Get current tournament data
                const currentTournament = await getCurrentActiveTournament();

                if (!currentTournament) {
                    // Cache "no tournament" response
                    const noTournamentResponse = {
                        tournament_day: null,
                        total_players: 0,
                        total_prize_pool: 0,
                        total_collected: 0,
                        total_games_played: 0,
                        has_active_tournament: false
                    };

                    await setCached(cacheKey, noTournamentResponse, CACHE_TTL.NO_TOURNAMENT);
                    console.log('✅ Warmed cache with "no tournament" data');
                    return true;
                }

                // Get tournament statistics
                const tournamentDay = currentTournament.tournament_day;
                const stats = await getTournamentStats(tournamentDay);

                const responseData = {
                    tournament_day: tournamentDay,
                    tournament_name: currentTournament.name || `Tournament ${tournamentDay}`,
                    total_players: stats.total_players,
                    total_prize_pool: Number(stats.total_prize_pool.toFixed(2)),
                    total_collected: Number(stats.total_collected.toFixed(2)),
                    total_games_played: stats.total_games_played,
                    has_active_tournament: true,
                    tournament_start_date: currentTournament.created_at,
                    tournament_status: 'active'
                };

                // Cache using standardized TTL (convert milliseconds to seconds for Redis)
                await setCached(cacheKey, responseData, CACHE_TTL.PRELOAD_LEADERBOARD / 1000);

                console.log('✅ Tournament stats cache warmed successfully');
                console.log(`   📊 Players: ${stats.total_players}`);
                console.log(`   💰 Prize Pool: $${stats.total_prize_pool.toFixed(2)}`);
                console.log(`   🎮 Games Played: ${stats.total_games_played}`);

                return true;
            })(), 8000); // 8 second timeout for database operations

            return result;
        },
        // Fallback: Return false but don't crash the system
        async () => {
            console.log('🔄 Using fallback for tournament stats cache warming');
            return false;
        }
    ).catch(error => {
        console.error('❌ Failed to warm tournament stats cache:', error);
        return false;
    });
}

/**
 * Warm leaderboard data cache with circuit breaker protection
 * Pre-populate the main leaderboard cache for instant loading
 */
export async function warmLeaderboardCache(): Promise<boolean> {
    return CircuitBreaker.execute(
        'leaderboard-cache',
        async () => {
            console.log('🔥 WARMING LEADERBOARD CACHE...');

            const cacheKey = 'tournament_leaderboard_data';

            // Use timeout wrapper for API calls
            const result = await withTimeout((async () => {
                // Check if cache already warm
                const existing = await getCached(cacheKey);

                if (existing) {
                    console.log('✅ Leaderboard cache already warm');
                    return true;
                }

                // Make internal API call with proper base URL handling
                const baseUrl = process.env.NEXT_PUBLIC_ENV === 'prod'
                    ? 'https://flappyufo.vercel.app'
                    : 'https://flappyufo-git-dev-shujauddin.vercel.app';

                const response = await fetch(`${baseUrl}/api/tournament/leaderboard-data`, {
                    headers: {
                        'User-Agent': 'Cache-Warmer/1.0',
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    console.log('✅ Leaderboard cache warmed via API call');
                    return true;
                } else {
                    throw new Error(`API call failed with status: ${response.status}`);
                }
            })(), 6000); // 6 second timeout for API calls

            return result;
        },
        // Fallback: Return false but continue operation
        async () => {
            console.log('🔄 Using fallback for leaderboard cache warming');
            return false;
        }
    ).catch(error => {
        console.error('❌ Failed to warm leaderboard cache:', error);
        return false;
    });
}

interface CacheWarmingDetails {
    results: {
        tournament_stats: boolean;
        leaderboard_data: boolean;
    };
    warming_time_ms?: number;
    timestamp: string;
    error?: string;
    circuit_breaker_status: {
        tournament_stats: string;
        leaderboard_data: string;
    };
}

/**
 * Master cache warming function with circuit breaker protection
 * Warms all critical caches for instant user experience
 * Enhanced with non-blocking execution and failure isolation
 */
export async function warmAllCaches(): Promise<{ success: boolean; details: CacheWarmingDetails }> {
    const startTime = Date.now();
    console.log('🚀 WARMING ALL CACHES FOR INSTANT MOBILE GAME PERFORMANCE...');

    const results = {
        tournament_stats: false,
        leaderboard_data: false
    };

    // Get circuit breaker states for monitoring
    const getTournamentStatsState = () => CircuitBreaker.getState('tournament-stats-cache').state;
    const getLeaderboardState = () => CircuitBreaker.getState('leaderboard-cache').state;

    try {
        // Execute cache warming operations in parallel with individual error handling
        const [tournamentResult, leaderboardResult] = await Promise.allSettled([
            warmTournamentStatsCache(),
            warmLeaderboardCache()
        ]);

        // Process results from settled promises
        results.tournament_stats = tournamentResult.status === 'fulfilled' ? tournamentResult.value : false;
        results.leaderboard_data = leaderboardResult.status === 'fulfilled' ? leaderboardResult.value : false;

        // Log any rejected promises
        if (tournamentResult.status === 'rejected') {
            console.error('Tournament stats warming failed:', tournamentResult.reason);
        }
        if (leaderboardResult.status === 'rejected') {
            console.error('Leaderboard warming failed:', leaderboardResult.reason);
        }

        const allWarmed = Object.values(results).every(result => result === true);
        const totalTime = Date.now() - startTime;

        if (allWarmed) {
            console.log('🎉 ALL CACHES WARMED SUCCESSFULLY!');
            console.log(`   ⚡ Total warming time: ${totalTime}ms`);
            console.log('   🎮 Ready for professional mobile game performance!');
        } else {
            console.log('⚠️ Some caches failed to warm:', results);
            console.log('   🛡️ Circuit breakers protecting system stability');
        }

        return {
            success: allWarmed,
            details: {
                results,
                warming_time_ms: totalTime,
                timestamp: new Date().toISOString(),
                circuit_breaker_status: {
                    tournament_stats: getTournamentStatsState(),
                    leaderboard_data: getLeaderboardState()
                }
            }
        };

    } catch (error) {
        console.error('❌ Master cache warming failed:', error);
        return {
            success: false,
            details: {
                error: error instanceof Error ? error.message : 'Unknown error',
                results,
                timestamp: new Date().toISOString(),
                circuit_breaker_status: {
                    tournament_stats: getTournamentStatsState(),
                    leaderboard_data: getLeaderboardState()
                }
            }
        };
    }
}

/**
 * Schedule cache warming with enhanced reliability (call this on server startup)
 * Keeps cache warm with background updates and circuit breaker monitoring
 */
export function scheduleRegularCacheWarming() {
    console.log('📅 SCHEDULING REGULAR CACHE WARMING...');

    // Warm immediately on startup
    warmAllCaches();

    // Warm every 90 seconds to ensure cache never expires while respecting circuit breakers
    const intervalId = setInterval(() => {
        console.log('🔄 SCHEDULED CACHE WARMING...');
        warmAllCaches().then(result => {
            if (!result.success) {
                console.log('⚠️ Scheduled cache warming had failures, but system remains stable');
            }
        });
    }, 90 * 1000); // 90 seconds - more frequent to handle circuit breaker recovery

    console.log('✅ Cache warming scheduled every 90 seconds with circuit breaker protection');
    console.log('🎮 Professional mobile game performance enabled with enhanced reliability!');

    return intervalId;
}