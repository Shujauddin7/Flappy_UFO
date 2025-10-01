// Standardized leaderboard database queries following database.md schema
// Eliminates duplicate query logic across multiple APIs

import { getSupabaseClient } from './database';

/**
 * Interface for leaderboard player data
 * Based on the database.md schema for user_tournament_records
 * Optimized to only include fields used in UI display or user identification
 */
export interface LeaderboardPlayer {
    user_id: string; // Required for current user identification
    username: string | null;
    wallet: string;
    highest_score: number;
    tournament_day: string;
    serial_no?: number;
    rank?: number;
    // Removed for performance: total_games_played, verified_games_played, unverified_games_played 
    // (not displayed in UI)
    created_at?: string;
    first_game_at?: string;
}

/**
 * Get leaderboard data for a specific tournament
 * Standard query used across all leaderboard APIs
 */
export async function getLeaderboardData(
    tournamentDay: string,
    options: {
        limit?: number;
        offset?: number;
        includeZeroScores?: boolean;
    } = {}
) {
    const { limit = 20, offset = 0, includeZeroScores = false } = options;
    const supabase = await getSupabaseClient();

    // Optimized query - only select the essential columns needed for leaderboard display
    // CRITICAL FIX: Include ALL users, even those with NULL usernames (we'll handle fallback in frontend)
    let query = supabase
        .from('user_tournament_records')
        .select(`
            user_id,
            username,
            wallet,
            highest_score,
            tournament_day,
            first_game_at
        `)
        .eq('tournament_day', tournamentDay)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true') // Only paid entries
        .not('wallet', 'is', null) // Exclude NULL wallets (bad data) - but ALLOW NULL usernames
        .order('highest_score', { ascending: false })
        .order('first_game_at', { ascending: true }); // Tie-breaker: earlier submission wins

    // Filter out zero scores unless specifically requested
    if (!includeZeroScores) {
        query = query.gt('highest_score', 0);
    }

    // Apply pagination
    if (limit > 0) {
        query = query.range(offset, offset + limit - 1);
    }

    const { data: players, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch leaderboard data: ${error.message}`);
    }

    // Add rank to each player
    const playersWithRank = (players || []).map((player, index) => ({
        ...player,
        rank: offset + index + 1
    }));

    return playersWithRank;
}

/**
 * Get total count of players in tournament
 * Used for pagination and tournament stats
 */
export async function getTournamentPlayerCount(
    tournamentDay: string,
    includeZeroScores: boolean = false
) {
    const supabase = await getSupabaseClient();

    let query = supabase
        .from('user_tournament_records')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_day', tournamentDay)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true'); // Only paid entries

    if (!includeZeroScores) {
        query = query.gt('highest_score', 0);
    }

    const { count, error } = await query;

    if (error) {
        throw new Error(`Failed to get player count: ${error.message}`);
    }

    return count || 0;
}

/**
 * Get tournament statistics (prize pool, player count, etc.)
 * Used by multiple APIs for tournament info
 * OPTIMIZED: Uses SQL aggregation instead of JavaScript calculations
 */
export async function getTournamentStats(tournamentDay: string) {
    const supabase = await getSupabaseClient();

    // Optimized: Use SQL aggregation functions for better performance
    const { data: statsData, error: statsError } = await supabase
        .rpc('get_tournament_stats', {
            p_tournament_day: tournamentDay
        });

    if (statsError) {
        console.warn('RPC function not available, using fallback method');
        return getTournamentStatsFallback(tournamentDay);
    }

    return statsData[0] || {
        total_players: 0,
        total_prize_pool: 0,
        total_collected: 0,
        total_games_played: 0
    };
}

/**
 * Fallback method using efficient aggregation approach
 */
async function getTournamentStatsFallback(tournamentDay: string) {
    const supabase = await getSupabaseClient();

    // Get total player count efficiently
    const { count: totalPlayers, error: countError } = await supabase
        .from('user_tournament_records')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_day', tournamentDay)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true');

    if (countError) {
        throw new Error(`Failed to get player count: ${countError.message}`);
    }

    // Get payment aggregations - only fetch the numeric fields we need for prize pool calculation
    const { data: paymentsData, error: paymentsError } = await supabase
        .from('user_tournament_records')
        .select('verified_paid_amount, standard_paid_amount, total_continue_payments')
        .eq('tournament_day', tournamentDay)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true');

    if (paymentsError) {
        throw new Error(`Failed to get payment data: ${paymentsError.message}`);
    }

    // Calculate aggregations efficiently - optimized for UI needs only
    let totalCollected = 0;

    if (paymentsData && paymentsData.length > 0) {
        for (const record of paymentsData) {
            totalCollected += (parseFloat(record.verified_paid_amount) || 0) +
                (parseFloat(record.standard_paid_amount) || 0) +
                (parseFloat(record.total_continue_payments) || 0);
        }
    }

    const prizePool = totalCollected * 0.7; // 70% goes to prize pool

    return {
        total_players: totalPlayers || 0,
        total_prize_pool: prizePool,
        total_collected: totalCollected,
        total_games_played: 0 // Not calculated for performance - only needed for debug logging
    };
}

/**
 * Get user's rank and details in tournament
 * Used to show current user's position
 */
export async function getUserTournamentRank(
    tournamentDay: string,
    userWallet: string
): Promise<LeaderboardPlayer | null> {
    const supabase = await getSupabaseClient();

    // Optimized: Use window function to calculate rank in single query
    const { data: rankedData, error } = await supabase
        .rpc('get_user_rank', {
            p_tournament_day: tournamentDay,
            p_wallet: userWallet
        });

    if (error) {
        // Fallback to original method if RPC function doesn't exist
        console.warn('RPC function not available, using fallback method');
        return getUserTournamentRankFallback(tournamentDay, userWallet);
    }

    if (!rankedData || rankedData.length === 0) {
        return null; // User not found in tournament
    }

    return rankedData[0];
}

/**
 * Fallback method for getUserTournamentRank (simplified)
 * Only calculates approximate rank to avoid expensive COUNT queries
 */
async function getUserTournamentRankFallback(
    tournamentDay: string,
    userWallet: string
): Promise<LeaderboardPlayer | null> {
    const supabase = await getSupabaseClient();

    // Get user's data first - only essential fields needed
    const { data: userData, error: userError } = await supabase
        .from('user_tournament_records')
        .select(`
            user_id,
            username,
            wallet,
            highest_score,
            tournament_day,
            first_game_at
        `)
        .eq('tournament_day', tournamentDay)
        .eq('wallet', userWallet)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true')
        .single();

    if (userError || !userData) {
        return null; // User not found in tournament
    }

    // Simplified rank calculation - just count players with higher scores (faster)
    const { count: betterPlayersCount, error: rankError } = await supabase
        .from('user_tournament_records')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_day', tournamentDay)
        .gt('highest_score', userData.highest_score)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true');

    if (rankError) {
        console.error('Failed to calculate user rank:', rankError.message);
        // Return user data without rank if calculation fails
        return { ...userData, rank: undefined };
    }

    return {
        ...userData,
        rank: (betterPlayersCount || 0) + 1
    };
}

/**
 * Get top N players efficiently (for caching)
 * Optimized query for Redis caching purposes
 */
export async function getTopPlayersForCache(
    tournamentDay: string,
    limit: number = 1000
) {
    const supabase = await getSupabaseClient();

    const { data: players, error } = await supabase
        .from('user_tournament_records')
        .select('user_id, highest_score, first_game_at')
        .eq('tournament_day', tournamentDay)
        .gt('highest_score', 0)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true')
        .order('highest_score', { ascending: false })
        .order('first_game_at', { ascending: true })
        .limit(limit);

    if (error) {
        throw new Error(`Failed to fetch top players: ${error.message}`);
    }

    return players || [];
}