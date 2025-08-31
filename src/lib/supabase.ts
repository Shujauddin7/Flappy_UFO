import { createClient } from '@supabase/supabase-js'

// Environment-based database configuration (Plan.md Section 6.1)
// FOLLOWS PLAN.MD SPECIFICATION EXACTLY - Use ONLY NEXT_PUBLIC_ENV
const getSupabaseConfig = () => {
    // Use ONLY NEXT_PUBLIC_ENV as specified in Plan.md
    const isProduction = process.env.NEXT_PUBLIC_ENV === 'production';

    if (isProduction) {
        return {
            url: process.env.SUPABASE_PROD_URL!,
            anonKey: process.env.SUPABASE_PROD_ANON_KEY!,
            serviceKey: process.env.SUPABASE_PROD_SERVICE_KEY!
        }
    } else {
        return {
            url: process.env.SUPABASE_DEV_URL!,
            anonKey: process.env.SUPABASE_DEV_ANON_KEY!,
            serviceKey: process.env.SUPABASE_DEV_SERVICE_KEY!
        }
    }
}

const config = getSupabaseConfig()

// Client-side Supabase client
export const supabase = createClient(config.url, config.anonKey)

// Server-side Supabase client with service role (for API routes)
export const createServerSupabaseClient = () => {
    return createClient(config.url, config.serviceKey)
}

// Database Types (based on enhanced schema)
export interface User {
    serial_no: number
    id: string
    wallet: string
    username?: string
    world_id?: string
    last_verified_date?: string
    last_verified_tournament_id?: string
    total_tournaments_played: number
    total_games_played: number
    highest_score_ever: number
    created_at: string
    updated_at: string
}

export interface Tournament {
    serial_no: number
    id: string
    tournament_day: string
    start_time: string
    end_time: string
    is_active: boolean
    total_players: number
    total_prize_pool: number
    created_at: string
}

// Updated interface for user tournament records (replaces old Entry)
export interface UserTournamentRecord {
    serial_no: number
    id: string
    user_id: string
    tournament_id: string
    username?: string
    wallet: string
    tournament_day: string

    // Payment tracking
    verified_entry_paid: boolean
    verified_paid_amount: number
    verified_payment_ref?: string
    verified_paid_at?: string

    unverified_entry_paid: boolean
    unverified_paid_amount: number
    unverified_payment_ref?: string
    unverified_paid_at?: string

    // Game statistics
    highest_score: number
    total_games_played: number
    verified_games_played: number
    unverified_games_played: number

    // Continue tracking
    total_continues_used: number
    total_continue_payments: number

    // World ID verification
    world_id_proof?: Record<string, unknown>
    verified_at?: string

    // Timestamps
    first_game_at?: string
    last_game_at?: string
    created_at: string
    updated_at: string
}

// Individual game scores
export interface GameScore {
    serial_no: number
    id: string
    user_tournament_record_id: string
    user_id: string
    tournament_id: string
    username?: string
    wallet: string
    tournament_day: string

    score: number
    game_duration_ms: number
    was_verified_game: boolean
    continues_used_in_game: number
    continue_payments_for_game: number

    game_session_id?: string
    submitted_at: string
}

// Keep old Entry interface for backward compatibility (mark as deprecated)
/** @deprecated Use UserTournamentRecord instead */
export interface Entry {
    id: string
    user_id: string
    tournament_id: string
    tournament_day: string
    is_verified_entry: boolean
    paid_amount: number
    highest_score: number
    continue_used: boolean
    continue_paid_at?: string
    world_id_proof?: Record<string, unknown>
    created_at: string
    updated_at: string
}

export interface Prize {
    id: string
    user_id: string
    tournament_id: string
    tournament_day: string
    final_rank: number
    prize_amount: number
    transaction_hash?: string
    sent_at: string
}

export interface PendingPrize {
    id: string
    user_id: string
    tournament_id: string
    tournament_day: string
    final_rank: number
    prize_amount: number
    attempt_count: number
    last_attempt_at: string
    created_at: string
}
