"use client";

import { useEffect, useState, useCallback } from 'react';
import { Page } from '@/components/PageLayout';
import { TournamentLeaderboard } from '@/components/TournamentLeaderboard';
import { PlayerRankCard } from '@/components/PlayerRankCard';
import { useSession } from 'next-auth/react';
import { CACHE_TTL } from '@/utils/leaderboard-cache';

interface LeaderboardPlayer {
    id: string;
    user_id: string;
    username: string | null;
    wallet: string;
    highest_score: number;
    tournament_day: string;
    created_at: string;
    rank?: number;
}

interface LeaderboardApiResponse {
    players: LeaderboardPlayer[];
    tournament_day: string;
    total_players: number;
    cached?: boolean;
    fetched_at?: string;
    sse_update_id?: string; // For forcing React re-renders on SSE updates
}

interface TournamentData {
    id: string;
    tournament_day: string;
    is_active: boolean;
    total_players: number;
    total_prize_pool: number;
    total_collected: number;
    admin_fee: number;
    guarantee_amount?: number;
    admin_net_result?: number;
    start_time: string;
    end_time: string | null;  // Allow null when no tournament
}

export default function LeaderboardPage() {
    const { data: session } = useSession();

    // ⚡ INSTANT LOADING: Real data immediately, persist across navigation
    const [currentTournament, setCurrentTournament] = useState<TournamentData | null>(() => {
        // 🧹 QUICK FIX: Add cache clearing to browser console
        if (typeof window !== 'undefined') {
            // @ts-expect-error - Debug helper
            window.clearGameCache = () => {
                console.log('🧹 Clearing all game caches...');
                sessionStorage.clear();
                localStorage.clear();
                window.location.reload();
            };
        }

        // Try to get cached data first for instant loading
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('tournament_data');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    // Use cached data immediately regardless of timestamp for speed
                    console.log('⚡ INSTANT LOAD: Using cached tournament data');
                    console.log(`   Cached Players: ${parsed.data.total_players}`);
                    console.log(`   Cached Prize: $${parsed.data.total_prize_pool}`);
                    return parsed.data;
                } catch (e) {
                    console.warn('Cache parse error:', e);
                }
            }
        }

        // Return null - will show loading blur until data loads
        return null;
    });

    const [preloadedLeaderboardData, setPreloadedLeaderboardData] = useState<LeaderboardApiResponse | null>(() => {
        // Load cached data immediately for instant display
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('leaderboard_data');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    // Use cached data immediately for speed
                    console.log('⚡ INSTANT LOAD: Using cached leaderboard data');
                    return parsed.data;
                } catch {
                    // Ignore cache parse errors
                }
            }
        }
        return null;
    });
    const [currentUserRank, setCurrentUserRank] = useState<LeaderboardPlayer | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [shouldShowFixedCard, setShouldShowFixedCard] = useState(false);
    const [showPrizeBreakdown, setShowPrizeBreakdown] = useState(false);

    // 🧹 DATABASE RESET DETECTION: Clear cache when database is reset
    useEffect(() => {
        const checkForDatabaseReset = async () => {
            if (typeof window === 'undefined') return;

            try {
                // Get current database state
                const leaderboardRes = await fetch('/api/tournament/leaderboard-data');
                const leaderboardData = await leaderboardRes.json();

                // Check cached data
                const cachedLeaderboard = sessionStorage.getItem('leaderboard_data');

                if (cachedLeaderboard) {
                    const parsedLeaderboard = JSON.parse(cachedLeaderboard);

                    // Detect database reset: cached data has more players than current database
                    const cachedPlayerCount = parsedLeaderboard?.data?.players?.length || 0;
                    const currentPlayerCount = leaderboardData?.players?.length || 0;

                    // 🚨 AGGRESSIVE RESET DETECTION: Clear cache if ANY of these conditions:
                    // 1. Cached has more players than current (database reset)
                    // 2. Current database has 0 players but cache has players (fresh reset) 
                    // 3. Tournament day mismatch (new tournament created)
                    // 4. ANY cached data exists when database is empty (safest approach)
                    const cachedTournamentDay = parsedLeaderboard?.data?.tournament_day;
                    const currentTournamentDay = leaderboardData?.tournament_day;

                    const shouldClearCache = (
                        cachedPlayerCount > currentPlayerCount || // Database reset detected
                        (currentPlayerCount === 0 && cachedPlayerCount >= 0) || // ANY cache when DB is empty
                        (cachedTournamentDay && currentTournamentDay && cachedTournamentDay !== currentTournamentDay) || // Tournament change
                        !leaderboardData?.players || // No current data available
                        leaderboardData?.players?.length === 0 // Explicit empty database
                    );

                    if (shouldClearCache) {
                        console.log('🚨 CACHE CLEAR TRIGGERED - DATABASE RESET OR FRESH STATE!');
                        console.log(`   Cached players: ${cachedPlayerCount}`);
                        console.log(`   Current players: ${currentPlayerCount}`);
                        console.log(`   Cached tournament: ${cachedTournamentDay}`);
                        console.log(`   Current tournament: ${currentTournamentDay}`);
                        console.log('   🧹 CLEARING ALL CACHE AND FORCING FRESH LOAD...');

                        // Clear all browser cache immediately
                        sessionStorage.clear();
                        localStorage.clear();

                        // Force reload to get fresh data
                        window.location.reload();
                        return;
                    }
                }
            } catch (error) {
                console.warn('Cache check failed:', error);
            }
        };

        checkForDatabaseReset();
    }, []); // Run once on mount

    // 🧹 TOURNAMENT RESET DETECTION: Clear cache when tournament day changes
    useEffect(() => {
        const checkAndClearStaleCache = () => {
            if (typeof window === 'undefined') return;

            try {
                // Get cached tournament data
                const cachedTournament = sessionStorage.getItem('tournament_data');

                if (!cachedTournament) return;

                const parsed = JSON.parse(cachedTournament);
                const cachedTournamentDay = parsed?.data?.tournament_day;

                // If we have cached data, fetch current tournament to compare
                fetch('/api/tournament/stats')
                    .then(res => res.json())
                    .then(tournament => {
                        const currentTournamentDay = tournament.tournament_day;

                        // If tournament day changed, clear all caches
                        if (cachedTournamentDay && currentTournamentDay &&
                            cachedTournamentDay !== currentTournamentDay) {

                            console.log('🧹 TOURNAMENT RESET DETECTED!');
                            console.log(`   Old tournament: ${cachedTournamentDay}`);
                            console.log(`   New tournament: ${currentTournamentDay}`);
                            console.log('   Clearing all cached data...');

                            // Clear all tournament-related cache
                            sessionStorage.removeItem('tournament_data');
                            sessionStorage.removeItem('leaderboard_data');
                            sessionStorage.removeItem('preloaded_tournament');
                            sessionStorage.removeItem('preloaded_leaderboard');

                            // Clear environment-specific cache keys too
                            const envPrefix = process.env.NODE_ENV === 'production' ? 'prod_' : 'dev_';
                            sessionStorage.removeItem(`${envPrefix}preloaded_tournament`);
                            sessionStorage.removeItem(`${envPrefix}preloaded_leaderboard`);

                            console.log('✅ All stale tournament cache cleared');

                            // Force refresh the page data
                            window.location.reload();
                        }
                    })
                    .catch(err => {
                        console.warn('Tournament day check failed:', err);
                    });

            } catch (error) {
                console.warn('Cache check failed:', error);
            }
        };

        // Check for stale cache on component mount
        checkAndClearStaleCache();

        // Also check periodically (every 30 seconds) to catch tournament changes
        const interval = setInterval(checkAndClearStaleCache, 30000);

        return () => clearInterval(interval);
    }, []);

    // ⚡ FAST LOADING: Use existing Redis-cached APIs with instant display
    useEffect(() => {
        const loadEssentialData = async () => {
            try {

                // Try cached data first for instant display
                if (typeof window !== 'undefined') {
                    const cachedTournament = sessionStorage.getItem('tournament_data');
                    const cachedLeaderboard = sessionStorage.getItem('leaderboard_data');

                    if (cachedTournament && cachedLeaderboard) {
                        try {
                            const parsedTournament = JSON.parse(cachedTournament);
                            const parsedLeaderboard = JSON.parse(cachedLeaderboard);

                            if (Date.now() - parsedTournament.timestamp < CACHE_TTL.TOURNAMENT &&
                                Date.now() - parsedLeaderboard.timestamp < CACHE_TTL.LEADERBOARD) {

                                setCurrentTournament(parsedTournament.data);
                                setPreloadedLeaderboardData(parsedLeaderboard.data);
                                console.log('⚡ INSTANT DISPLAY: Using cached data');
                            }
                        } catch (e) {
                            console.warn('Cache parse error:', e);
                        }
                    }
                }

                // 🚀 PARALLEL API CALLS: Tournament stats (fast) + Leaderboard (correct data)
                const [tournamentResponse, leaderboardResponse] = await Promise.all([
                    fetch('/api/tournament/stats'),  // Fast for tournament stats
                    fetch('/api/tournament/leaderboard-data')  // Correct data for players
                ]);

                const [tournamentData, leaderboard] = await Promise.all([
                    tournamentResponse.json(),
                    leaderboardResponse.json()
                ]);

                const newTournamentData: TournamentData = {
                    id: 'current',
                    tournament_day: tournamentData.tournament_day,
                    is_active: true,
                    total_players: tournamentData.total_players,
                    total_prize_pool: tournamentData.total_prize_pool,
                    total_collected: tournamentData.total_collected || 0,
                    admin_fee: tournamentData.admin_fee || 0,
                    guarantee_amount: tournamentData.guarantee_amount || 0,
                    admin_net_result: tournamentData.admin_net_result || 0,
                    start_time: new Date().toISOString(),
                    end_time: tournamentData.end_time || null
                };

                // Update both tournament and leaderboard data
                setCurrentTournament(newTournamentData);
                setPreloadedLeaderboardData(leaderboard);

                // Cache for next instant load
                sessionStorage.setItem('tournament_data', JSON.stringify({
                    data: newTournamentData,
                    timestamp: Date.now()
                }));

                sessionStorage.setItem('leaderboard_data', JSON.stringify({
                    data: leaderboard,
                    timestamp: Date.now()
                }));

                console.log(`⚡ PARALLEL DATA LOADED: ${tournamentData.total_players} players, ${tournamentData.total_prize_pool} WLD, ${leaderboard.players?.length || 0} entries`);

            } catch (error) {
                console.error('Essential data load failed:', error);
                setError('Failed to load tournament data');
            }
        };

        // Load once on mount - Redis cache + periodic refresh handles updates
        loadEssentialData();

        // 🚀 SSE CONNECTION: Listen for instant tournament stats updates
        if (currentTournament?.tournament_day) {
            console.log('🔥 Starting SSE for tournament stats updates...');

            const eventSource = new EventSource(`/api/leaderboard/stream?tournament_day=${encodeURIComponent(currentTournament.tournament_day)}`);

            eventSource.addEventListener('tournament_stats_update', (event) => {
                const data = JSON.parse(event.data);

                // Update tournament data instantly without cache clearing
                if (data.stats) {
                    setCurrentTournament(prev => prev ? {
                        ...prev,
                        total_players: data.stats.total_players || prev.total_players,
                        total_prize_pool: data.stats.total_prize_pool || prev.total_prize_pool,
                        total_collected: data.stats.total_collected || prev.total_collected
                    } : prev);
                }
            });

            // Add leaderboard update listener
            eventSource.addEventListener('leaderboard_update', (event) => {
                const data = JSON.parse(event.data);

                if (data.players) {
                    const leaderboardData = {
                        players: data.players,
                        tournament_day: data.tournament_day,
                        total_players: data.players.length,
                        cached: true,
                        fetched_at: data.timestamp,
                        // Add unique identifier for change detection
                        sse_update_id: `sse_${Date.now()}_${Math.random()}`
                    };

                    // Update data directly without aggressive cache clearing
                    setPreloadedLeaderboardData(leaderboardData);
                } else {
                    console.warn('⚠️ SSE leaderboard update missing players data');
                }
            });

            eventSource.onerror = (error) => {
                console.error('❌ SSE tournament stats connection error:', error);
            };

            return () => {
                console.log('🛑 Closing SSE tournament stats connection');
                eventSource.close();
            };
        }

        // NO POLLING - Instant updates handled by SSE + Redis cache
    }, [currentTournament?.tournament_day]); // Load once, rely on SSE + Redis cache updates
    const handleUserRankUpdate = useCallback((userRank: LeaderboardPlayer | null) => {
        setCurrentUserRank(userRank);
        // We'll handle visibility based on scroll position, not rank number
    }, []);

    const handleUserCardVisibility = useCallback((isVisible: boolean) => {
        // Show fixed card only when user's actual card is NOT visible in viewport
        setShouldShowFixedCard(!isVisible && currentUserRank !== null);
    }, [currentUserRank]);

    const calculatePrizeForRank = useCallback((rank: number, totalPrizePool: number): string | null => {
        if (rank > 10) return null;

        // Plan.md compliant prize percentages
        const prizePercentages = [40, 22, 14, 6, 5, 4, 3, 2, 2, 2];
        const percentage = prizePercentages[rank - 1] || 0;
        const prizeAmount = (totalPrizePool * percentage) / 100;

        return prizeAmount.toFixed(2);
    }, []);

    const scrollToUserPosition = useCallback(() => {
        if (!currentUserRank?.rank) return;

        // Find the user's card in the leaderboard by rank
        const userCardElement = document.querySelector(`[data-rank="${currentUserRank.rank}"]`);

        if (userCardElement) {
            // Scroll to the user's card with smooth behavior
            userCardElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }, [currentUserRank]);

    // ⚡ SIMPLE & FAST: Just load data once, no intervals, no complex cache logic  
    useEffect(() => {
        // Update time every second for countdown
        const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timeInterval);
    }, []);

    // Calculate time remaining
    const getTimeRemaining = () => {
        console.log('🔍 Timer Debug:', {
            currentTournament: currentTournament,
            end_time: currentTournament?.end_time,
            currentTime: currentTime
        });

        if (!currentTournament || !currentTournament.end_time) return null;

        const now = currentTime.getTime();
        const endTime = new Date(currentTournament.end_time).getTime();
        const timeDiff = endTime - now;

        if (timeDiff <= 0) {
            return {
                status: 'ended' as const,
                timeLeft: 'Tournament Ended'
            };
        }

        // Grace period: 30 minutes before end
        const gracePeriodStart = endTime - (30 * 60 * 1000);
        if (now >= gracePeriodStart) {
            const minutes = Math.floor(timeDiff / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            return {
                status: 'grace' as const,
                timeLeft: `${minutes}m ${seconds}s left`
            };
        }

        // Regular countdown
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        let timeDisplay = '';
        if (days > 0) timeDisplay += `${days}d `;
        if (hours > 0) timeDisplay += `${hours}h `;
        if (minutes > 0) timeDisplay += `${minutes}m `;
        if (seconds > 0) timeDisplay += `${seconds}s`;

        return {
            status: 'active' as const,
            timeLeft: timeDisplay
        };
    };

    const timeRemaining = getTimeRemaining();

    // 🚀 Show error only if there's a critical error (rare since we have fallback data)
    if (error) {
        return (
            <Page>
                <Page.Main className="main-container">
                    <div className="header-section">
                        <div className="epic-title-section">
                            <h1 className="epic-title">🏆 LEADERBOARD</h1>
                            <div className="error-text">{error || 'No active tournament'}</div>
                        </div>
                    </div>
                    <div className="play-section">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="custom-play-btn"
                        >
                            BACK TO GAME
                        </button>
                    </div>

                    <div className="bottom-nav-container">
                        <div className="space-nav-icons">
                            <button
                                className="space-nav-btn home-nav"
                                onClick={() => window.location.href = '/'}
                                aria-label="Launch Pad"
                            >
                                <div className="space-icon">🏠</div>
                            </button>
                            <button
                                className="space-nav-btn prizes-nav"
                                onClick={() => {/* Already on leaderboard page - no action needed */ }}
                                aria-label="Leaderboard"
                            >
                                <div className="space-icon">🏆</div>
                            </button>
                        </div>
                    </div>
                </Page.Main>
            </Page>
        );
    }

    return (
        <Page>
            <Page.Main className="leaderboard-container">
                {/* Fixed Tournament Title at Very Top */}
                <div className="tournament-main-title">
                    <h1>🏆 TOURNAMENT</h1>
                </div>

                {/* Scrollable Content Area */}
                <div className="leaderboard-scroll-content">
                    {/* Tournament Info Box - scrolls naturally with content */}
                    <div className="tournament-info-box">
                        {/* Timer Box - Always show when tournament exists */}
                        {timeRemaining && timeRemaining.timeLeft && (
                            <div className="countdown-timer">
                                ⚡ Tournament ends in {timeRemaining.timeLeft}
                            </div>
                        )}

                        {/* Prize Pool Info */}
                        <div className="prize-pool-info">
                            <div className="prize-pool-text">
                                Prize pool: <span className={`prize-pool-highlight ${!currentTournament ? 'loading-blur' : ''}`}>
                                    {currentTournament
                                        ? `${currentTournament.total_prize_pool.toFixed(2)} WLD`
                                        : 'Loading...'}
                                </span>
                            </div>
                            <div className="players-text">
                                <span className={`human-count-number ${!currentTournament ? 'loading-blur' : ''}`}>
                                    {currentTournament
                                        ? currentTournament.total_players
                                        : '...'}
                                </span> <span className="humans-playing-highlight">humans are playing to win the prize pool</span>
                            </div>
                        </div>

                        {/* Prize Info */}
                        <div className="prize-info-box">
                            <span className="prize-info-text">
                                When the game ends, the prize will be shared to the top winners
                            </span>
                            <button
                                className="prize-arrow-btn-right"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowPrizeBreakdown(!showPrizeBreakdown);
                                }}
                                type="button"
                            >
                                {showPrizeBreakdown ? '▲' : '▼'}
                            </button>
                        </div>

                        {/* Prize Breakdown - Always Visible with 2 per row */}
                        {showPrizeBreakdown && (
                            <div className="prize-breakdown-grid">
                                <div className="prize-row">
                                    <div className="prize-box">🥇 1st: 40%</div>
                                    <div className="prize-box">🥈 2nd: 22%</div>
                                </div>
                                <div className="prize-row">
                                    <div className="prize-box">🥉 3rd: 14%</div>
                                    <div className="prize-box">🏆 4th: 6%</div>
                                </div>
                                <div className="prize-row">
                                    <div className="prize-box">🏆 5th: 5%</div>
                                    <div className="prize-box">🏆 6th: 4%</div>
                                </div>
                                <div className="prize-row">
                                    <div className="prize-box">🏆 7th: 3%</div>
                                    <div className="prize-box">🏆 8th-10th: 2% each</div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="leaderboard-section">
                        {/* Sticky Header Row for Leaderboard */}
                        <div className="leaderboard-header-row">
                            <div className="header-rank">Rank</div>
                            <div className="header-player">Human</div>
                            <div className="header-score">Score</div>
                            <div className="header-prize">Prize</div>
                        </div>

                        <TournamentLeaderboard
                            tournamentId={currentTournament?.id}
                            currentUserId={session?.user?.walletAddress || null}
                            currentUsername={session?.user?.username || null}
                            isGracePeriod={timeRemaining?.status === 'grace'}
                            totalPrizePool={currentTournament?.total_prize_pool}
                            preloadedData={preloadedLeaderboardData} // 🚀 NEW: Pass preloaded data
                            onUserRankUpdate={handleUserRankUpdate}
                            onUserCardVisibility={handleUserCardVisibility}
                        />
                    </div>
                </div>
            </Page.Main>

            {/* Fixed user rank card - completely outside scrolling area */}
            {shouldShowFixedCard && currentUserRank && (
                <div
                    className="fixed-user-position-container clickable-fixed-card"
                    style={{
                        position: 'fixed',
                        bottom: '80px', // Above bottom navigation
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: '10px',
                        borderRadius: '10px',
                        border: '2px solid #00F5FF',
                        zIndex: 9998, // Below bottom nav but above content
                        width: 'calc(100% - 2rem)',
                        maxWidth: '500px',
                        cursor: 'pointer'
                    }}
                    onClick={scrollToUserPosition}
                >
                    <div className="scroll-indicator-icon">📍</div>
                    <PlayerRankCard
                        player={currentUserRank}
                        prizeAmount={calculatePrizeForRank(currentUserRank.rank || 1001, currentTournament?.total_prize_pool || 0)}
                        isCurrentUser={true}
                        isTopThree={currentUserRank.rank !== undefined && currentUserRank.rank <= 10}
                    />
                </div>
            )}

            {/* Fixed Bottom Navigation - completely outside scrolling area */}
            <div className="bottom-nav-container">
                <div className="space-nav-icons">
                    <button
                        className="space-nav-btn home-nav"
                        onClick={() => window.location.href = '/'}
                        aria-label="Launch Pad"
                    >
                        <div className="space-icon">🏠</div>
                    </button>
                    <button
                        className="space-nav-btn prizes-nav"
                        onClick={() => {/* Already on leaderboard - no action needed */ }}
                        aria-label="Leaderboard"
                    >
                        <div className="space-icon">🏆</div>
                    </button>
                </div>
            </div>
        </Page>
    );
}