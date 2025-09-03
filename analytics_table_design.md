# 📊 Analytics Table Design - Lifetime & Tournament Pool Tracking

## Problem Statement
You want to track:
1. **Lifetime totals** for each user (all-time payments, tournaments, etc.)
2. **Total 100% pool money** for current tournament (before 70/30 split)

## Recommended Solution: Separate Analytics Tables

### 1. User Analytics Table (Lifetime Stats)
```sql
CREATE TABLE user_analytics (
  serial_no SERIAL PRIMARY KEY,
  id UUID UNIQUE DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL UNIQUE,
  
  -- Lifetime Payment Totals
  total_lifetime_payments NUMERIC(12,4) DEFAULT 0 NOT NULL,
  total_verified_payments NUMERIC(12,4) DEFAULT 0 NOT NULL,
  total_standard_payments NUMERIC(12,4) DEFAULT 0 NOT NULL,
  
  -- Lifetime Participation Stats
  total_tournaments_entered INTEGER DEFAULT 0 NOT NULL,
  total_games_played INTEGER DEFAULT 0 NOT NULL,
  total_continues_used INTEGER DEFAULT 0 NOT NULL,
  
  -- Lifetime Achievement Stats
  highest_score_ever INTEGER DEFAULT 0 NOT NULL,
  total_prizes_won NUMERIC(10,4) DEFAULT 0 NOT NULL,
  tournaments_won INTEGER DEFAULT 0 NOT NULL,
  
  -- Performance Stats
  average_score DECIMAL(8,2) DEFAULT 0 NOT NULL,
  best_tournament_rank INTEGER DEFAULT NULL,
  
  -- Timestamps
  first_tournament_date DATE NULL,
  last_tournament_date DATE NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CHECK(total_lifetime_payments >= 0),
  CHECK(total_tournaments_entered >= 0),
  CHECK(highest_score_ever >= 0)
);
```

### 2. Tournament Analytics Table (Daily Pool Tracking)
```sql
CREATE TABLE tournament_analytics (
  serial_no SERIAL PRIMARY KEY,
  id UUID UNIQUE DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id) NOT NULL UNIQUE,
  
  -- Pool Money Breakdown (100% totals)
  total_pool_collected NUMERIC(12,4) DEFAULT 0 NOT NULL,  -- 100% of all payments
  verified_pool_collected NUMERIC(12,4) DEFAULT 0 NOT NULL,  -- From verified entries
  standard_pool_collected NUMERIC(12,4) DEFAULT 0 NOT NULL,  -- From standard entries
  continue_pool_collected NUMERIC(12,4) DEFAULT 0 NOT NULL,  -- From continues
  
  -- Pool Distribution (calculated from total_pool_collected)
  prize_pool_amount NUMERIC(12,4) DEFAULT 0 NOT NULL,     -- 70% for prizes
  platform_fee_amount NUMERIC(12,4) DEFAULT 0 NOT NULL,  -- 30% platform fee
  
  -- Participation Stats
  unique_players INTEGER DEFAULT 0 NOT NULL,
  total_entries_made INTEGER DEFAULT 0 NOT NULL,  -- Total entry payments
  total_continues_made INTEGER DEFAULT 0 NOT NULL,
  total_games_played INTEGER DEFAULT 0 NOT NULL,
  
  -- Prize Distribution Stats (when tournament ends)
  prizes_distributed NUMERIC(10,4) DEFAULT 0 NOT NULL,
  winners_count INTEGER DEFAULT 0 NOT NULL,
  average_prize NUMERIC(8,4) DEFAULT 0 NOT NULL,
  
  -- Tournament Performance
  highest_score INTEGER DEFAULT 0 NOT NULL,
  lowest_score INTEGER DEFAULT 0 NOT NULL,
  average_score DECIMAL(8,2) DEFAULT 0 NOT NULL,
  
  -- Timestamps
  tournament_start TIMESTAMPTZ NOT NULL,
  tournament_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints  
  CHECK(total_pool_collected >= 0),
  CHECK(prize_pool_amount = total_pool_collected * 0.7),
  CHECK(platform_fee_amount = total_pool_collected * 0.3),
  CHECK(unique_players >= 0)
);
```

## Why This Approach is Best

### ✅ Advantages:
1. **Clean Separation**: Lifetime stats separate from daily tournament stats
2. **100% Pool Tracking**: `total_pool_collected` gives you exactly what you want
3. **Comprehensive Analytics**: Both user-level and tournament-level insights
4. **Performance**: Optimized for analytics queries without affecting game tables
5. **Scalability**: Can handle historical data analysis efficiently
6. **Data Integrity**: Enforced constraints and relationships

### ✅ vs Adding to Existing Tables:
- **users table**: Would get cluttered with analytics columns
- **tournaments table**: Already has basic stats, analytics would overcomplicate
- **user_tournament_records**: Designed for individual records, not aggregates

## Implementation Strategy

### APIs to Create/Update:
1. `POST /api/analytics/update-user-lifetime` - Updates user_analytics after payments
2. `POST /api/analytics/update-tournament-pool` - Updates tournament_analytics 
3. `GET /api/analytics/user/{userId}` - Get user lifetime stats
4. `GET /api/analytics/tournament/{tournamentId}` - Get tournament pool stats

### Trigger Points:
- **After payment**: Update both user_analytics and tournament_analytics
- **After game**: Update game-related stats
- **Tournament end**: Calculate final prize distribution stats

This gives you exactly what you need: lifetime tracking + 100% pool money visibility!
