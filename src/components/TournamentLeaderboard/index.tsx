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
}

export const TournamentLeaderboard = ({
    currentUserId = null,
    currentUsername = null,
    isGracePeriod = false,
    refreshTrigger = 0,
    totalPrizePool = 0,
    onUserRankUpdate
}: TournamentLeaderboardProps) => {
    const [topPlayers, setTopPlayers] = useState<LeaderboardPlayer[]>([]);
    const [allPlayers, setAllPlayers] = useState<LeaderboardPlayer[]>([]);
    const [loading, setLoading] = useState(true);

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

                // Strategy 1: Username match (most reliable for this app)
                if (currentUsername) {
                    userRank = players.find((player: LeaderboardPlayer) =>
                        player.username === currentUsername
                    );
                }

                // Strategy 2: Direct wallet match
                if (!userRank && currentUserId) {
                    userRank = players.find((player: LeaderboardPlayer) =>
                        player.wallet === currentUserId
                    );
                }

                // Strategy 3: Direct user_id match
                if (!userRank && currentUserId) {
                    userRank = players.find((player: LeaderboardPlayer) =>
                        player.user_id === currentUserId
                    );
                }

                // Strategy 4: Case-insensitive wallet match
                if (!userRank && currentUserId) {
                    userRank = players.find((player: LeaderboardPlayer) =>
                        player.wallet &&
                        player.wallet.toLowerCase() === currentUserId.toLowerCase()
                    );
                }

                // Debug logging in development
                if (process.env.NODE_ENV === 'development') {
                    console.log('🔍 User matching debug:', {
                        currentUserId,
                        currentUsername,
                        playersCount: players.length,
                        foundUser: userRank ? `${userRank.username} (rank ${userRank.rank})` : 'Not found',
                        firstFewPlayers: players.slice(0, 3).map((p: LeaderboardPlayer) => ({
                            username: p.username,
                            wallet: p.wallet,
                            user_id: p.user_id,
                            rank: p.rank
                        }))
                    });
                }

                // Always notify parent, even if null
                onUserRankUpdate(userRank || null);
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
        const prizePool = totalPrizePool * 0.7; // 70% of total pool
        return (prizePool * percentage / 100).toFixed(2);
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

            <div className="leaderboard-header">
                <h3>🏆 TOP PLAYERS</h3>
            </div>

            <div className="leaderboard-list">
                {allPlayers.map((player) => {
                    // Check if this player is the current user using same matching logic
                    const isCurrentUser = currentUserId && (
                        player.wallet === currentUserId ||
                        player.user_id === currentUserId ||
                        (player.wallet && currentUserId && player.wallet.toLowerCase() === currentUserId.toLowerCase())
                    );

                    return (
                        <PlayerRankCard
                            key={player.id}
                            player={player}
                            prizeAmount={player.rank && player.rank <= 10 ? getPrizeAmount(player.rank, totalPrizePool) : null}
                            isCurrentUser={Boolean(isCurrentUser)}
                            isTopThree={player.rank !== undefined && player.rank <= 3}
                        />
                    );
                })}
            </div>
        </div>
    );
};
