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
    end_time: string;
}

interface PrizePoolData {
    prize_pool: {
        base_amount: number;
        guarantee_amount: number;
        final_amount: number;
    };
    guarantee_applied: boolean;
    admin_net_result: number;
}

export default function LeaderboardPage() {
    const { data: session } = useSession();
    const [currentTournament, setCurrentTournament] = useState<TournamentData | null>(null);
    const [prizePoolData, setPrizePoolData] = useState<PrizePoolData | null>(null);
    const [currentUserRank, setCurrentUserRank] = useState<LeaderboardPlayer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [shouldShowFixedCard, setShouldShowFixedCard] = useState(false);

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

    const fetchCurrentTournament = useCallback(async () => {
        try {
            setLoading(true);
            // Call our API instead of direct Supabase query (fixes permissions and timezone issues)
            const response = await fetch('/api/tournament/current');
            const data = await response.json();

            if (!response.ok) {
                console.error('Error fetching tournament:', data.error);
                setError(data.error || 'Failed to load tournament data');
                return;
            }

            setCurrentTournament(data.tournament);

            // Fetch dynamic prize pool data (with guarantee logic)
            const prizeResponse = await fetch('/api/tournament/dynamic-prizes');
            const prizeData = await prizeResponse.json();

            if (prizeResponse.ok) {
                setPrizePoolData(prizeData);
            }

            setError(null);
        } catch (err) {
            console.error('Failed to fetch tournament:', err);
            setError('Failed to load tournament data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCurrentTournament();

        // Update time every second for live countdown
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => {
            clearInterval(timeInterval);
        };
    }, [fetchCurrentTournament]);

    // Calculate time remaining for tournament (updates every second)
    const getTimeRemaining = () => {
        if (!currentTournament) return null;

        const now = currentTime;
        const tournamentEndTime = new Date(currentTournament.end_time);
        const msUntilEnd = tournamentEndTime.getTime() - now.getTime();

        // Tournament has ended
        if (msUntilEnd <= 0) {
            return {
                status: 'ended',
                timeLeft: 'Tournament ended'
            };
        }

        // Check if we're in grace period (30 minutes before end)
        const gracePeriodStart = new Date(tournamentEndTime);
        gracePeriodStart.setUTCMinutes(gracePeriodStart.getUTCMinutes() - 30);
        const isGracePeriod = now >= gracePeriodStart && now < tournamentEndTime;

        if (isGracePeriod) {
            const minutesLeft = Math.floor(msUntilEnd / (1000 * 60));
            const secondsLeft = Math.floor((msUntilEnd % (1000 * 60)) / 1000);
            return {
                status: 'grace',
                timeLeft: `${minutesLeft}m ${secondsLeft}s until tournament ends`
            };
        }

        // Calculate time until tournament end using actual end_time
        const daysLeft = Math.floor(msUntilEnd / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((msUntilEnd % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesLeft = Math.floor((msUntilEnd % (1000 * 60 * 60)) / (1000 * 60));
        const secondsLeft = Math.floor((msUntilEnd % (1000 * 60)) / 1000);

        // Format time display based on how much time is left
        let timeDisplay = '';
        if (daysLeft > 0) {
            timeDisplay = `${daysLeft}d ${hoursLeft}h ${minutesLeft}m ${secondsLeft}s until tournament ends`;
        } else {
            timeDisplay = `${hoursLeft}h ${minutesLeft}m ${secondsLeft}s until tournament ends`;
        }

        return {
            status: 'active',
            timeLeft: timeDisplay
        };
    };

    const timeRemaining = getTimeRemaining();

    if (loading) {
        return (
            <Page>
                <Page.Main className="main-container">
                    <div className="header-section">
                        <div className="epic-title-section">
                            <h1 className="epic-title">🏆 LEADERBOARD</h1>
                            <div className="loading-text">Loading tournament data...</div>
                        </div>
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
                                onClick={() => alert('Current screen - Leaderboard')}
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

    if (error || !currentTournament) {
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
                                onClick={() => alert('Current screen - Leaderboard')}
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
                <div className="header-section">
                    <div className="epic-title-section">
                        <h1 className="epic-title">🏆 LEADERBOARD</h1>
                        <div className="tournament-info">
                            <div className="tournament-day">
                                {new Date(currentTournament.tournament_day).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </div>
                            {timeRemaining && (
                                <div className={`tournament-status ${timeRemaining.status}`}>
                                    {timeRemaining.status === 'grace' ? '⏳' : '⚡'} {timeRemaining.timeLeft}
                                </div>
                            )}
                            <div className="tournament-stats">
                                <div>
                                    <span className="players-count">👥 {currentTournament.total_players} Players</span>
                                    <span className="prize-pool">
                                        💎 {prizePoolData?.prize_pool?.base_amount?.toFixed(2) || currentTournament.total_prize_pool.toFixed(2)} WLD Prize Pool
                                    </span>
                                </div>
                                <div className="guarantee-info">
                                    <span className="guarantee-text">🎯 Top 10 Winners Always Profit</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="leaderboard-section">
                    <TournamentLeaderboard
                        tournamentId={currentTournament.id}
                        currentUserId={session?.user?.walletAddress || null}
                        currentUsername={session?.user?.username || null}
                        isGracePeriod={timeRemaining?.status === 'grace'}
                        totalPrizePool={prizePoolData?.prize_pool?.base_amount || currentTournament.total_prize_pool}
                        onUserRankUpdate={handleUserRankUpdate}
                        onUserCardVisibility={handleUserCardVisibility}
                    />
                </div>

                {/* 8 Ball Pool style fixed card - shows when user's card is not visible in viewport */}
                {shouldShowFixedCard && currentUserRank && (
                    <div className="fixed-user-position-container" style={{
                        position: 'sticky',
                        bottom: '80px',
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: '10px',
                        marginTop: '10px',
                        borderRadius: '10px',
                        border: '2px solid #00F5FF',
                        zIndex: 1000,
                        width: '100%',
                        maxWidth: '600px',
                        margin: '10px auto 0 auto'
                    }}>
                        <PlayerRankCard
                            player={currentUserRank}
                            prizeAmount={calculatePrizeForRank(currentUserRank.rank || 1001, prizePoolData?.prize_pool?.base_amount || currentTournament.total_prize_pool)}
                            isCurrentUser={true}
                            isTopThree={false}
                        />
                    </div>
                )}                <div className="bottom-nav-container">
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
                            onClick={() => alert('Current screen - Leaderboard')}
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
