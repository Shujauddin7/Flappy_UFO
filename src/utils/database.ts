// Shared database utility functions to eliminate code duplication
// Used by all APIs to ensure consistent database connections and queries

import { createClient } from '@supabase/supabase-js';

/**
 * Get environment-specific Supabase client with service role permissions
 * Eliminates the duplicate environment checking code across all APIs
 */
export async function getSupabaseClient() {
    // Environment-specific database configuration (following Plan.md specification)
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';

    const supabaseUrl = isProduction
        ? process.env.SUPABASE_PROD_URL
        : process.env.SUPABASE_DEV_URL;

    const supabaseServiceKey = isProduction
        ? process.env.SUPABASE_PROD_SERVICE_KEY
        : process.env.SUPABASE_DEV_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error(`Server configuration error: Missing ${isProduction ? 'production' : 'development'} database credentials`);
    }

    // Return initialized client with service role key for full permissions
    return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get current active tournament
 * Eliminates the duplicate tournament fetching code across multiple APIs
 */
export async function getCurrentActiveTournament() {
    const supabase = await getSupabaseClient();

    const { data: tournaments, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

    if (tournamentError) {
        throw new Error(`Failed to fetch current tournament: ${tournamentError.message}`);
    }

    if (!tournaments || tournaments.length === 0) {
        return null; // No active tournament
    }

    return tournaments[0];
}

/**
 * Get tournament by specific tournament_day
 * Used by APIs that need to query specific tournament data
 */
export async function getTournamentByDay(tournamentDay: string) {
    const supabase = await getSupabaseClient();

    const { data: tournament, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('tournament_day', tournamentDay)
        .single();

    if (error) {
        throw new Error(`Failed to fetch tournament for ${tournamentDay}: ${error.message}`);
    }

    return tournament;
}

/**
 * Get or create tournament day
 * Helper function that returns tournament_day from parameter or current active tournament
 */
export async function getTournamentDay(providedTournamentDay?: string | null) {
    if (providedTournamentDay) {
        return providedTournamentDay;
    }

    const activeTournament = await getCurrentActiveTournament();
    if (!activeTournament) {
        throw new Error('No active tournament found');
    }

    return activeTournament.tournament_day;
}

/**
 * Environment configuration helper
 * Returns current environment info for logging and debugging
 */
export function getEnvironmentInfo() {
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod';
    return {
        isProduction,
        environment: isProduction ? 'PRODUCTION' : 'DEVELOPMENT',
        hasSupabaseUrl: isProduction
            ? !!process.env.SUPABASE_PROD_URL
            : !!process.env.SUPABASE_DEV_URL,
        hasServiceKey: isProduction
            ? !!process.env.SUPABASE_PROD_SERVICE_KEY
            : !!process.env.SUPABASE_DEV_SERVICE_KEY
    };
}