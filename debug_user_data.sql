-- DEBUG: Check user data to see what's missing
-- Run these queries in your Supabase SQL Editor

-- 1. Check users table
SELECT 
  id,
  wallet,
  username,
  total_tournaments_played,
  total_games_played,
  highest_score_ever,
  created_at
FROM users 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Check user_tournament_records
SELECT 
  id,
  wallet,
  username,
  tournament_day,
  highest_score,
  total_games_played,
  created_at,
  updated_at
FROM user_tournament_records 
WHERE tournament_day = '2025-09-12'
ORDER BY highest_score DESC;

-- 3. Check game_scores
SELECT 
  id,
  wallet,
  username,
  score,
  tournament_day,
  submitted_at
FROM game_scores 
WHERE tournament_day = '2025-09-12'
ORDER BY score DESC;

-- 4. Check leaderboard data (same query as leaderboard API)
SELECT 
  wallet,
  username,
  highest_score,
  total_games_played,
  created_at
FROM user_tournament_records 
WHERE tournament_day = '2025-09-12'
  AND highest_score > 0
ORDER BY highest_score DESC, created_at ASC;
