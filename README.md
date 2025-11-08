# 🛸 Flappy UFO

**Skill-based tournament game on World App with fair, transparent prize distribution**

A competitive gaming platform where players compete in weekly WLD tournaments. Winners are determined purely by skill, not luck. Built on World Chain (Optimism L2) with World ID verification to prevent Sybil attacks and ensure fair competition.

[![Live on World App](https://img.shields.io/badge/World%20App-Live-green)](https://worldcoin.org/mini-app?app_id=app_be50be72114b4758d4cbc0d2fce3aafa&app_mode=mini-app)
[![Verified](https://img.shields.io/badge/Verified-Oct%2024%202025-blue)](https://worldcoin.org/mini-app?app_id=app_be50be72114b4758d4cbc0d2fce3aafa&app_mode=mini-app)

---

## 🎮 What is Flappy UFO?

Flappy UFO is a competitive skill-based game where players enter weekly WLD tournaments and compete for cryptocurrency prizes based purely on their gaming ability. No house edge, no randomness - just pure skill competition.

### Key Features:
- **Weekly Tournaments**: Every Sunday 15:30 UTC to Sunday 15:30 UTC
- **Fair Competition**: World ID verification prevents multi-accounting and bots
- **Transparent Prizes**: 70% to winners, 30% admin fee (all on-chain)
- **Skill-Based**: Best players win - no luck or randomness
- **Dynamic Prize Pools**: Prize amounts based on tournament entries
- **Gasless Gameplay**: World Chain enables free transactions for users

---

## 📊 Current Traction

*As of November 8, 2025 (15 days since launch):*

- **659 total users** (World App Analytics)
- **196 World ID verified users** (29.7% verification rate)
- **2 tournaments completed** since Oct 24, 2025 launch
- **45+ WLD collected** total from entry fees
- **Improving conversion**: 2.3% → 5.9% (Tournament 1 vs 2)

### Engagement Metrics:
- **High verification rate**: 196 verified humans via World ID Orb
- **Strong retention**: Multiple users with 10-27 repeat visits
- **Growing conversion**: 2.3% → 5.9% proves product-market fit
- **Real demand**: Organic growth without paid marketing

---

## 💰 How Tournaments Work

### Entry Fees:
- **Standard Entry**: 1.0 WLD
- **Verified Entry**: 0.9 WLD (World ID Orb verified users)
- **Continue Fee**: 50% of entry fee (one continue per game)

### Prize Distribution (Top 10):
- **1st**: 40% | **2nd**: 22% | **3rd**: 14%
- **4th**: 6% | **5th**: 5% | **6th**: 4%
- **7th**: 3% | **8th-10th**: 2% each

**Revenue Split:**
- 70% → Prize pool for top 10 winners
- 30% → Admin fee (infrastructure + development)


---

## 🏗️ Tech Stack

**Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS  
**Backend:** Supabase (PostgreSQL), Railway (WebSocket), Upstash Redis  
**Blockchain:** World Chain (Optimism L2), World ID, MiniKit  
**Infrastructure:** Vercel, Netlify

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- World App developer account
- Required services: Supabase, Railway, Upstash Redis
- World Chain wallet for testing

### Installation

```bash
# Clone repository
git clone https://github.com/Shujauddin7/Flappy_UFO.git
cd Flappy_UFO

# Install dependencies
npm install

# Configure environment variables
# Create .env.local with required credentials:
# - Supabase (database, auth)
# - World ID (app_id, action)
# - MiniKit configuration
# - Payment endpoints
# See .env.sample for structure

# Run development server
npm run dev
```

### Configuration
- Set up Supabase database schema (PostgreSQL)
- Configure World ID verification actions
- Set up MiniKit payment flows
- Deploy WebSocket server for real-time updates
- Configure tournament scheduling system

**Note**: Full setup requires configuring multiple external services. Review the codebase for integration details.

---

## 🎯 How It Works

1. **Authenticate** with World ID in World App
2. **Pay entry fee** (1.0 or 0.9 WLD) via MiniKit
3. **Play game** - fly UFO, avoid obstacles, collect stars
4. **Submit score** - recorded automatically
5. **Win prizes** - Top 10 split 70% of prize pool
6. **Receive payout** - WLD automatically distributed

**Schedule**: Sunday 15:30 UTC to Sunday 15:30 UTC (weekly)

---

## 🛡️ Security & Fair Play

- **World ID Verification**: Prevents Sybil attacks & multi-accounting
- **Weekly Re-verification**: Resets every Sunday
- **On-chain Transparency**: All transactions on World Chain
- **No Private Keys Stored**: MiniKit handles wallets
- **Rate Limiting**: Prevents spam/abuse
- **Score Validation**: Server-side anti-cheat

---

## 🤝 Contributing

Contributions welcome! Fork, create feature branch, submit PR.

**Areas for help**: New game modes, UI/UX, performance, docs, bug fixes

---

## 📜 License

MIT License - Free to use, modify, distribute commercially. See [LICENSE](LICENSE).

---

## 📞 Contact

**Developer**: Shujauddin  
**GitHub**: [@Shujauddin7](https://github.com/Shujauddin7)  
**Live App**: [Flappy UFO on World App](https://worldcoin.org/mini-app?app_id=app_be50be72114b4758d4cbc0d2fce3aafa&app_mode=mini-app)

---

## 💡 Why Flappy UFO?

**Problem**: Most play-to-earn games are luck-based gambling with hidden house edges.

**Solution**: 100% skill-based, transparent, fair competition with World ID verification.

**Vision**: Build the fairest play-to-earn platform on World Chain.

---

## 📊 Public Good Impact

- **Players**: Fair skill-based competition, transparent prizes
- **Developers**: Open source reference for World App gaming
- **Ecosystem**: Demonstrates World Chain viability, drives World ID adoption

---

**Built with ❤️ by a solo developer in India**  
*Making Web3 gaming fair, transparent, and accessible.*
