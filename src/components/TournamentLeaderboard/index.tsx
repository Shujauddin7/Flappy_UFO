"use client";

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
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
}

export const TournamentLeaderboard = ({
    currentUserId = null,
    isGracePeriod = false
}: TournamentLeaderboardProps) => {
    const [topPlayers, setTopPlayers] = useState<LeaderboardPlayer[]>([]);
    const [allPlayers, setAllPlayers] = useState<LeaderboardPlayer[]>([]);
    const [currentUserRank, setCurrentUserRank] = useState<LeaderboardPlayer | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAllPlayers, setShowAllPlayers] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const fetchLeaderboardData = useCallback(async () => {
        try {
            // Calculate tournament day using same logic as tournament system (15:30 UTC boundary)
            const now = new Date();
            const utcHour = now.getUTCHours();
            const utcMinute = now.getUTCMinutes();

            // Tournament day starts at 15:30 UTC, so if it's before 15:30, use yesterday's date
            const tournamentDate = new Date(now);
            if (utcHour < 15 || (utcHour === 15 && utcMinute < 30)) {
                tournamentDate.setUTCDate(tournamentDate.getUTCDate() - 1);
            }

            const tournamentDay = tournamentDate.toISOString().split('T')[0];

            // Fetch all players for this tournament, ordered by score
            const { data: players, error } = await supabase
                .from('user_tournament_records')
                .select('*')
                .eq('tournament_day', tournamentDay)
                .gt('highest_score', 0) // Only players with scores > 0
                .order('highest_score', { ascending: false })
                .order('created_at', { ascending: true }); // Tie-breaker: earlier submission wins

            if (error) {
                console.error('Error fetching leaderboard:', error);
                return;
            }

            if (!players || players.length === 0) {
                setTopPlayers([]);
                setAllPlayers([]);
                setCurrentUserRank(null);
                return;
            }

            // Add rank to each player
            const playersWithRank = players.map((player, index) => ({
                ...player,
                rank: index + 1
            }));

            // Get top 10
            const top10 = playersWithRank.slice(0, 10);
            setTopPlayers(top10);
            setAllPlayers(playersWithRank);

            // Find current user's rank
            if (currentUserId) {
                const userRank = playersWithRank.find(player => player.user_id === currentUserId);
                setCurrentUserRank(userRank || null);
            }

            setLastUpdate(new Date());

        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
        } finally {
            setLoading(false);
        }
    }, [supabase, currentUserId]);

    useEffect(() => {
        fetchLeaderboardData();

        // Set up real-time subscription if not in grace period
        if (!isGracePeriod) {
            const subscription = supabase
                .channel('tournament_leaderboard')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'user_tournament_records'
                }, () => {
                    // Refresh leaderboard when changes occur
                    fetchLeaderboardData();
                })
                .subscribe();

            // Also refresh every 5 seconds as specified in Plan.md
            const intervalId = setInterval(fetchLeaderboardData, 5000);

            return () => {
                subscription.unsubscribe();
                clearInterval(intervalId);
            };
        }
    }, [fetchLeaderboardData, isGracePeriod, supabase]);

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

    const displayPlayers = showAllPlayers ? allPlayers : topPlayers;

    return (
        <div className="tournament-leaderboard">
            {isGracePeriod && (
                <div className="grace-period-banner">
                    ⏳ Tournament is ending - Calculating prizes...
                </div>
            )}

            <div className="leaderboard-header">
                <h3>🏆 TOP PLAYERS</h3>
                <div className="last-updated">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                </div>
            </div>

            <div className="leaderboard-list">
                {displayPlayers.map((player) => (
                    <PlayerRankCard
                        key={player.id}
                        player={player}
                        prizeAmount={player.rank && player.rank <= 10 ? getPrizeAmount(player.rank, 1000) : null} // Using placeholder total
                        isCurrentUser={player.user_id === currentUserId}
                        isTopThree={player.rank !== undefined && player.rank <= 3}
                    />
                ))}
            </div>

            {/* Show user's rank if outside top 10 */}
            {currentUserRank && currentUserRank.rank && currentUserRank.rank > 10 && !showAllPlayers && (
                <div className="current-user-rank">
                    <div className="rank-separator">...</div>
                    <PlayerRankCard
                        player={currentUserRank}
                        prizeAmount={null}
                        isCurrentUser={true}
                        isTopThree={false}
                    />
                </div>
            )}

            {/* Toggle to show all players */}
            {allPlayers.length > 10 && (
                <button
                    onClick={() => setShowAllPlayers(!showAllPlayers)}
                    className="view-all-btn"
                >
                    {showAllPlayers ? 'Show Top 10 Only' : `View All ${allPlayers.length} Players`}
                </button>
            )}
        </div>
    );
};
