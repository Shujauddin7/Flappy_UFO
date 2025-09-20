"use client";

import { useEffect, useState, useCallback } from 'react';
import { Page } from '@/components/PageLayout';
import { TournamentLeaderboard } from '@/components/TournamentLeaderboard';
import { PlayerRankCard } from '@/components/PlayerRankCard';
import { useSession } from 'next-auth/react';

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

    // ⚡ INSTAGRAM-STYLE INSTANT LOADING: Real data immediately, persist across navigation
    const [currentTournament, setCurrentTournament] = useState<TournamentData>(() => {
        // Try to get cached data first for instant loading
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('tournament_data');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed.timestamp < 30000) { // 30 second cache
                        console.log('⚡ INSTANT LOAD: Using cached tournament data');
                        console.log(`   Cached Players: ${parsed.data.total_players}`);
                        console.log(`   Cached Prize: $${parsed.data.total_prize_pool}`);
                        return parsed.data;
                    }
                } catch (e) {
                    console.warn('Cache parse error:', e);
                }
            }
        }

        // Fallback data - will be replaced immediately
        return {
            id: 'current',
            tournament_day: '2025-09-07',
            is_active: true,
            total_players: 0,
            total_prize_pool: 0,
            total_collected: 0,
            admin_fee: 0,
            guarantee_amount: 0,
            admin_net_result: 0,
            start_time: new Date().toISOString(),
            end_time: null // No hardcoded time - will use real DB data
        };
    });

    // Track if we have cached data to prevent unnecessary loading states
    const [hasCachedData] = useState(() => {
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('tournament_data');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    return Date.now() - parsed.timestamp < 30000;
                } catch {
                    return false;
                }
            }
        }
        return false;
    });

    const [preloadedLeaderboardData, setPreloadedLeaderboardData] = useState<LeaderboardApiResponse | null>(() => {
        // Try to load cached leaderboard data for instant display
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('leaderboard_data');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed.timestamp < 60000) { // 1 minute cache for leaderboard
                        console.log('⚡ INSTANT LOAD: Using cached leaderboard data');
                        return parsed.data;
                    }
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

    // ⚡ INSTAGRAM-STYLE DATA LOADING: Instant + persistent
    useEffect(() => {
        // Only load if we don't have cached data - prevent unnecessary requests
        if (hasCachedData) {
            console.log('⚡ SKIP LOADING: Using cached tournament data');
            return;
        }

        const loadEssentialData = async () => {
            try {
                console.log('⚡ Loading essential tournament data...');

                // Load only essential data - tournament stats (fast)
                const tournamentRes = await fetch('/api/tournament/stats');
                const tournament = await tournamentRes.json();

                if (tournament.has_active_tournament) {
                    const newTournamentData = {
                        id: tournament.tournament_day || 'current',
                        tournament_day: tournament.tournament_day || '2025-09-07',
                        is_active: true,
                        total_players: tournament.total_players || 0,
                        total_prize_pool: tournament.total_prize_pool || 0,
                        total_collected: tournament.total_collected || 0,
                        admin_fee: 0,
                        guarantee_amount: 0,
                        admin_net_result: 0,
                        start_time: tournament.tournament_start_date || new Date().toISOString(),
                        end_time: tournament.end_time || null // Use real database end_time, not hardcoded
                    };

                    setCurrentTournament(newTournamentData);

                    // ⚡ PERSISTENCE: Cache for instant loading on navigation
                    sessionStorage.setItem('tournament_data', JSON.stringify({
                        data: newTournamentData,
                        timestamp: Date.now()
                    }));

                    console.log(`⚡ Tournament data loaded: ${tournament.total_players} players, $${tournament.total_prize_pool} prize`);
                }

                // Load leaderboard data in background (not blocking UI)
                setTimeout(async () => {
                    try {
                        const leaderboardRes = await fetch('/api/tournament/leaderboard-data');
                        const leaderboard = await leaderboardRes.json();

                        if (leaderboard.players) {
                            setPreloadedLeaderboardData(leaderboard);

                            // ⚡ CACHE LEADERBOARD: Cache for instant loading
                            sessionStorage.setItem('leaderboard_data', JSON.stringify({
                                data: leaderboard,
                                timestamp: Date.now()
                            }));

                            console.log(`⚡ Leaderboard loaded: ${leaderboard.players.length} entries`);
                        }
                    } catch (err) {
                        console.warn('Background leaderboard load failed:', err);
                    }
                }, 100); // 100ms delay - UI already showing

            } catch (error) {
                console.error('Essential data load failed:', error);
                setError('Failed to load tournament data');
            }
        };

        loadEssentialData();
    }, [hasCachedData]); // Run when cache status changes
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
                                Prize pool: <span className={`prize-pool-highlight ${(!hasCachedData && (!currentTournament?.total_prize_pool || currentTournament.total_prize_pool === 0)) ? 'loading-blur' : ''}`}>
                                    {(!currentTournament?.total_prize_pool || currentTournament.total_prize_pool === 0)
                                        ? '0.00 WLD'
                                        : `${currentTournament.total_prize_pool.toFixed(2)} WLD`}
                                </span>
                            </div>
                            <div className="players-text">
                                <span className={`human-count-number ${(!hasCachedData && (!currentTournament?.total_players || currentTournament.total_players === 0)) ? 'loading-blur' : ''}`}>
                                    {(!currentTournament?.total_players || currentTournament.total_players === 0)
                                        ? '0'
                                        : currentTournament.total_players}
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