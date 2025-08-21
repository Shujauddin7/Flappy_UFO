import { createClient } from '@supabase/supabase-js'

// Environment-based database configuration (Plan.md Section 6.1)
const getSupabaseConfig = () => {
    // Auto-detect environment based on URL or explicit env var
    let env = process.env.NEXT_PUBLIC_ENV || 'dev'

    // Auto-detect from Vercel URL
    if (typeof window !== 'undefined') {
        if (window.location.hostname.includes('flappyufo.vercel.app')) {
            env = 'production'
        } else if (window.location.hostname.includes('flappyufo-git-dev-shujauddin')) {
            env = 'dev'
        }
    }
    
    // Server-side detection
    if (process.env.VERCEL_URL) {
        if (process.env.VERCEL_URL.includes('flappyufo.vercel.app')) {
            env = 'production'
        } else if (process.env.VERCEL_URL.includes('flappyufo-git-dev-shujauddin')) {
            env = 'dev'
        }
    }    if (env === 'production') {
        return {
            url: process.env.SUPABASE_PROD_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
            anonKey: process.env.SUPABASE_PROD_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            serviceKey: process.env.SUPABASE_PROD_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY!
        }
    } else {
        return {
            url: process.env.SUPABASE_DEV_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zavalkmnyhkoswtwohfw.supabase.co',
            anonKey: process.env.SUPABASE_DEV_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphdmFsa21ueWhrb3N3dHdvaGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NzgzMDYsImV4cCI6MjA3MTI1NDMwNn0.1gjcsHcaKiBP4oa_bg13jglDLlXdsxYKoMZZLSXTfXM',
            serviceKey: process.env.SUPABASE_DEV_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphdmFsa21ueWhrb3N3dHdvaGZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTY3ODMwNiwiZXhwIjoyMDcxMjU0MzA2fQ.iKM4gkk0fXVr4V7bHhfQYWAFhjSWQDOZdsanopNu3Yo'
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

// Database Types (based on Plan.md schema)
export interface User {
    id: string
    wallet: string
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
