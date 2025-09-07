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
    start_time: string;
    end_time: string;
}

export default function LeaderboardPage() {
    const { data: session } = useSession();
    const [currentTournament, setCurrentTournament] = useState<TournamentData | null>(null);
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

        const prizePercentages = [50, 25, 15, 3, 2, 2, 1, 1, 0.5, 0.5];
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
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();
        const utcSecond = now.getUTCSeconds();
        const utcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.

        // Check if we're in grace period (Sunday 15:30-16:00 UTC)
        if (utcDay === 0 && utcHour === 15 && utcMinute >= 30) {
            const totalSecondsLeft = (59 - utcMinute) * 60 + (60 - utcSecond);
            const minutesLeft = Math.floor(totalSecondsLeft / 60);
            const secondsLeft = totalSecondsLeft % 60;
            return {
                status: 'grace',
                timeLeft: `${minutesLeft}m ${secondsLeft}s until new tournament`
            };
        }

        // Calculate time until next Sunday 15:30 UTC
        const nextSunday = new Date(now);
        const daysUntilSunday = (7 - utcDay) % 7; // Days until next Sunday

        // If it's Sunday but before 15:30, next tournament is today
        if (utcDay === 0 && (utcHour < 15 || (utcHour === 15 && utcMinute < 30))) {
            nextSunday.setUTCHours(15, 30, 0, 0);
        } else {
            // Next tournament is next Sunday
            nextSunday.setUTCDate(nextSunday.getUTCDate() + (daysUntilSunday || 7));
            nextSunday.setUTCHours(15, 30, 0, 0);
        }

        const msUntilNext = nextSunday.getTime() - now.getTime();
        const daysLeft = Math.floor(msUntilNext / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((msUntilNext % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesLeft = Math.floor((msUntilNext % (1000 * 60 * 60)) / (1000 * 60));
        const secondsLeft = Math.floor((msUntilNext % (1000 * 60)) / 1000);

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
                                    <span className="prize-pool">💎 {currentTournament.total_prize_pool.toFixed(2)} WLD Prize Pool</span>
                                </div>
                                <div className="protection-level">
                                    {currentTournament.total_players >= 72 ? (
                                        <span className="protection-high">🛡️ Level 3 Protection (95% Prize Pool)</span>
                                    ) : currentTournament.total_players >= 30 ? (
                                        <span className="protection-medium">🛡️ Level 2 Protection (85% Prize Pool)</span>
                                    ) : (
                                        <span className="protection-low">🛡️ Level 1 Protection (70% Prize Pool)</span>
                                    )}
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
                        totalPrizePool={currentTournament.total_prize_pool}
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
                            prizeAmount={calculatePrizeForRank(currentUserRank.rank || 1001, currentTournament.total_prize_pool)}
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
