-- Create users table if it doesn't exist (run this in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet TEXT UNIQUE NOT NULL,
    username TEXT,
    last_verified_date TIMESTAMP,
    last_verified_tournament_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index on wallet for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet ON public.users(wallet);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations (you can make this more restrictive later)
CREATE POLICY IF NOT EXISTS "Allow all operations for users" ON public.users
    FOR ALL USING (true) WITH CHECK (true);

-- Verify table exists
SELECT table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;
