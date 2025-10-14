-- ================================================================
-- PROD_5: Restore total_players Column
-- ================================================================
-- Issue: PROD_4 accidentally removed total_players column
-- Fix: Add it back while keeping total_tournament_players
-- Purpose: 
--   - total_players = ALL sign-ins (for admin reference)
--   - total_tournament_players = Only paid entries (for leaderboard)
-- ================================================================

-- Step 1: Check if column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tournaments' 
  AND column_name IN ('total_players', 'total_tournament_players')
ORDER BY column_name;

-- Step 2: Add total_players column back if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tournaments' AND column_name = 'total_players'
    ) THEN
        ALTER TABLE tournaments ADD COLUMN total_players INTEGER DEFAULT 0;
        RAISE NOTICE 'Added total_players column back';
    ELSE
        RAISE NOTICE 'total_players column already exists';
    END IF;
END $$;

-- Step 3: Populate total_players with current sign-in count
UPDATE tournaments t
SET total_players = (
    SELECT COUNT(*)
    FROM tournament_sign_ins ts
    WHERE ts.first_tournament_id::uuid = t.id
);

-- Step 4: Verify both columns now exist
SELECT 
    id,
    tournament_day,
    total_players,              -- All sign-ins
    total_tournament_players,   -- Paid entries only
    total_prize_pool
FROM tournaments
ORDER BY tournament_day DESC
LIMIT 5;
