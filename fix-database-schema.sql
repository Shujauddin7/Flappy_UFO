-- Fix the tournament_id column type from UUID to TEXT
-- This allows storing tournament IDs like "tournament-2025-08-23" as per Plan.md

-- Drop the existing column and recreate it as TEXT
ALTER TABLE users ALTER COLUMN last_verified_tournament_id TYPE TEXT;

-- Optionally, you can also remove the UNIQUE constraint on world_id if you want users 
-- to be able to verify multiple times (though they should only get discount once per day)
-- ALTER TABLE users DROP CONSTRAINT users_world_id_key;

-- Verify the schema change
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('last_verified_date', 'last_verified_tournament_id', 'world_id');
