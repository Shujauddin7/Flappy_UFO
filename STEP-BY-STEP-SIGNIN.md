# 📋 Step-by-Step Supabase Setup for Sign-In Only

**CURRENT FOCUS:** Just get sign-in authentication working  
**PHASE:** Step 1 of Plan.md implementation

## Step 1: Create ONLY the Users Table

### 🚀 Go to your Supabase Dev Dashboard:
https://supabase.com/dashboard/project/zavalkmnyhkoswtwohfw

### 🔧 Click "SQL Editor" → "New Query"

### 📝 Copy and paste ONLY this SQL (users table only):

```sql
-- Step 1: Create users table for sign-in functionality only
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,
  username TEXT,
  last_verified_date DATE NULL,
  last_verified_tournament_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_users_wallet ON users(wallet);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for dev environment
CREATE POLICY "Public can view user profiles" ON users
  FOR SELECT USING (true);
CREATE POLICY "Service role can manage users" ON users
  FOR ALL WITH CHECK (auth.role() = 'service_role');
```

### ✅ Click "RUN" to execute

### 🔍 Verify table creation:
Click "Table Editor" in left sidebar → should see "users" table

## Step 2: Test the Sign-In Flow

### 📱 Go to your dev site:
https://flappyufo-git-dev-shujauddin.vercel.app/

### 🎮 Test the flow:
1. Click "Tournament" or "Practice" 
2. Should go directly to World App popup (no intermediate modal)
3. Sign in with World App
4. Check DevTools panel (top-right) - should show your data correctly
5. Click 🐛 button (bottom-left) to see mobile debug logs

### 🔍 What to look for:
- **DevTools should show:** Your username, User ID, Wallet address
- **Mobile Debug Console:** Look for ✅ "Successfully saved user to Supabase" log

## Step 3: Check Database

### 📊 Back in Supabase → Table Editor → users table
Should see a new row with your wallet address and username

---

## 🚨 IMPORTANT: Only Do This Step First!

**DO NOT run the complete-database-schema.sql yet!** That has all 5 tables.  
We're focusing on sign-in only for now.

## ✅ Success Criteria:
- [ ] Users table created in Supabase
- [ ] Sign-in flow works without intermediate modal  
- [ ] User data appears correctly in DevTools
- [ ] User record gets saved to Supabase users table
- [ ] Mobile debug console shows successful logs

Once this works perfectly, we'll move to tournaments in the next phase!
