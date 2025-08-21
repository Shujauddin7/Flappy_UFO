import { createClient } from '@supabase/supabase-js'

// Environment-based database configuration (Plan.md Section 6.1)
const getSupabaseConfig = () => {
    // Start with explicit env var if set
    let env = process.env.NEXT_PUBLIC_ENV || 'dev'

    // Auto-detect from Vercel URL - PRODUCTION FIRST!
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        const fullUrl = window.location.href;

        if (hostname === 'flappyufo.vercel.app' || fullUrl.includes('flappyufo.vercel.app')) {
            env = 'production'
        } else if (hostname.includes('flappyufo-git-dev-shujauddin') || fullUrl.includes('flappyufo-git-dev-shujauddin')) {
            env = 'dev'
        }
    }

    // Server-side detection - PRODUCTION FIRST!
    if (process.env.VERCEL_URL) {
        if (process.env.VERCEL_URL.includes('flappyufo.vercel.app')) {
            env = 'production'
        } else if (process.env.VERCEL_URL.includes('flappyufo-git-dev-shujauddin')) {
            env = 'dev'
        }
    }

    // Also check VERCEL_ENV which is more reliable
    // Also check VERCEL_ENV which is more reliable
    if (process.env.VERCEL_ENV === 'production') {
        env = 'production'
    }

    if (env === 'production') {
        return {
            url: process.env.SUPABASE_PROD_URL || 'https://kvbenqwjhxzxxqhokneh.supabase.co',
            anonKey: process.env.SUPABASE_PROD_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2YmVucXdqaHh6eHhxaG9rbmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MDA4ODcsImV4cCI6MjA3MTI3Njg4N30.oEaVE_4y2nOD2hY8KS4k2X8HJTf4qMp5sYmUlaTIDj4',
            serviceKey: process.env.SUPABASE_PROD_SERVICE_KEY || 'your-prod-service-key-here'
        }
    } else {
        return {
            url: process.env.SUPABASE_DEV_URL || 'https://zavalkmnyhkoswtwohfw.supabase.co',
            anonKey: process.env.SUPABASE_DEV_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphdmFsa21ueWhrb3N3dHdvaGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NzgzMDYsImV4cCI6MjA3MTI1NDMwNn0.1gjcsHcaKiBP4oa_bg13jglDLlXdsxYKoMZZLSXTfXM',
            serviceKey: process.env.SUPABASE_DEV_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphdmFsa21ueWhrb3N3dHdvaGZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY3ODMwNiwiZXhwIjoyMDcxMjU0MzA2fQ.iKM4gkk0fXVr4V7bHhfQYWAFhjSWQDOZdsanopNu3Yo'
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

// Database Types (based on Plan.md Section 3 schema)
export interface User {
    id: string
    wallet: string
    world_id: string
    username?: string
    last_verified_date?: string
    last_verified_tournament_id?: string
    created_at: string
}

export interface Tournament {
    id: string
    tournament_day: string
    start_time: string
    end_time: string
    is_active: boolean
    created_at: string
}

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
