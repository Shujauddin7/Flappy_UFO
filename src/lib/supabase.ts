import { createClient } from '@supabase/supabase-js'

// Environment-based database configuration (Plan.md Section 6.1)
const getSupabaseConfig = () => {
  const env = process.env.NEXT_PUBLIC_ENV || 'dev'
  
  if (env === 'production') {
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
