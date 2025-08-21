-- Minimal Schema for Sign-In Only (Dev Environment)

-- Users table (required for sign-in)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,
  username TEXT,
  last_verified_date DATE NULL,
  last_verified_tournament_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic index for performance
CREATE INDEX idx_users_wallet ON users(wallet);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read for basic info, service role manages all
CREATE POLICY "Public can view user profiles" ON users
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage users" ON users
  FOR ALL WITH CHECK (auth.role() = 'service_role');
