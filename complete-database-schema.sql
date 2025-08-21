-- ✅ Complete Database Schema per Plan.md Section 3
-- Run this in Supabase SQL Editor to create all tables

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,
  username TEXT,
  last_verified_date DATE NULL,
  last_verified_tournament_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_day DATE UNIQUE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entries table
CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  tournament_id UUID REFERENCES tournaments(id) NOT NULL,
  tournament_day DATE NOT NULL,
  is_verified_entry BOOLEAN NOT NULL,
  paid_amount NUMERIC(10,2) NOT NULL,
  highest_score INTEGER DEFAULT 0,
  continue_used BOOLEAN DEFAULT false,
  continue_paid_at TIMESTAMPTZ NULL,
  world_id_proof JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prizes table
CREATE TABLE prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  tournament_id UUID REFERENCES tournaments(id) NOT NULL,
  tournament_day DATE NOT NULL,
  final_rank INTEGER NOT NULL,
  prize_amount NUMERIC(10,4) NOT NULL,
  transaction_hash TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pending prizes table
CREATE TABLE pending_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  tournament_id UUID REFERENCES tournaments(id) NOT NULL,
  tournament_day DATE NOT NULL,
  final_rank INTEGER NOT NULL,
  prize_amount NUMERIC(10,4) NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ✅ Critical Performance Indexes per Plan.md
CREATE INDEX idx_entries_tournament_id ON entries(tournament_id);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_tournament_day ON entries(tournament_day);
CREATE INDEX idx_entries_highest_score ON entries(highest_score DESC);
CREATE INDEX idx_users_wallet ON users(wallet);
CREATE INDEX idx_tournaments_day ON tournaments(tournament_day);
CREATE INDEX idx_tournaments_active ON tournaments(is_active);

-- ✅ Row Level Security (RLS) Setup
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_prizes ENABLE ROW LEVEL SECURITY;

-- ✅ RLS Policies for Public Access (Dev Environment)
-- Note: In production, these should be more restrictive

-- Users: Allow public read, service role manages all
CREATE POLICY "Public can view user profiles" ON users
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage users" ON users
  FOR ALL WITH CHECK (auth.role() = 'service_role');

-- Tournaments: Allow public read of active tournaments
CREATE POLICY "Public can view active tournaments" ON tournaments
  FOR SELECT USING (is_active = true);
CREATE POLICY "Service role can manage tournaments" ON tournaments
  FOR ALL WITH CHECK (auth.role() = 'service_role');

-- Entries: Allow users to view their own entries, public can view tournament entries
CREATE POLICY "Users can view tournament entries" ON entries
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage entries" ON entries
  FOR ALL WITH CHECK (auth.role() = 'service_role');

-- Prizes: Allow public read, service role manages all
CREATE POLICY "Public can view prizes" ON prizes
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage prizes" ON prizes
  FOR ALL WITH CHECK (auth.role() = 'service_role');

-- Pending Prizes: Restricted access
CREATE POLICY "Service role can manage pending prizes" ON pending_prizes
  FOR ALL WITH CHECK (auth.role() = 'service_role');
