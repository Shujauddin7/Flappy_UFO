'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Virtual scrolling configuration
const VIRTUAL_SCROLL_CONFIG = {
    itemHeight: 72, // Height of each player row in pixels
    visibleItems: 15, // Number of items visible at once
    bufferSize: 10, // Extra items to render for smooth scrolling
    maxMemoryItems: 500, // Maximum items to keep in memory before cleanup
};

// Types for the optimized leaderboard
interface Player {
    user_id: string;
    username: string | null;
    wallet: string;
    highest_score: number;
    rank: number;
}

interface LeaderboardResponse {
    success: boolean;
    players: Player[];
    pagination: {
        offset: number;
        limit: number;
        hasMore: boolean;
        nextOffset: number;
        totalPlayers?: number;
    };
    performance: {
        source: 'redis' | 'database';
        responseTime: number;
        cached: boolean;
    };
    tournament_day: string;
    fetched_at: string;
}

// Unified API response format
interface UnifiedLeaderboardResponse {
    success: boolean;
    tournament: {
        tournament_day: string;
        total_prize_pool: number;
        total_players: number;
        hours_left: number;
        minutes_left: number;
    };
    players: Player[];
    pagination: {
        offset: number;
        limit: number;
        hasMore: boolean;
        nextOffset: number;
        totalPlayers: number;
    };
    performance: {
        source: 'redis' | 'database';
        responseTime: number;
        cached: boolean;
    };
    fetched_at: string;
}

// Initial data can be from either API format
interface InitialData {
    players: Player[];
    pagination: {
        offset: number;
        limit: number;
        hasMore: boolean;
        nextOffset: number;
        totalPlayers?: number;
    };
    tournament_day: string;
}

interface InfiniteScrollLeaderboardProps {
    initialData?: InitialData | null;
    tournamentDay?: string;
    className?: string;
    apiEndpoint?: string; // Allow custom API endpoint
    maxHeight?: number; // Maximum height of the scrollable container
    // onTournamentStatsUpdate removed - handled by parent SSE connection
}

// Player row component with skeleton loader
function PlayerRow({ player, isLoading = false }: { player?: Player; isLoading?: boolean }) {
    if (isLoading) {
        return (
            <div
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg animate-pulse"
                style={{ height: VIRTUAL_SCROLL_CONFIG.itemHeight }}
            >
                <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                    <div className="space-y-2">
                        <div className="w-24 h-4 bg-gray-700 rounded"></div>
                        <div className="w-16 h-3 bg-gray-700 rounded"></div>
                    </div>
                </div>
                <div className="w-16 h-6 bg-gray-700 rounded"></div>
            </div>
        );
    }

    if (!player) return null;

    // Rank colors for top players
    const getRankStyle = (rank: number) => {
        if (rank === 1) return 'text-yellow-400 font-bold text-lg';
        if (rank === 2) return 'text-gray-300 font-bold text-lg';
        if (rank === 3) return 'text-amber-600 font-bold text-lg';
        if (rank <= 10) return 'text-blue-400 font-semibold';
        return 'text-gray-400';
    };

    const getRankIcon = (rank: number) => {
        if (rank === 1) return '👑';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        if (rank <= 10) return '⭐';
        return `#${rank}`;
    };

    return (
        <div
            className="flex items-center justify-between p-4 bg-gray-800/30 hover:bg-gray-800/50 rounded-lg transition-colors duration-200 border border-gray-700/50"
            style={{ height: VIRTUAL_SCROLL_CONFIG.itemHeight }}
        >
            <div className="flex items-center space-x-4">
                <div className={`w-12 text-center ${getRankStyle(player.rank)}`}>
                    {getRankIcon(player.rank)}
                </div>
                <div>
                    <p className="font-semibold text-white">
                        {player.username || 'Anonymous'}
                    </p>
                    <p className="text-sm text-gray-400 truncate max-w-[200px]">
                        {player.wallet}
                    </p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-lg font-bold text-green-400">
                    {(player.highest_score || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">points</p>
            </div>
        </div>
    );
}

// Virtual scrolling hook for memory-efficient rendering
// Only use complex virtual scrolling for large datasets
function useVirtualScroll(
    itemCount: number,
    scrollTop: number
) {
    return useMemo(() => {
        // For small datasets, render everything (better UX)
        if (itemCount <= 50) {
            return {
                startIndex: 0,
                endIndex: itemCount - 1,
                offsetY: 0,
                totalHeight: itemCount * VIRTUAL_SCROLL_CONFIG.itemHeight,
                visibleCount: itemCount
            };
        }

        // Use virtual scrolling for large datasets
        const { itemHeight, visibleItems, bufferSize } = VIRTUAL_SCROLL_CONFIG;
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
        const endIndex = Math.min(
            itemCount - 1,
            startIndex + visibleItems + bufferSize * 2
        );

        const offsetY = startIndex * itemHeight;
        const totalHeight = itemCount * itemHeight;

        return {
            startIndex,
            endIndex,
            offsetY,
            totalHeight,
            visibleCount: endIndex - startIndex + 1
        };
    }, [itemCount, scrollTop]);
}

export default function InfiniteScrollLeaderboard({
    initialData = null,
    tournamentDay,
    className = '',
    apiEndpoint = '/api/leaderboard',
    maxHeight = 600
    // onTournamentStatsUpdate removed - handled by parent SSE connection
}: InfiniteScrollLeaderboardProps) {
    const [players, setPlayers] = useState<Player[]>(initialData?.players || []);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState<boolean>(initialData?.pagination.hasMore ?? true);
    const [offset, setOffset] = useState(initialData?.pagination.nextOffset || 20);
    const [error, setError] = useState<string | null>(null);
    const [performance, setPerformance] = useState<{ source: string; responseTime: number; cached: boolean } | null>(null);
    const [scrollTop, setScrollTop] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate virtual scrolling parameters
    const virtualScroll = useVirtualScroll(players.length, scrollTop);

    // Memory cleanup: Remove old players when we have too many
    useEffect(() => {
        if (players.length > VIRTUAL_SCROLL_CONFIG.maxMemoryItems) {
            setPlayers(prev => prev.slice(-VIRTUAL_SCROLL_CONFIG.maxMemoryItems));
            // Adjust offset to maintain pagination consistency
            setOffset(prev => prev - (players.length - VIRTUAL_SCROLL_CONFIG.maxMemoryItems));
        }
    }, [players.length]);

    // Load more players with virtual scrolling optimization
    const loadMorePlayers = useCallback(async () => {
        if (loading || !hasMore) return;

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                offset: offset.toString(),
                limit: '20'
            });

            if (tournamentDay) {
                params.append('tournament_day', tournamentDay);
            }

            const endpoint = apiEndpoint || '/api/leaderboard';
            const response = await fetch(`${endpoint}?${params}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: LeaderboardResponse | UnifiedLeaderboardResponse = await response.json();

            if (data.success && data.players.length > 0) {
                setPlayers(prev => [...prev, ...data.players]);
                setOffset(data.pagination.nextOffset);
                setHasMore(data.pagination.hasMore);
                setPerformance(data.performance);

                } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('❌ Error loading more players:', err);
            setError(err instanceof Error ? err.message : 'Failed to load players');
        } finally {
            setLoading(false);
        }
    }, [offset, hasMore, loading, tournamentDay, apiEndpoint]);

    // Handle scroll events for virtual scrolling
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        setScrollTop(scrollTop);

        // Check if we need to load more content
        const { scrollHeight, clientHeight } = e.currentTarget;
        const scrollPercent = (scrollTop + clientHeight) / scrollHeight;

        if (scrollPercent > 0.8 && hasMore && !loading) {
            loadMorePlayers();
        }
    }, [hasMore, loading, loadMorePlayers]);

    // 🚨 CRITICAL FIX: Removed duplicate SSE connection to prevent conflicts
    // SSE is now handled by parent component (leaderboard page) only
    // This component receives updates through props/callbacks instead

    // Note: Previously this component created its own SSE connection which caused:
    // 1. Multiple SSE connections to same endpoint
    // 2. Cache clearing wars between components  
    // 3. Race conditions in data updates
    // 4. Cross-device update failures
    //
    // Now the parent page manages SSE and passes data via props for better consistency

    // Get visible players for virtual scrolling
    const visiblePlayers = useMemo(() => {
        return players.slice(virtualScroll.startIndex, virtualScroll.endIndex + 1);
    }, [players, virtualScroll.startIndex, virtualScroll.endIndex]);

    // Empty state - show immediately if no players and no initial data
    if (players.length === 0 && !initialData && !loading) {
        return (
            <div className={`text-center py-12 ${className}`}>
                <div className="text-gray-400 text-lg mb-4">🏆</div>
                <h3 className="text-xl font-semibold text-white mb-2">No Players Yet</h3>
                <p className="text-gray-400">Be the first to join this tournament!</p>
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Performance indicator */}
            {performance && (
                <div className="text-xs text-gray-500 text-center p-2 bg-gray-900/50 rounded">
                    ⚡ {performance.cached ? 'Cached' : 'Fresh'} data from {performance.source} • {performance.responseTime}ms
                    {players.length > VIRTUAL_SCROLL_CONFIG.visibleItems && (
                        <span className="ml-2">📊 Virtual scroll active ({visiblePlayers.length}/{players.length} rendered)</span>
                    )}
                </div>
            )}

            {/* Virtual scrolling container */}
            <div
                ref={containerRef}
                className="overflow-auto border border-gray-700 rounded-lg bg-gray-900/30"
                style={{ maxHeight: maxHeight }}
                onScroll={handleScroll}
            >
                {/* Virtual scroll spacer - top */}
                <div style={{ height: virtualScroll.offsetY }} />

                {/* Visible players */}
                <div className="space-y-2 px-2">
                    {visiblePlayers.map((player) => (
                        <PlayerRow
                            key={`${player.user_id}-${player.rank}`}
                            player={player}
                        />
                    ))}

                    {/* Loading skeletons */}
                    {loading && (
                        <>
                            {[...Array(5)].map((_, i) => (
                                <PlayerRow key={`skeleton-${i}`} isLoading={true} />
                            ))}
                        </>
                    )}
                </div>

                {/* Virtual scroll spacer - bottom */}
                <div style={{
                    height: Math.max(0, virtualScroll.totalHeight - virtualScroll.offsetY - (visiblePlayers.length * VIRTUAL_SCROLL_CONFIG.itemHeight))
                }} />
            </div>

            {/* Error state */}
            {error && (
                <div className="text-center py-6">
                    <p className="text-red-400 mb-2">❌ {error}</p>
                    <button
                        onClick={loadMorePlayers}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* End of list */}
            {!hasMore && players.length > 0 && (
                <div className="text-center py-6 text-gray-400">
                    🏁 You&apos;ve reached the end of the leaderboard!
                    <div className="text-sm mt-2">
                        Total players: {players.length}
                        {players.length > VIRTUAL_SCROLL_CONFIG.maxMemoryItems && (
                            <span className="ml-2 text-yellow-400">
                                (Memory optimized - showing recent {VIRTUAL_SCROLL_CONFIG.maxMemoryItems})
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}