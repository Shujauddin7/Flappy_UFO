-- Insert 500 fake pilots with PROPER PAYMENT FLAGS for leaderboard testing
-- Tournament ID: 3dbaaf4f-de31-434f-a53c-87b00f6b25d9 (current dev tournament)
-- Tournament Day: 2025-09-14

-- Insert 500 fake pilots with realistic usernames, varied scores, AND payment flags
DO $$
DECLARE
    current_tournament_id UUID := '3dbaaf4f-de31-434f-a53c-87b00f6b25d9';
    current_tournament_day DATE := '2025-09-14';
    fake_user_id UUID;
    fake_wallet_address TEXT;
    fake_username TEXT;
    fake_score INTEGER;
    i INTEGER;
BEGIN
    FOR i IN 1..500 LOOP
        -- Generate fake data
        fake_user_id := gen_random_uuid();
        fake_wallet_address := '0x' || lower(encode(gen_random_bytes(20), 'hex'));
        fake_username := 'pilot_' || LPAD(i::text, 3, '0');
        fake_score := CASE 
            WHEN i <= 50 THEN 800 + (i * 4)   -- Top 50: scores 804-1000
            WHEN i <= 150 THEN 400 + (i * 2)  -- Next 100: scores 402-700
            WHEN i <= 300 THEN 100 + i        -- Next 150: scores 251-450
            WHEN i <= 400 THEN 50 + (i / 2)   -- Next 100: scores 50-250
            WHEN i <= 450 THEN 10 + (i / 5)   -- Next 50: scores 10-100
            ELSE random() * 50 + 1             -- Remaining: scores 1-50
        END;
        
        -- Insert into users table (using correct schema)
        INSERT INTO users (id, wallet, username, created_at, updated_at)
        VALUES (
            fake_user_id,
            fake_wallet_address,
            fake_username,
            NOW(),
            NOW()
        ) ON CONFLICT (wallet) DO NOTHING; -- Skip if wallet already exists
        
        -- Insert into user_tournament_records table with PAYMENT FLAGS SET
        INSERT INTO user_tournament_records (
            id, user_id, tournament_id, tournament_day, username, wallet,
            highest_score, total_games_played, first_game_at, last_game_at, 
            verified_entry_paid, standard_entry_paid,  -- ✅ PAYMENT FLAGS
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            fake_user_id,
            current_tournament_id,
            current_tournament_day,
            fake_username,
            fake_wallet_address,
            fake_score,
            CASE WHEN fake_score > 0 THEN floor(random() * 10 + 1) ELSE 0 END,
            CASE WHEN fake_score > 0 THEN NOW() - interval '1 day' * random() ELSE NULL END,
            CASE WHEN fake_score > 0 THEN NOW() - interval '1 hour' * random() ELSE NULL END,
            TRUE,  -- ✅ verified_entry_paid = TRUE (they paid!)
            FALSE, -- standard_entry_paid = FALSE (using verified entry)
            NOW(),
            NOW()
        ) ON CONFLICT (user_id, tournament_id) DO NOTHING;
        
    END LOOP;
    
    RAISE NOTICE '✅ Successfully inserted 500 fake pilots with PAYMENT FLAGS for tournament %', current_tournament_id;
    RAISE NOTICE '📊 All test players have verified_entry_paid=TRUE and will appear in leaderboard';
    RAISE NOTICE '🎯 Leaderboard should now show all 501 players (500 fake + 1 real)';
END $$;