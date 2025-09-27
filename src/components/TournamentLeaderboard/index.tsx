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

interface LeaderboardApiResponse {
    players: LeaderboardPlayer[];
    tournament_day: string;
    total_players: number;
    cached?: boolean;
    fetched_at?: string;
}

interface TournamentLeaderboardProps {
    tournamentId?: string;
    currentUserId?: string | null;  // This is actually the wallet address
    currentUsername?: string | null;  // Add username for better matching
    isGracePeriod?: boolean;
    refreshTrigger?: number; // Add this to trigger manual refresh
    totalPrizePool?: number; // Add real prize pool
    preloadedData?: LeaderboardApiResponse | null; // NEW: Accept pre-loaded leaderboard data to skip API call
    onUserRankUpdate?: (userRank: LeaderboardPlayer | null) => void; // Callback for user rank
    onUserCardVisibility?: (isVisible: boolean) => void; // Callback for user card visibility
}

export const TournamentLeaderboard = ({
    currentUserId = null,
    currentUsername = null,
    isGracePeriod = false,
    refreshTrigger = 0,
    totalPrizePool = 0,
    preloadedData = null, // NEW: Accept pre-loaded data
    onUserRankUpdate,
    onUserCardVisibility
}: TournamentLeaderboardProps) => {
    const [topPlayers, setTopPlayers] = useState<LeaderboardPlayer[]>([]);
    const [allPlayers, setAllPlayers] = useState<LeaderboardPlayer[]>([]);
    const [loading, setLoading] = useState(false); // Only true during actual network requests
    const [currentUserData, setCurrentUserData] = useState<LeaderboardPlayer | null>(null);

    // Setup intersection observer for user card visibility - OPTIMIZED: Only after data is loaded
    useEffect(() => {
        if (!currentUserData || !onUserCardVisibility || loading) return;

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserData, onUserCardVisibility]); // Intentionally excluding loading to prevent infinite loop

    const fetchLeaderboardData = useCallback(async () => {
        try {
            // 🚀 Use preloaded data if available (skips API call completely)
            if (preloadedData) {
                console.log('🚀 Using preloaded leaderboard data - no API call needed');
                const players = preloadedData.players || [];

                // Set data immediately without loading state
                setTopPlayers(players.slice(0, 10));
                setAllPlayers(players);

                // Process user rank immediately
                if ((currentUserId || currentUsername) && onUserRankUpdate) {
                    let userRank = null;

                    // Strategy 1: Direct wallet match (most reliable)
                    if (currentUserId) {
                        userRank = players.find((player: LeaderboardPlayer) =>
                            player.wallet === currentUserId ||
                            (player.wallet && currentUserId && player.wallet.toLowerCase() === currentUserId.toLowerCase())
                        );
                    }

                    // Strategy 2: Username match (secondary)
                    if (!userRank && currentUsername) {
                        userRank = players.find((player: LeaderboardPlayer) =>
                            player.username === currentUsername
                        );
                    }

                    // Strategy 3: Direct user_id match (legacy)
                    if (!userRank && currentUserId) {
                        userRank = players.find((player: LeaderboardPlayer) =>
                            player.user_id === currentUserId
                        );
                    }

                    onUserRankUpdate(userRank || null);
                    setCurrentUserData(userRank || null);
                }

                return; // Skip network request entirely
            }

            // Only make network request if no preloaded data available
            console.log('🌐 Making network request for leaderboard data...');
            setLoading(true); // Set loading only for actual network requests

            // Fetch leaderboard data via API (uses service key permissions)
            const response = await fetch('/api/tournament/leaderboard-data');
            const data = await response.json();

            if (!response.ok) {
                console.error('Error fetching leaderboard:', data.error);
                return;
            }

            // 🧪 REDIS TESTING: Log cache performance for World App testing
            console.log('🧪 Leaderboard Cache Status:', data.cached ? '⚡ REDIS HIT' : '🗄️ DATABASE QUERY');
            console.log('🧪 Response includes cached flag:', !!data.cached);

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
            setLoading(false); // 🚀 FIX: Always clear loading state after network requests
        }
    }, [currentUserId, currentUsername, preloadedData, onUserRankUpdate]);

    useEffect(() => {
        fetchLeaderboardData();

        // NO POLLING - Use Supabase real-time subscriptions as per Plan.md
        // Real-time updates are handled by the existing Supabase subscription system
        // The InfiniteScrollLeaderboard component handles real-time updates via:
        // - Supabase realtime subscriptions on user_tournament_records table
        // - Automatic cache invalidation and re-warming on score changes
        console.log('⚡ TournamentLeaderboard: Using real-time updates, no polling needed');

    }, [fetchLeaderboardData, isGracePeriod, preloadedData]);

    // Force refresh when currentUserId or currentUsername changes (user logs in/out)
    // 🚀 OPTIMIZATION: Skip if we have preloaded data to avoid redundant calls
    useEffect(() => {
        if ((currentUserId || currentUsername) && !preloadedData) {
            fetchLeaderboardData();
        }
    }, [currentUserId, currentUsername, fetchLeaderboardData, preloadedData]);

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
            <div className="tournament-leaderboard">
                <div className="leaderboard-header">
                    <h3>Tournament Leaderboard</h3>
                    <div className="last-updated loading-blur">Loading...</div>
                </div>
                <div className="leaderboard-list">
                    {/* Render 5 skeleton cards */}
                    {Array.from({ length: 5 }, (_, index) => (
                        <PlayerRankCard
                            key={`skeleton-${index}`}
                            player={{
                                id: `skeleton-${index}`,
                                user_id: `skeleton-${index}`,
                                username: "loading...",
                                wallet: `skeleton-${index}`,
                                highest_score: 0,
                                tournament_day: "2024-12-17",
                                created_at: new Date().toISOString(),
                                rank: index + 1
                            }}
                            prizeAmount="0.00"
                            isCurrentUser={false}
                            isTopThree={false}
                            isLoading={true}
                        />
                    ))}
                </div>
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
                            data-rank={player.rank}
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
