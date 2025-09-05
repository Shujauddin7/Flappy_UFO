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

    const handleUserRankUpdate = useCallback((userRank: LeaderboardPlayer | null) => {
        console.log('🎯 handleUserRankUpdate called:', userRank);
        setCurrentUserRank(userRank);
    }, []);

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

        // Check if we're in grace period (15:00-15:30 UTC)
        if (utcHour === 15 && utcMinute >= 0 && utcMinute < 30) {
            const totalSecondsLeft = (29 - utcMinute) * 60 + (60 - utcSecond);
            const minutesLeft = Math.floor(totalSecondsLeft / 60);
            const secondsLeft = totalSecondsLeft % 60;
            return {
                status: 'grace',
                timeLeft: `${minutesLeft}m ${secondsLeft}s until new tournament`
            };
        }

        // Calculate time until next grace period (15:00 UTC tomorrow or today)
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        tomorrow.setUTCHours(15, 0, 0, 0);

        const today15 = new Date(now);
        today15.setUTCHours(15, 0, 0, 0);

        const nextGrace = now > today15 ? tomorrow : today15;
        const msUntilGrace = nextGrace.getTime() - now.getTime();
        const hoursLeft = Math.floor(msUntilGrace / (1000 * 60 * 60));
        const minutesLeft = Math.floor((msUntilGrace % (1000 * 60 * 60)) / (1000 * 60));
        const secondsLeft = Math.floor((msUntilGrace % (1000 * 60)) / 1000);

        return {
            status: 'active',
            timeLeft: `${hoursLeft}h ${minutesLeft}m ${secondsLeft}s until tournament ends`
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
                                <span className="players-count">👥 {currentTournament.total_players} Players</span>
                                <span className="prize-pool">💎 {currentTournament.total_prize_pool.toFixed(2)} WLD Prize Pool</span>
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
                    />
                </div>

                {/* Fixed user position at bottom - always visible */}
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
                    {/* Debug info - show what we have */}
                    {process.env.NODE_ENV === 'development' && (
                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '5px' }}>
                            Debug:<br />
                            WalletAddr={session?.user?.walletAddress || 'none'}<br />
                            Username={session?.user?.username || 'none'}<br />
                            UserId={session?.user?.id || 'none'}<br />
                            Found={currentUserRank ? `${currentUserRank.username || 'no-username'}@rank-${currentUserRank.rank}` : 'null'}<br />
                            FoundWallet={currentUserRank ? currentUserRank.wallet : 'none'}<br />
                            HasSession={session ? 'yes' : 'no'}<br />
                            CallbackCalled={currentUserRank ? 'yes' : 'no'}
                        </div>
                    )}

                    {currentUserRank && (
                        <PlayerRankCard
                            player={currentUserRank}
                            prizeAmount={calculatePrizeForRank(currentUserRank.rank || 1001, currentTournament.total_prize_pool)}
                            isCurrentUser={true}
                            isTopThree={false}
                        />
                    )}
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
