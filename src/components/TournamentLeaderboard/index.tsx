"use client";

import { useEffect, useState, useCallback } from 'react';
import { PlayerRankCard } from '@/components/PlayerRankCard';

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

interface TournamentLeaderboardProps {
    tournamentId?: string;
    currentUserId?: string | null;  // This is actually the wallet address
    currentUsername?: string | null;  // Add username for better matching
    isGracePeriod?: boolean;
    refreshTrigger?: number; // Add this to trigger manual refresh
    totalPrizePool?: number; // Add real prize pool
    onUserRankUpdate?: (userRank: LeaderboardPlayer | null) => void; // Callback for user rank
    onUserCardVisibility?: (isVisible: boolean) => void; // Callback for user card visibility
}

export const TournamentLeaderboard = ({
    currentUserId = null,
    currentUsername = null,
    isGracePeriod = false,
    refreshTrigger = 0,
    totalPrizePool = 0,
    onUserRankUpdate,
    onUserCardVisibility
}: TournamentLeaderboardProps) => {
    const [topPlayers, setTopPlayers] = useState<LeaderboardPlayer[]>([]);
    const [allPlayers, setAllPlayers] = useState<LeaderboardPlayer[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserData, setCurrentUserData] = useState<LeaderboardPlayer | null>(null);

    // Setup intersection observer for user card visibility
    useEffect(() => {
        if (!currentUserData || !onUserCardVisibility) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    onUserCardVisibility(entry.isIntersecting);
                });
            },
            {
                threshold: 0.1, // Trigger when 10% of the card is visible
                rootMargin: '-80px 0px' // Account for fixed navigation at bottom
            }
        );

        // Find and observe the user's card element
        const userCardElement = document.querySelector(`[data-user-id="${currentUserData.wallet}"]`);
        if (userCardElement) {
            observer.observe(userCardElement);
        }

        return () => {
            if (userCardElement) {
                observer.unobserve(userCardElement);
            }
        };
    }, [currentUserData, onUserCardVisibility]);

    const fetchLeaderboardData = useCallback(async () => {
        try {
            // Fetch leaderboard data via API (uses service key permissions)
            const response = await fetch('/api/tournament/leaderboard-data');
            const data = await response.json();

            if (!response.ok) {
                console.error('Error fetching leaderboard:', data.error);
                return;
            }

            const players = data.players || [];

            if (players.length === 0) {
                setTopPlayers([]);
                setAllPlayers([]);
                return;
            }

            // Get top 10
            const top10 = players.slice(0, 10);
            setTopPlayers(top10);

            // Store all players for infinite scroll
            setAllPlayers(players);

            // Find current user's rank and notify parent
            if ((currentUserId || currentUsername) && onUserRankUpdate) {
                let userRank = null;

                // Strategy 1: Direct wallet match (most reliable for this app since wallet is unique)
                if (currentUserId) {
                    userRank = players.find((player: LeaderboardPlayer) =>
                        player.wallet === currentUserId ||
                        (player.wallet && currentUserId && player.wallet.toLowerCase() === currentUserId.toLowerCase())
                    );
                }

                // Strategy 2: Username match (secondary option)
                if (!userRank && currentUsername) {
                    userRank = players.find((player: LeaderboardPlayer) =>
                        player.username === currentUsername
                    );
                }

                // Strategy 3: Direct user_id match (legacy support)
                if (!userRank && currentUserId) {
                    userRank = players.find((player: LeaderboardPlayer) =>
                        player.user_id === currentUserId
                    );
                }

                // Always notify parent, even if null
                onUserRankUpdate(userRank || null);

                // Set current user data for intersection observer
                setCurrentUserData(userRank || null);
            }
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        } finally {
            setLoading(false);
        }
    }, [currentUserId, currentUsername, onUserRankUpdate]);

    useEffect(() => {
        fetchLeaderboardData();

        // Set up polling instead of real-time subscription (API-based approach)
        if (!isGracePeriod) {
            // Refresh every 5 seconds as specified in Plan.md
            const intervalId = setInterval(fetchLeaderboardData, 5000);

            return () => {
                clearInterval(intervalId);
            };
        }
    }, [fetchLeaderboardData, isGracePeriod]);

    // Force refresh when currentUserId or currentUsername changes (user logs in/out)
    useEffect(() => {
        if (currentUserId || currentUsername) {
            fetchLeaderboardData();
        }
    }, [currentUserId, currentUsername, fetchLeaderboardData]);

    // Add effect for manual refresh trigger
    useEffect(() => {
        if (refreshTrigger > 0) {
            fetchLeaderboardData();
        }
    }, [refreshTrigger, fetchLeaderboardData]);

    const getPrizeAmount = (rank: number, totalPrizePool: number) => {
        const prizeDistribution: { [key: number]: number } = {
            1: 40, 2: 22, 3: 14, 4: 6, 5: 5,
            6: 4, 7: 3, 8: 2, 9: 2, 10: 2
        };

        const percentage = prizeDistribution[rank] || 0;
        // totalPrizePool is already the 70% prize pool amount, no need to multiply by 0.7 again
        return (totalPrizePool * percentage / 100).toFixed(2);
    };

    if (loading) {
        return (
            <div className="leaderboard-loading">
                <div className="loading-spinner"></div>
                <p>Loading leaderboard...</p>
            </div>
        );
    }

    if (topPlayers.length === 0) {
        return (
            <div className="leaderboard-empty">
                <div className="empty-icon">🎮</div>
                <h3>No scores yet!</h3>
                <p>Be the first to play and claim the top spot</p>
            </div>
        );
    }

    return (
        <div className="tournament-leaderboard">
            {isGracePeriod && (
                <div className="grace-period-banner">
                    ⏳ Tournament is ending - Calculating prizes...
                </div>
            )}

            <div className="leaderboard-list">
                {allPlayers.map((player) => {
                    // Check if this player is the current user using same matching logic as above
                    const isCurrentUser = currentUserId && (
                        player.wallet === currentUserId ||
                        (player.wallet && currentUserId && player.wallet.toLowerCase() === currentUserId.toLowerCase())
                    ) || (currentUsername && player.username === currentUsername);

                    return (
                        <div
                            key={player.id}
                            data-user-id={player.wallet}
                            className={isCurrentUser ? "current-user-card" : ""}
                        >
                            <PlayerRankCard
                                player={player}
                                prizeAmount={player.rank && player.rank <= 10 ? getPrizeAmount(player.rank, totalPrizePool) : null}
                                isCurrentUser={Boolean(isCurrentUser)}
                                isTopThree={player.rank !== undefined && player.rank <= 10}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
