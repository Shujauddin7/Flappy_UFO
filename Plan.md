# 🛸 Flappy UFO: Complete Production-Ready Game Blueprint

Summary: A skill-based mini game inside the World App with daily WLD tournaments and competitive rankings.

### Flappy UFO: Complete Production-Ready Game Blueprint
This document outlines the complete tech and feature blueprint for building Flappy UFO, a skill-based mini game inside the World App.

## 📍 Overview

**Flappy UFO** is a Worldcoin-powered game where players navigate a UFO through obstacles, participate in daily WLD tournaments, and compete for Top 10 rankings to win prizes.

**Why:** A skill-based game leverages Worldcoin's ecosystem (World ID, Wallet) to engage users, offering a competitive yet fair experience.
---
## 📁 Setup Information
### ⚙️ Project Scaffold via MiniKit CLI

**Bootstrapped using:** `npx @worldcoin/create-mini-app@latest Flappy_UFO`

- **What:** Initializes a Next.js project with Worldcoin MiniKit integration
- **Why:** Provides a prebuilt scaffold aligned with World App requirements, saving development time

### ⚠️ Dev = Prod Build

World App only supports production builds for testing (docs.worldcoin.org).

**Two Git branches:**
- `main`: Production (e.g., play.flappyufo.xyz)
- `dev`: Developer build, production-ready (e.g., dev.flappyufo.xyz)

**Safety:** Dev mirrors prod logic, verification, and payments for real-world testing without impacting the live app. No mock data or dummy behavior.

- **What:** Dev environment behaves identically to prod
- **Why:** Ensures accurate testing per World App's production-only policy, avoiding discrepancies

---

## 🌍 World Mini App Guidelines

*Follow these to ensure app approval*

### MiniKit Integration

- Use MiniKit SDK for World ID and Wallet access to enhance user experience
- Implement meaningful integrations (e.g., World ID verification, payments)
- **What:** Adds secure authentication and payment features
- **Why:** Meets World App's requirement for value-added functionality, ensuring approval

### Mobile-First Design

UI must feel like a mobile app:

- Tab navigation for simplicity
- Snap-to text boxes for input
- Avoid footers, sidebars, excessive scrolling, or hamburger menus
- Smooth screen transitions
- Consistent background colors
- Clear navigation cues
- Responsive UI for all screen sizes
- Mobile-optimized fonts
- Avoid iOS scroll bounce (use 100dvh, disable autoscroll, or fixed elements)

- **What:** Ensures a native mobile experience
- **Why:** Aligns with World App's mobile-first focus, improving user retention

### Design Patterns

- Display username (not wallet address) for authenticated users and shorten wallet for Non-verified
- Use MiniKit "Verify" command for key actions or identity verification
- **What:** Enhances user privacy and security
- **Why:** Complies with World App's privacy standards and improves UX

## 🎨 Game Color Palette

Since the game is space-themed, the color palette is designed to release dopamine, feel futuristic, and keep players hooked:

- **Background (Deep Space)**
  - HEX: `#0B0C10` (deep navy / near-black)

- **Primary Neon Accents (Cyan/Blue Glow)**
  - HEX: `#00F5FF` (electric cyan)
  - HEX: `#1D4ED8` (bright space blue)

- **Secondary Glow (Arcade Purples/Pinks)**
  - HEX: `#9333EA` (vibrant purple)
  - HEX: `#EC4899` (neon pink)

- **Collectibles / Rewards (Gold Contrast)**
  - HEX: `#FFD700` (shining gold yellow)

- **Neutral UI (for text & borders)**
  - HEX: `#E5E7EB` (light gray)
  - HEX: `#374151` (dark gray)

### Notes:
- Background stays dark for infinite space depth.  
- Neon cyan/blue for the UFO + main glow elements → futuristic and dopamine-triggering.  
- Purple/pink gradients for obstacles/accents → arcade vibe, addictive.  
- Gold for collectibles (stars) → creates a strong *reward signal* in the brain.  
- Gray tones for neutral UI (text, buttons) → keeps interface clean.  

### Technical Requirements

- Support poor internet connections and handle disconnections
- Ensure reliability (no infinite loading for non-standard actions)
- Avoid platform-specific features
- Synchronize user progress across platforms
- **What:** Guarantees robust, cross-platform performance
- **Why:** Ensures app stability and compliance for World App distribution

---

## 📁 Prebuilt Folders & Files (World App Provided)

```
.
├── .env.local
├── .env.sample
├── .gitignore
├── .vscode
│   └── launch.json
├── eslint.config.mjs
├── middleware.ts
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── public
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── README.md
├── src
│   ├── abi
│   │   └── TestContract.json
│   ├── app
│   │   ├── (protected)
│   │   │   ├── home
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── api
│   │   │   ├── auth
│   │   │   │   └── [...nextauth]
│   │   │   │       └── route.ts
│   │   │   ├── initiate-payment
│   │   │   │   └── route.ts
│   │   │   └── verify-proof
│   │   │       └── route.ts
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── auth
│   │   ├── index.ts
│   │   └── wallet
│   │       ├── client-helpers.ts
│   │       ├── index.ts
│   │       └── server-helpers.ts
│   ├── components
│   │   ├── AuthButton
│   │   │   └── index.tsx
│   │   ├── Navigation
│   │   │   └── index.tsx
│   │   ├── PageLayout
│   │   │   └── index.tsx
│   │   ├── Pay
│   │   │   └── index.tsx
│   │   ├── Transaction
│   │   │   └── index.tsx
│   │   ├── UserInfo
│   │   │   └── index.tsx
│   │   ├── Verify
│   │   │   └── index.tsx
│   │   └── ViewPermissions
│   │       └── index.tsx
│   └── providers
│       ├── Eruda
│       │   ├── eruda-provider.tsx
│       │   └── index.tsx
│       └── index.tsx
└── tsconfig.json
```

**Do not delete any prebuilt logic from /lib/minikit or /hooks.**

- **What:** Provides essential structure and components
- **Why:** Ensures compatibility with World App's ecosystem

### 🎨 UI Kit Usage

- Use World App UI Kit for all buttons, modals, alerts, dropdowns (import from /components/ui/)
- Match spacing, colors, and typography with World App standards
- No custom styling unless approved
- **What:** Standardizes UI elements
- **Why:** Ensures consistency with World App's branding and improves approval chances

### 📱 Mobile Optimization & UX

- Fully responsive across Android, iOS, and tablets
- Game canvas resizes for all screens
- Use viewport-fit=cover + safe-area support for notches
- Smooth navigation:
  - Handle router.push() carefully to avoid errors
  - Use useEffect() to restore session + in-memory game state
  - Prevent glitches on refresh or crash recovery
- **What:** Optimizes game for mobile devices
- **Why:** Enhances usability and aligns with mobile-first design goals

### 📜 World App Policy Compliance

Follows all rules from docs.worldcoin.org:
- No gambling or random rewards
- No wallet address leaks
- No dark patterns
- All rewards earned via skill
- **What:** Ensures legal and ethical operation
- **Why:** Meets World App's strict compliance standards for distribution

### ✅ Optimized for App of the Week

- Uses UI Kit, mobile-first
- Offers Orb-verified bonus (0.9 WLD entry)
- Clear prize rules
- Realtime leaderboard
- **What:** Highlights key features for promotion
- **Why:** Increases chances of being featured as App of the Week

---

## ✅ Section 1: Game Overview + Core Logic

### 1.1 Title & Theme

**Flappy UFO: Space Adventure**

A mobile-first UFO flying game for the World App. Navigate through planets and asteroids, collect stars (Practice Mode), and compete in daily WLD tournaments.

- **What:** Defines the game's identity and purpose
- **Why:** Sets a fun, space-themed narrative to engage players

### 1.2 Core Gameplay Mechanics

- **Controls:** Tap to fly up, release to fall
- **Obstacles:** Planets (Earth, Mars, Jupiter, Saturn, Neptune, Uranus)
- **Asteroids:** Randomly placed, alternate with planets
- **Collectibles:** Stars (2 coins per star, Practice Mode only; no score impact)
- **Scoring:** +1 point per obstacle passed
- **Pattern Randomization:** Different obstacle patterns each game to prevent memorization
- **Record Rule:** Only the highest score per user across all entries is recorded

- **What:** Outlines gameplay rules and mechanics
- **Why:** Ensures a fair, skill-based experience with varied challenges

### 1.3 Game Modes

| Mode | Description |
|------|-------------|
| **🆓 Practice Mode** | - No payment required<br>- May require sign-in for World App visibility<br>- Coins stored in localStorage with tamper protection<br>- Earn 2 coins per star collected<br>- Use 10 coins per continue<br>- Unlimited plays, no prizes<br>- Same physics and mechanics as Tournament Mode |
| **🏆 Tournament Mode** | - World ID sign-in required (MiniKit)<br>- Entry fee: 1.0 WLD (non-verified) / 0.9 WLD (Orb-verified)<br>- No entry limits (multiple entries allowed)<br>- Each entry allows 1 continue by paying the same amount again<br>- First crash → pay to continue (score carries forward)<br>- Second crash → must create new entry with new payment<br>- Only highest score per user across all entries stored<br>- Realtime leaderboard updates via Supabase subscription<br>- No local score trusted; only backend submission is final |

- **What:** Defines two gameplay modes with distinct rules
- **Why:** Offers free practice and competitive tournament options to attract diverse users

### 1.4 Entry Fee & Payment System

- Payment via worldApp.pay() (MiniKit)
- Proof sent to backend, verified via World ID API with nonce and signed payment proof
- Entry recorded only after valid proof
- Admin wallet receives entry WLD and sends payouts

**Manual Payout System (Technical Requirement):**
- **Why Manual:** World App MiniKit SDK does not support automated batch payments
- **Technical Constraint:** Each payment requires individual World App user confirmation
- **No Alternative:** Third-party payment systems (MetaMask, etc.) not permitted in World App environment
- **Process:** Admin dashboard calculates winners via /api/admin/distribute-prizes; admin manually confirms each transaction in World App
- **Security Benefit:** Manual review prevents erroneous payments
- **Implementation:** Separate admin frontend (e.g., Netlify-hosted) with admin wallet authentication

**Payment Failure Handling:**

**Pre-Payment Validation:**
- Check World App wallet balance before payment attempt
- Display exact costs: "Pay 1.0 WLD to enter tournament"
- Prevent payment attempts if insufficient balance

**Failure Recovery:**
- **Retry Mechanism:** 3 automatic retry attempts with user confirmation
- **Clear Error Messages:** 
  - "Insufficient balance - you need 1.0 WLD"
  - "Network error - no money was charged, please try again"
  - "Payment processing - please wait..."

**Reconciliation & Logging:**
- **Detailed Logging:** Log all payment attempts with payment proof IDs, timestamps, user IDs, and amounts for dispute resolution
- **Payment Proof Tracking:** Store World ID payment proof for each transaction attempt
- Failed payments do not create tournament entries
- Clear user messaging: "Payment failed, no entry created, no charges applied"
- Manual admin review available via dashboard for technical fault disputes

**Implementation:** 
```javascript
// Pre-payment check
if (walletBalance < requiredAmount) {
  showError("Insufficient balance. You need " + requiredAmount + " WLD");
  return;
}

// Payment with retry
try {
  await worldApp.pay(amount);
} catch (error) {
  showError("Payment failed. No money was charged. Try again?");
  logPaymentAttempt(userId, amount, "failed", error.message);
}
```

- **What:** Manages payments and payouts
- **Why:** Ensures secure transactions and manual oversight for fairness

### 1.5 Continue System

#### Practice Mode:
- Earn 2 coins per star
- **Primary Storage:** Coins in localStorage with hash-based tamper detection (reset to 0 if tampered)
- **No Server Validation:** Purely client-side implementation to keep Practice Mode lightweight
- Use 10 coins to continue
- Unlimited continues if coins are available

#### Tournament Mode:
- Pay 1.0 WLD (non-verified) or 0.9 WLD (verified) to join
- **World ID Verification:** Happens before first paid entry to ensure real users and apply 0.9 WLD verified price
- **Multiple Entries:** Each creates unique entry_id; multiple entries allowed per user
- **Payment Verification:** Happens before game start; entries only recorded after backend confirmation
- First crash → option to continue by paying the same amount, extending existing entry (same entry_id, score carries forward)
- **Continue Time Limit:** Player must use continue within 5 minutes after losing, otherwise it expires
- Only one continue per entry (continue_used flag enforces)
- **Multiple Entries Continue:** Each entry has its own continue opportunity
- Second crash → must create new entry with new payment
- Each continue marks continue_used = true and logs continue_paid_at
- **Score Submission:** Highest score per user across all entries recorded on leaderboard after any crash (if higher than previous) or at game end

**Single Continue Policy Rationale:**

**Fairness Principles:**
- **Prevents Pay-to-Win:** Rich players cannot buy unlimited advantages through multiple continues
- **Skill-Based Focus:** After 2 crashes, genuine skill improvement required for new entry
- **Equal Opportunity:** All players have same continue opportunity regardless of wealth
- **World App Compliance:** Prevents gambling-like mechanics that violate World App policies

**Alternative Considered (Rejected):**
- Multiple continues with exponential pricing (1 WLD → 2 WLD → 4 WLD)
- **Rejection Reason:** Creates unfair advantage for wealthy players
- **Current Policy:** Maintains competitive integrity and skill-based gameplay

**Implementation:** `continue_used` boolean flag enforces one continue per entry

- **What:** Defines continue mechanics for both modes
- **Why:** Encourages player retention in Practice Mode and fairness in Tournament Mode with limited continues

### 1.6 Leaderboard Rules

- Built using Supabase Realtime
- **Automatic Reset:** Handled by tournament_id separation at tournament start (15:30 UTC / 21:00 IST)
- **Display Structure:**
  - Top 10 always visible at the top
  - Infinite scroll with pagination using .range() to view all ranks beyond Top 10
  - **User Position:** Always displayed (even if outside Top 10)
  - **Real-time Updates:** Leaderboard refreshes every 5 seconds via Supabase real-time during active period
  - **Grace Period Behavior:** 15:00–15:30 UTC - leaderboard frozen for prize calculation, no new entries accepted
- **Data Management:** Each tournament uses unique tournament_id for separation
- Highest score per user across all paid entries used

#### Display Logic:
- Username shown if available; else shortened wallet for unverified users
- No full wallet addresses or Orb-verified badges displayed

#### Each Row Format:
- **Top:** Points
- **Bottom:** Prize (if applicable)
- Serial numbers/rank optional
- Dropdown shows prize breakdown
- **Tie-breaking:** Same score → earlier submission wins (created_at ASC)

- **What:** Governs leaderboard display and updates
- **Why:** Provides real-time competition and privacy-compliant ranking

### 1.7 Prize Pool Breakdown

| Description | Value |
|-------------|-------|
| **Prize Pool** | 70% of WLD collected |
| **Retained for growth, operations, bonuses** | 30% of WLD collected |
| **Minimum player requirement for payout** | 5 players; if <5, full refund to all players |

#### Rank Distribution (Top 10 Winners Only) No Matter how many players Join

| Rank | % of Prize Pool |
|------|----------------|
| 1 | 40% |
| 2 | 22% |
| 3 | 14% |
| 4 | 6% |
| 5 | 5% |
| 6 | 4% |
| 7 | 3% |
| 8 | 2% |
| 9 | 2% |
| 10 | 2% |

- **What:** Defines prize allocation
- **Why:** Incentivizes competition with a fair distribution and refund safety net

### 1.8 Tournament Timing & Cadence

#### 🕓 Daily Tournament Schedule

**Time Zone Context:**
- **UTC 15:30 = IST 21:00 (9:00 PM Bangalore time)** - Admin's preferred payout time
- All times below shown in both UTC and IST for clarity

**Automation System:**
- **Tournament Start/End:** Tournaments automatically start at 15:30 UTC and end at 15:30 UTC next day via backend scheduler (cron job)
- **No manual trigger required** except for emergency overrides
- **Daily Cron Job handles:**
  - Creating new tournament record with unique tournament_id
  - Closing the previous tournament
  - Triggering leaderboard reset via tournament_id separation
  - Initiating the 30-minute grace period

**Daily Schedule:**
- **Start:** 15:30 UTC (21:00 IST) - Automatic via cron job
- **End:** 15:30 UTC next day (21:00 IST next day) - 24 hours total
- **Active Period:** 15:30 UTC to 15:00 UTC next day (21:00 IST to 20:30 IST next day) - 23.5 hours
- **Grace Period:** 15:00–15:30 UTC (20:30–21:00 IST) - 30 minutes:
  - No new entries accepted
  - Warning for active players: "Tournament ends in X minutes."
  - **10-minute final grace** for ongoing games to finish (games started before 15:00 UTC)
  - After 10 minutes, current score is final (if highest for that user)
  - Leaderboard frozen for prize calculation
  - "Calculating Prizes…" message shown
  - Practice Mode remains playable
- **Payout Trigger:** 15:35 UTC (21:05 IST) – Semi-automated with manual override via admin dashboard

**Leaderboard Reset Logic:**
- **Automatic reset** using tournament_id separation (not data deletion)
- Fresh leaderboard view for new tournament while old data preserved
- **Data Archiving:** Old tournament scores archived for 7 days for dispute checks, then deleted to save costs

- **What:** Sets tournament schedule and rules
- **Why:** Ensures structured competition with clear end and payout timing

### 1.9 Countdown & UX Elements

Displayed on Leaderboard screen:
- **Countdown timer (⏱):** Auto-updates, resets at 15:30 UTC
- **Live prize pool (🎁)**
- **Total players joined today (👥)**

**Timezone Display Format:**
- **Primary:** "Tournament ends in 2h 34m"
- **Secondary:** "Ends at 15:3
0 UTC (11:30 AM your time)"
- Auto-detects user timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Clear messaging prevents global user confusion about tournament timing

- **What:** Provides real-time tournament info
- **Why:** Enhances player engagement with live updates

### 1.10 User Journey Flow

#### UI Pages and Popups:
- **Home Screen:** Flappy UFO logo, "Tap to Play" button, bottom nav (this should not be a footer) (Home, Leaderboard), Info button (ⓘ) showing game rules, tournament info, 30% admin fee transparency, refund policy this info should come only ones the user click on info button 
- **Tap to Play Flow:** Sign-in modal (MiniKit); on success → Mode selection screen (Practice/Tournament Mode)
- **Practice Mode:** Starts game instantly
- **Tournament Mode:** Options: Verified (MiniKit orb verification + payment) or Non-Verified (direct payment)
- **In-Game Crash Popups:** "Game Over," "Highest Score," "Continue?"; X to cancel; continue resumes game; no continue → "Play Again?" → redirect to home screen

#### Complete User Flows:
- **Practice Flow:** Open game → Tap to Play → Practice Mode → Play → Crash → Use coins to continue → Unlimited replay
- **Tournament Flow:** Tap to Play → Tournament Mode → MiniKit sign-in → Orb verify (if chosen) → Pay (1.0/0.9 WLD) → Play → First crash → Pay to continue (score resumes) → Second crash → New entry with payment → Score submitted (if highest) → Leaderboard updates → 15:30 UTC end → 15:35 UTC payout

#### Anti-Cheat:
- JS obfuscation only (no DevTools block)
- Do not disable console/devtools shortcuts (reviewers need access)
- Backend validates all game logic and scores
- Dev-mode flag (process.env.NODE_ENV !== 'production') enables logging/inspection

- **What:** Prevents cheating while allowing review
- **Why:** Balances security with World App review requirements

---

## ✅ Tech Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js + Tailwind CSS | UI/UX, game rendering |
| **Backend** | Next.js API routes | Validation, data processing |
| **Database** | Supabase (PostgreSQL) | Data storage with RLS |
| **Real-time** | Supabase Realtime | Live leaderboard updates |
| **Authentication** | World ID + MiniKit SDK | Secure entry validation |
| **Payments** | World App Pay API | WLD transactions |
| **Deployment** | Vercel + GitHub Actions | Semi-automated deployment |
| **Storage** | localStorage (Practice only) | Coin persistence |

- **What:** Lists technologies used
- **Why:** Ensures clear tech stack for development and scalability

---

## ✅ Section 2: Frontend & Backend Responsibilities

### 🎮 Frontend Responsibilities

Built with Next.js + Tailwind CSS, handles UI/UX, game rendering, user interaction, and backend API calls.

#### 2.1 Game UI Screens & Technical Implementation

**Game Engine Choice:**
- **Engine:** Vanilla HTML5 Canvas + custom JavaScript physics (no heavy frameworks like Phaser to keep it lightweight)
- **Integration:** Canvas rendered within a React component, controlled by hooks & state for UI updates
- **Mobile Controls:** Touch controls via onTouchStart / onTouchEnd for flap actions
- **Responsive Design:** Canvas resizes dynamically for all screen sizes (Android, iOS, tablets)

**UI Screens:**
- **Home Screen:** Logo, "Tap to Play," bottom nav
- **Mode Selection Screen:** Practice or Tournament Mode
- **Tournament Path:** Verified/Non-Verified buttons with MiniKit
- **Game Screen:** Canvas-based gameplay with physics
- **Crash Popups:** Game Over, Continue, Play Again modals
- **Leaderboard Screen:** Top 10, infinite scroll pagination, user rank highlighting, live stats
- **Info Modal:** Game rules, prize breakdown, contact info

- **What:** Defines UI components
- **Why:** Ensures a cohesive, user-friendly interface

#### 2.2 Frontend Logic & Supabase Realtime Management

**Core Logic:**
- Sign in via MiniKit, store session
- Practice Mode localStorage with tamper detection (no server validation)
- Call backend APIs for entry validation, score submission, leaderboard data
- Handle game state transitions (playing, crashed, continuing)

**Supabase Realtime Management:**
- **Subscription Setup:** Subscribe to Supabase Realtime on entries table for live leaderboard updates
- **Cleanup:** Unsubscribe on componentWillUnmount (or useEffect cleanup) to prevent memory leaks
- **Connection Drop Handling:** Auto-reconnect logic; if still offline, show "Connection Lost" state and pause game interactions
- **Rate Limiting:** Throttle leaderboard updates to every 1–2 seconds client-side to prevent UI spam
- **Error Handling:** Graceful fallback to manual refresh if realtime fails

- **What:** Manages frontend behavior
- **Why:** Provides interactive gameplay and data sync

### ⚙️ Backend Responsibilities

Built with Next.js API routes + Supabase, handles sensitive operations and validation.

#### 2.3 Core APIs (/api/*)

- `/api/entry/validate`: Verifies MiniKit proof, records new entry
- `/api/entry/continue`: Validates continue payment for existing entry
- `/api/score/submit`: Validates and stores highest score
- `/api/leaderboard`: Fetches Top 10 with infinite scroll pagination, user rank highlighting
- `/api/tournament/stats`: Returns player count, prize pool, countdown
- `/api/admin/distribute-prizes` (Admin-only): Calculates winners, requires manual World App confirmation

- **What:** Defines API endpoints
- **Why:** Centralizes secure data processing

#### 2.3.1 Shared Utility Functions (/utils/)

**Purpose:** Eliminate code duplication and ensure consistent validation across all APIs

**Core Utilities:**
- `validateWorldIDProof(proof, nonce)`: Server-side World ID verification with nonce validation
- `isTournamentActive()`: Tournament timing validation (prevents entries during 15:00-15:30 UTC grace period)
- `validateScore(score, gameDuration)`: Score validation (max 999, minimum 5 seconds game duration)
- `retryOperation(operation, maxRetries)`: Retry logic with exponential backoff for database operations

**Implementation Example:**
```javascript
// utils/tournament.js
export const isTournamentActive = () => {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  
  // Grace period: 15:00-15:30 UTC
  if (utcHour === 15 && utcMinute >= 0 && utcMinute < 30) {
    return { active: false, reason: "Tournament in grace period" };
  }
  return { active: true };
};
```

- **What:** Create reusable functions to eliminate code duplication across APIs
- **Why:** Reduces bugs, easier maintenance, consistent validation logic
- **Usage:** Import and use in all relevant APIs instead of duplicating timing logic

#### 2.4 Backend Validation Logic

- Verify all MiniKit proofs server-side with nonce and signed payment proof
- Handle continue payments by updating existing entries
- Prevent duplicate submissions/invalid scores
- Track tournaments via created_at timestamps
- Apply RLS rules via Supabase policies
- Reject entries during grace period (15:00–15:30 UTC)

**Race Condition Prevention:**
- **Database Locking:** Use PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) on score updates
- **Retry Logic:** Implement exponential backoff retry mechanism (3 attempts max: 1s, 2s, 4s delays)
- **Client-side Rate Limiting:** Prevent rapid submissions (maximum 1 score submission per 2 seconds per user)
- **Queue Management:** Queue rapid submissions client-side to prevent server overload

**Implementation Example:**
```sql
-- In /api/score/submit
BEGIN;
SELECT * FROM entries WHERE id = $entry_id FOR UPDATE; -- Row lock
UPDATE entries SET highest_score = $new_score WHERE id = $entry_id AND $new_score > highest_score;
COMMIT;
```

- **What:** Ensures data integrity
- **Why:** Prevents cheating and enforces rules

### ❌ What NOT to Do

| ❌ Mistake | Why It's Bad |
|------------|--------------|
| Frontend submits scores directly to Supabase | Easy to cheat via browser console |
| Trust client-side scores without validation | Allows fake scores (e.g., 999999 via Postman) |
| Expose admin wallet in frontend | Risks draining if bugs are exploited |
| Skip Supabase RLS | Data vulnerable to unauthorized access |

- **What:** Lists common pitfalls
- **Why:** Prevents security and integrity issues

---

## ✅ Section 3: Database Schema

### 📁 Supabase Tables (PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,
  username TEXT,
  is_orb_verified BOOLEAN DEFAULT false,
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
```

### 📊 Database Indexes (Performance Optimization)

```sql
-- Critical performance indexes
CREATE INDEX idx_entries_tournament_id ON entries(tournament_id);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_tournament_day ON entries(tournament_day);
CREATE INDEX idx_entries_highest_score ON entries(highest_score DESC);
CREATE INDEX idx_users_wallet ON users(wallet);
CREATE INDEX idx_tournaments_day ON tournaments(tournament_day);
CREATE INDEX idx_tournaments_active ON tournaments(is_active);

-- Composite index for optimized leaderboard queries
CREATE INDEX idx_entries_tournament_score ON entries(tournament_id, highest_score DESC, created_at ASC);

-- Unique constraint to prevent race conditions
CREATE UNIQUE INDEX idx_unique_user_tournament 
ON entries(user_id, tournament_id) 
WHERE continue_used = false;
```

### 🔧 Database Helper Functions

```sql
-- Get current active tournament
CREATE OR REPLACE FUNCTION get_current_tournament()
RETURNS UUID AS $$
DECLARE
  current_tournament_id UUID;
BEGIN
  SELECT id INTO current_tournament_id
  FROM tournaments 
  WHERE is_active = true 
  AND tournament_day = CURRENT_DATE
  LIMIT 1;
  
  IF current_tournament_id IS NULL THEN
    RAISE EXCEPTION 'No active tournament found for today';
  END IF;
  
  RETURN current_tournament_id;
END;
$$ LANGUAGE plpgsql;

-- Race condition safe score update
CREATE OR REPLACE FUNCTION update_highest_score(
  p_entry_id UUID,
  p_user_id UUID,
  p_new_score INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  UPDATE entries 
  SET highest_score = p_new_score,
      updated_at = NOW()
  WHERE id = p_entry_id 
    AND user_id = p_user_id 
    AND p_new_score > highest_score;
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql;

-- Automated cleanup for old tournaments
CREATE OR REPLACE FUNCTION cleanup_old_tournaments()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted_tournaments AS (
    DELETE FROM tournaments 
    WHERE created_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted_tournaments;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

### ⏰ Database Constraints & Automation

```sql
-- Prevent entries to inactive tournaments
ALTER TABLE entries 
ADD CONSTRAINT check_tournament_active 
CHECK (
  EXISTS (
    SELECT 1 FROM tournaments t 
    WHERE t.id = tournament_id 
    AND t.is_active = true
  )
);

-- Schedule daily cleanup (requires pg_cron extension)
SELECT cron.schedule(
  'cleanup-old-tournaments',
  '0 2 * * *', -- Daily at 2 AM UTC
  'SELECT cleanup_old_tournaments();'
);
```

### Leaderboard Query Logic

```sql
-- Optimized leaderboard query with current tournament
SELECT 
  u.id as user_id,
  u.username,
  u.wallet,
  MAX(e.highest_score) as best_score,
  MIN(e.created_at) as first_entry_time,
  ROW_NUMBER() OVER (ORDER BY MAX(e.highest_score) DESC, MIN(e.created_at) ASC) as rank
FROM entries e
JOIN users u ON e.user_id = u.id  
WHERE e.tournament_id = get_current_tournament()
GROUP BY u.id, u.username, u.wallet
ORDER BY best_score DESC, first_entry_time ASC
LIMIT 10;
```

**Data Storage & Archiving:**
- **Tournament ID System:** Each tournament gets unique tournament_id in database
- **Historical Data:** Old tournament scores archived for 7 days for dispute checks, then deleted to save costs
- **Admin Archive:** Archive page available for admins to review past results
- **Score Validation:**
  - Max score cap of 999
  - Min game duration 5 seconds
  - Server-side logic only accepts scores from verified game sessions

- **What:** Defines database structure and queries
- **Why:** Ensures secure, scalable data management with Supabase

---

## ✅ Section 4: Game Flow Implementation

### 🟢 Tournament Entry Flow

#### Frontend:
- User selects Tournament Mode, chooses Verified/Non-Verified
- Trigger MiniKit pay() (1.0/0.9 WLD)
- Send proof to /api/entry/validate
- Start game after backend confirmation

- **What:** Initiates tournament play
- **Why:** Ensures secure entry with payment verification

#### Backend (/api/entry/validate):
- Verify World ID proof server-side with nonce and signed payment proof
- Check tournament is active (before 15:00 UTC)
- Create new entries row
- Return entry_id

- **What:** Validates and records entry
- **Why:** Prevents invalid entries and enforces timing

#### Database:
- Insert entry: continue_used = false, store world_id_proof, paid_amount, is_verified_entry

- **What:** Logs entry details
- **Why:** Provides audit trail and state tracking

### 🟢 Continue System Flow

#### Frontend:
- First crash: Show "Continue?" modal with same payment amount
- If confirmed: Trigger MiniKit pay(), send proof to /api/entry/continue
- Resume game from same score

- **What:** Manages crash recovery
- **Why:** Retains player progress with payment

#### Backend (/api/entry/continue):

```sql
UPDATE entries 
SET continue_used = true, 
    continue_paid_at = NOW(),
    updated_at = NOW()
WHERE id = $entry_id 
  AND user_id = $user_id 
  AND continue_used = false
  AND tournament_day = CURRENT_DATE;
```

- **What:** Updates entry status
- **Why:** Enforces one continue per entry

#### Edge Cases:
- Second crash: Require new entry (new payment)
- One continue per entry (continue_used flag)
- Score submitted after any crash (if highest) or game end

- **What:** Handles exceptions
- **Why:** Ensures fairness and clarity

### 🟢 Score Submission Flow

#### Frontend:
- On game end or crash: Send score + entry_id to /api/score/submit (if score > 0 and session valid)

- **What:** Submits player scores
- **Why:** Updates leaderboard with valid scores

#### Backend (/api/score/submit):

```sql
-- Use race condition safe function instead of direct UPDATE
SELECT update_highest_score($entry_id, $user_id, $new_score);
```

**Race Condition Prevention:**
- Uses dedicated database function `update_highest_score()` for atomic operations
- PostgreSQL row-level locking prevents concurrent score overwrites
- Unique constraints prevent duplicate entries per tournament
- Exponential backoff retry mechanism for failed operations

- **What:** Updates highest score
- **Why:** Ensures only the best score is recorded

#### Validation Rules:
- Entry belongs to authenticated user
- Entry from current tournament day
- Score higher than existing score
- No scores >999 (anti-cheat)

- **What:** Validates submissions
- **Why:** Prevents cheating

### 🟢 Practice Mode Implementation

#### localStorage Coin System:

```javascript
// Tamper-resistant coin storage for Practice Mode
const COINS_KEY = 'flappy_ufo_coins';
const COINS_HASH_KEY = 'flappy_ufo_coins_hash';
const SALT = 'ufo_secret_2024'; // SALT ensures tamper detection

// Save coins with hash to prevent manual edits
function saveCoins(amount) {
  const hash = btoa(`${amount}_${SALT}`);
  localStorage.setItem(COINS_KEY, amount.toString());
  localStorage.setItem(COINS_HASH_KEY, hash);
}

// Load coins; reset to 0 if tampered
function loadCoins() {
  const coins = localStorage.getItem(COINS_KEY) || '0';
  const storedHash = localStorage.getItem(COINS_HASH_KEY);
  const expectedHash = btoa(`${coins}_${SALT}`);
  return storedHash === expectedHash ? parseInt(coins) : 0;
}

// Usage: Star collection (+2 coins), Continue (-10 coins)
// Note: Hash check prevents users from editing localStorage coins via DevTools
```

**Tamper Detection:** Coins stored with a hash using SALT. If localStorage is edited, hash mismatch resets coins to 0.

- **What:** Manages in-game currency
- **Why:** Provides a secure, persistent coin system for Practice Mode

#### Frontend:
- Start game instantly (no login required)
- Stars give 2 coins each
- Use 10 coins to continue

- **What:** Implements Practice Mode gameplay
- **Why:** Offers a free, engaging experience

#### Backend:
- No score submission
- Coins handled in localStorage only

- **What:** Limits backend role
- **Why:** Keeps Practice Mode lightweight

#### DB:
- No rows inserted for Practice Mode

- **What:** Excludes Practice data from DB
- **Why:** Avoids unnecessary storage

#### Edge Cases:
- Same physics as Tournament Mode
- Unlimited replays

- **What:** Ensures consistency
- **Why:** Maintains game integrity

### 🟢 Leaderboard & Real-time Updates

#### Frontend:
- Subscribe to Supabase Realtime on entries table
- Auto-refresh leaderboard on score updates
- Show Top 10 + user rank (if outside Top 10)
- Display tournament stats (player count, prize pool, countdown)

- **What:** Manages leaderboard UI
- **Why:** Provides live competition feedback

#### Backend (/api/tournament/stats):

```sql
SELECT 
  COUNT(DISTINCT user_id) as total_players,
  SUM(paid_amount) * 0.70 as prize_pool,
  COUNT(*) as total_entries
FROM entries 
WHERE e.tournament_day = CURRENT_DATE;
```

- **What:** Retrieves live stats
- **Why:** Supports real-time updates

### 🟢 Payout Flow (Admin Only)

**Admin Dashboard Architecture:**
- **Authentication:** Simple admin wallet verification - check wallet address matches `ADMIN_WALLET_ADDRESS` environment variable
- **Database Access:** Connect to same Supabase database using service role key for admin operations
- **Deployment:** Separate frontend (e.g., Netlify-hosted) for admin dashboard
- **Security:** Basic authentication with admin wallet address verification only
Created in Html CSS and Java Script

**Payout Process:**
- **Payout Trigger:** Semi-automated with manual override via admin dashboard at 15:35 UTC
- **Winner Calculation:** Top 10 from leaderboard at tournament close (15:30 UTC)
- **Prize Pool Snapshot:** Taken exactly at tournament end (15:30 UTC) to lock amounts before payouts
- Triggers /api/admin/distribute-prizes via button click
- Shows confirmation modal with winner list and amounts
- Uses sendTransaction() for payouts, requiring manual World App confirmation per transaction
- **Manual Process:** Each payment requires individual admin confirmation in World App (technical requirement due to MiniKit limitations)

**Admin Dashboard Features:**
- **Full Payout History:** Admin dashboard shows complete payout history for every past tournament
- **Pending Payouts:** View and retry failed transactions from pending_prizes table
- **Simulation Mode:** Test payout amounts and winner calculations before sending actual WLD

#### Backend (/api/admin/distribute-prizes):
- Fetches Top 10 scores from entries table for current tournament_id
- Calculates prize shares (70% of WLD collected)
- **Partial Failure Handling:** Failed payouts stored in pending_prizes table for retry
- Sends payout instructions to frontend

- **What:** Manages prize distribution
- **Why:** Ensures manual oversight and retry capability

#### Database:
- Uses entries table for winners
- Stores failed payouts in pending_prizes for retry via dashboard

- **What:** Tracks payouts
- **Why:** Ensures no winner is missed

#### Edge Cases:
- One payout per day (15:35 UTC)
- Retry failed payouts via admin dashboard, using the pending_prizes table to track and retry transactions

- **What:** Handles exceptions
- **Why:** Guarantees payout completion

### 🟢 Info Button (ⓘ Modal)

#### Frontend:
- (ⓘ) icon on Home screen
- Modal shows: Game description, tournament rules, prize info, contact/help

- **What:** Provides help content
- **Why:** Improves user understanding

#### Backend:
- No backend needed

- **What:** Relies on frontend
- **Why:** Keeps it simple

#### Edge Cases:
- Content updateable via frontend

- **What:** Allows updates
- **Why:** Supports future changes

---

## ✅ Section 5: Security Implementation

### 🔒 Frontend Security

- JS obfuscation only (reviewers need DevTools access)
- Practice Mode coins in localStorage with tamper detection
- Client-side rate limiting on score submissions
- No sensitive data stored in browser beyond coins
- Optional warning for network monitoring

- **What:** Secures frontend
- **Why:** Prevents cheating while allowing review

### 🧠 Backend Validation

- World ID proof verification with nonce and signed payment proof for all entries
- Score validation: Max 999, min duration 5 seconds
- Continue payment tracking via DB flags
- Prevent duplicate proof submissions
- Admin wallet verification for payout APIs
- Tournament timing enforcement (no entries during grace period)

- **What:** Validates data
- **Why:** Ensures fairness and security

### 🛡️ Supabase RLS Policies

```sql
-- users table: Users can only view/edit their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR ALL USING (auth.uid() = id);

-- entries table: Users can view own entries; service role manages all
CREATE POLICY "Users can view own entries" ON entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage entries" ON entries
  FOR ALL WITH CHECK (auth.role() = 'service_role');

-- prizes table: Users can view own prizes; service role inserts
CREATE POLICY "Users can view own prizes" ON prizes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert prizes" ON prizes
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- pending_prizes table: Same as prizes
CREATE POLICY "Users can view own pending prizes" ON pending_prizes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage pending prizes" ON pending_prizes
  FOR ALL WITH CHECK (auth.role() = 'service_role');
```

> **Note:** auth.uid() maps to Supabase Auth ID; service_role is for backend operations only. Copy SQL directly and test in Supabase dashboard.

- **What:** Restricts data access
- **Why:** Enhances security with row-level control

### 🧪 Anti-Abuse Protection

- No scores submitted <5 seconds (min game duration)
- Max score 999
- Rate limit: 1 score submission per 10 seconds per user
- Reject duplicate World ID proofs
- Enforce one continue per entry
- **World ID Prevention:** Multiple account prevention relies fully on World ID; no device fingerprinting needed
- **Bot Protection:** Basic JavaScript obfuscation plus server-side validation to ensure scores are from legitimate sessions
- Detect bot entries and leaderboard fraud

- **What:** Prevents abuse
- **Why:** Maintains game integrity

---

## ✅ Section 6: Environment & Deployment

### 6.1 Environment Variables

```bash
# Public (Frontend)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_ID=...
NEXT_PUBLIC_ENV=dev|prod

# Private (Backend only)
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_WALLET_ADDRESS=...
WORLD_ID_APP_ID=...
WORLD_ID_ACTION=...

# Environment-specific databases
SUPABASE_PROD_URL=https://prod-project.supabase.co
SUPABASE_DEV_URL=https://dev-project.supabase.co
SUPABASE_PROD_SERVICE_KEY=prod_service_role_key
SUPABASE_DEV_SERVICE_KEY=dev_service_role_key
```

**Database Connection Management:**
```javascript
// Environment-specific database configuration
const supabaseUrl = process.env.NEXT_PUBLIC_ENV === 'production' 
  ? process.env.SUPABASE_PROD_URL 
  : process.env.SUPABASE_DEV_URL;

const supabaseKey = process.env.NEXT_PUBLIC_ENV === 'production' 
  ? process.env.SUPABASE_PROD_SERVICE_KEY 
  : process.env.SUPABASE_DEV_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
```

**Validation:** Check all variables at backend startup (e.g., `if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase service role key')`).

#### Security Notes:
- Use deployment platform secrets (not .env files)
- Separate keys for dev/prod
- Never push secrets to GitHub
- Include .env.sample (keys without values)
- Prevent prod secret leaks to dev

- **What:** Manages configuration
- **Why:** Ensures secure, environment-specific setup

### 6.2 Deployment Strategy

- **Frontend:** Vercel (separate dev/prod deployments)
- **Backend:** Supabase (separate dev/prod databases)
- **Version Control:** `GitHub` (main + dev branches)
- **Payouts:** Admin dashboard (Netlify) for semi-automated prize distribution

- **What:** Defines deployment process
- **Why:** Enables scalable, isolated environments

### 6.3 Downtime Handling

**Goal:** Ensure paid entries/scores are never lost during Supabase outages.

#### Prevention:
- Check Supabase health before accepting payments
- If down: Show "Tournament temporarily unavailable."

#### Mid-Game Protection:
- **If downtime occurs mid-game:**
  - Scores stored in memory + localStorage temporarily
  - Background sync retries until Supabase is back online
  - Players see positive status message: "We're syncing your score — it will appear as soon as the tournament updates."
  - **Ongoing games allowed to finish**, but final validation happens only after reconnection
- **Player Trust:** Outages are rare (99%+ uptime); communicate reliability

- **What:** Handles service disruptions
- **Why:** Protects player progress and trust

### 6.4 Logging

- Use structured logging (e.g., winston or pino) for entry validation, score submission, and payout triggers
- Log to file/service in prod; verbose logs in dev (process.env.NODE_ENV !== 'production')

- **What:** Implements logging
- **Why:** Simplifies debugging and monitoring

---

