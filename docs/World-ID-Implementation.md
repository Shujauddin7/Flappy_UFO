# World ID Implementation Guide

Based on official World documentation research, here's how World ID works in your app:

## 🔍 Research Summary

From docs.world.org:

1. **Wallet Auth vs World ID Verification are separate systems:**
   - `walletAuth`: For user authentication (provides wallet address + username only)
   - `verify`: For World ID proof of personhood (provides nullifier_hash = World ID)

2. **The nullifier_hash IS the World ID:**
   - Quote from docs: "Nullifier Hash: A component of the World ID ZKP; a unique identifier for a combination of a user, app_id, and action."
   - This is the permanent unique identifier for each user across your app

## 🏗️ Implementation Architecture

### Phase 1: Authentication (Current)
- Users sign in with `walletAuth` → Gets wallet address + username
- Wallet address is stored as primary identifier
- `world_id` field starts as `NULL`

### Phase 2: World ID Verification (When Needed)
- Users verify their World ID for specific features (tournaments, etc.)
- Uses `verify` command → Gets `nullifier_hash` (the actual World ID)
- `world_id` field is updated with nullifier_hash
- User is now "verified" for proof-of-personhood features

## 📝 Code Usage

### 1. Check if user needs World ID verification:
```typescript
import { isWorldIDVerified } from '@/lib/world-id-verification'

const needsVerification = !(await isWorldIDVerified(userWalletAddress))
if (needsVerification) {
  // Show "Verify World ID" button
}
```

### 2. Perform World ID verification:
```typescript
import { verifyWorldID } from '@/lib/world-id-verification'

const result = await verifyWorldID(
  userWalletAddress,
  'tournament-entry', // action from Developer Portal
  'optional-signal-data'
)

if (result.success) {
  console.log('World ID:', result.nullifierHash)
  console.log('Verification Level:', result.verificationLevel)
  // User can now access verified features
} else {
  console.error('Verification failed:', result.error)
}
```

### 3. Get user's World ID:
```typescript
import { getUserWorldID } from '@/lib/world-id-verification'

const worldID = await getUserWorldID(userWalletAddress)
if (worldID) {
  console.log('User World ID:', worldID)
} else {
  console.log('User not verified yet')
}
```

## 🎯 Integration Points

### Tournament Entry Modal
When user clicks "Enter Tournament":
1. Check if `isWorldIDVerified(wallet)`
2. If not verified, show World ID verification flow
3. If verified, allow tournament entry

### Database Schema
```sql
-- Users table (updated)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,        -- Primary identifier from walletAuth
  world_id TEXT UNIQUE NULL,          -- World ID (nullifier_hash) from verify
  username TEXT,                      -- From walletAuth
  last_verified_date DATE NULL,       -- When World ID was verified
  last_verified_tournament_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔧 Developer Portal Setup

You need to create "actions" in the World Developer Portal for each World ID verification use case:
- `tournament-entry`: For tournament participation
- `leaderboard-access`: For viewing protected rankings
- etc.

## ✅ Benefits of This Approach

1. **User-Friendly**: Users can sign in immediately with just wallet auth
2. **Flexible**: World ID verification only when needed
3. **Compliant**: Follows World's official documentation exactly
4. **Secure**: Proper server-side proof verification
5. **Scalable**: Can add more verification-gated features easily

## 🚨 Important Notes

- **Wallet Auth ≠ World ID**: These are completely different systems
- **nullifier_hash IS the World ID**: Don't confuse it with wallet address
- **Server-side verification required**: Never trust client-side proofs
- **Actions are app-specific**: Each verification action needs to be created in Developer Portal
