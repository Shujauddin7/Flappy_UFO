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
    currentUserId?: string | null;
    isGracePeriod?: boolean;
    refreshTrigger?: number; // Add this to trigger manual refresh
    totalPrizePool?: number; // Add real prize pool
}

export const TournamentLeaderboard = ({
    currentUserId = null,
    isGracePeriod = false,
    refreshTrigger = 0,
    totalPrizePool = 0
}: TournamentLeaderboardProps) => {
    const [topPlayers, setTopPlayers] = useState<LeaderboardPlayer[]>([]);
    const [currentUserRank, setCurrentUserRank] = useState<LeaderboardPlayer | null>(null);
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
                setCurrentUserRank(null);
                return;
            }

            // Get top 10
            const top10 = players.slice(0, 10);
            setTopPlayers(top10);

            // Find current user's rank
            if (currentUserId) {
                const userRank = players.find((player: LeaderboardPlayer) => player.user_id === currentUserId);
                setCurrentUserRank(userRank || null);
            }

        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        } finally {
            setLoading(false);
        }
    }, [currentUserId]);

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
                {topPlayers.map((player) => (
                    <PlayerRankCard
                        key={player.id}
                        player={player}
                        prizeAmount={player.rank && player.rank <= 10 ? getPrizeAmount(player.rank, totalPrizePool) : null}
                        isCurrentUser={player.user_id === currentUserId}
                        isTopThree={player.rank !== undefined && player.rank <= 3}
                    />
                ))}
            </div>

            {/* Always show user's current position if they have played */}
            {currentUserRank && currentUserRank.rank && (
                <div className="current-user-rank">
                    <div className="rank-separator">
                        <span className="dots">•••</span>
                        <span className="your-rank-text">Your Position</span>
                        <span className="dots">•••</span>
                    </div>
                    <PlayerRankCard
                        player={currentUserRank}
                        prizeAmount={null}
                        isCurrentUser={true}
                        isTopThree={false}
                    />
                </div>
            )}
        </div>
    );
};
