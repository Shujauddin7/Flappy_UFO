// Standardized leaderboard database queries following database.md schema
// Eliminates duplicate query logic across multiple APIs

import { getSupabaseClient } from './database';

/**
 * Interface for leaderboard player data
 * Based on the database.md schema for user_tournament_records
 */
export interface LeaderboardPlayer {
    user_id: string;
    username: string | null;
    wallet: string;
    highest_score: number;
    tournament_day: string;
    serial_no?: number;
    rank?: number;
    total_games_played?: number;
    verified_games_played?: number;
    unverified_games_played?: number;
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

    // Optimized query - only select the columns we actually need for the leaderboard
    // This reduces data transfer and improves query performance significantly
    let query = supabase
        .from('user_tournament_records')
        .select(`
            user_id,
            username,
            wallet,
            highest_score,
            tournament_day,
            total_games_played,
            verified_games_played,
            unverified_games_played,
            first_game_at,
            created_at
        `)
        .eq('tournament_day', tournamentDay)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true') // Only paid entries
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
 */
export async function getTournamentStats(tournamentDay: string) {
    const supabase = await getSupabaseClient();

    // Get comprehensive tournament statistics - only for users who have paid
    const { data: statsData, error: statsError } = await supabase
        .from('user_tournament_records')
        .select(`
            verified_paid_amount,
            standard_paid_amount,
            total_games_played,
            verified_games_played,
            unverified_games_played,
            highest_score,
            total_continue_payments
        `)
        .eq('tournament_day', tournamentDay)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true');

    if (statsError) {
        throw new Error(`Failed to get tournament stats: ${statsError.message}`);
    }

    const stats = {
        total_players: statsData?.length || 0,
        total_prize_pool: 0,
        total_collected: 0,
        total_games_played: 0
    };

    if (statsData && statsData.length > 0) {
        // Calculate total collected from all payments
        stats.total_collected = statsData.reduce((sum, record) =>
            sum + (parseFloat(record.verified_paid_amount) || 0) +
            (parseFloat(record.standard_paid_amount) || 0) +
            (parseFloat(record.total_continue_payments) || 0), 0
        );

        // Prize pool is 70% of total collected
        stats.total_prize_pool = stats.total_collected * 0.7;

        // Total games played across all users
        stats.total_games_played = statsData.reduce((sum, record) =>
            sum + (record.total_games_played || 0), 0
        );
    }

    return stats;
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

    // First, get the user's data
    const { data: userData, error: userError } = await supabase
        .from('user_tournament_records')
        .select(`
            user_id,
            username,
            wallet,
            highest_score,
            tournament_day,
            total_games_played,
            verified_games_played,
            unverified_games_played,
            first_game_at,
            created_at
        `)
        .eq('tournament_day', tournamentDay)
        .eq('wallet', userWallet)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true')
        .single();

    if (userError || !userData) {
        return null; // User not found in tournament
    }

    // Get user's rank by counting how many players have better scores
    const { count: betterPlayersCount, error: rankError } = await supabase
        .from('user_tournament_records')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_day', tournamentDay)
        .or('verified_entry_paid.eq.true,standard_entry_paid.eq.true')
        .or(`highest_score.gt.${userData.highest_score},and(highest_score.eq.${userData.highest_score},first_game_at.lt.${userData.first_game_at})`);

    if (rankError) {
        throw new Error(`Failed to calculate user rank: ${rankError.message}`);
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