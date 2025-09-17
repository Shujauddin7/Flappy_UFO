'use client';

import { useState, useEffect } from 'react';
import { Page } from '@/components/PageLayout';
import InfiniteScrollLeaderboard from '@/components/InfiniteScrollLeaderboard';

// Types for unified API response
interface UnifiedLeaderboardResponse {
    success: boolean;
    tournament: {
        tournament_day: string;
        total_prize_pool: number;
        total_players: number;
        hours_left: number;
        minutes_left: number;
    };
    players: Array<{
        user_id: string;
        username: string | null;
        wallet: string;
        highest_score: number;
        rank: number;
    }>;
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

export default function LeaderboardPage() {
    const [data, setData] = useState<UnifiedLeaderboardResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load everything in ONE super-fast call - NO MORE DOUBLE LOADING!
    useEffect(() => {
        async function loadUnifiedData() {
            console.log('🚀 Loading unified leaderboard data...');
            const startTime = Date.now();

            try {
                setLoading(true);

                const response = await fetch('/api/leaderboard/unified?limit=20');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                const loadTime = Date.now() - startTime;

                console.log(`✅ Unified data loaded in ${loadTime}ms from ${result.performance?.source || 'unknown'}`);
                console.log(`🏆 Tournament: ${result.tournament?.total_players || 0} players, $${result.tournament?.total_prize_pool || 0} prize pool`);

                if (!result.success) {
                    throw new Error(result.error || 'Failed to load leaderboard');
                }

                setData(result);
                setError(null);

            } catch (err) {
                const loadTime = Date.now() - startTime;
                console.error(`❌ Unified data failed after ${loadTime}ms:`, err);
                setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
                setData(null);
            } finally {
                setLoading(false);
            }
        }

        loadUnifiedData();
    }, []);

    // Show error state
    if (error) {
        return (
            <Page>
                <div className="container mx-auto px-4 py-8">
                    <div className="text-center">
                        <div className="text-red-500 text-lg mb-4">❌ Error Loading Leaderboard</div>
                        <div className="text-gray-600 mb-4">{error}</div>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </Page>
        );
    }

    // Show loading state (should be very brief!)
    if (loading) {
        return (
            <Page>
                <div className="container mx-auto px-4 py-8">
                    <div className="text-center">
                        <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                        <div className="text-gray-600">Loading tournament...</div>
                    </div>
                </div>
            </Page>
        );
    }

    if (!data) {
        return (
            <Page>
                <div className="container mx-auto px-4 py-8">
                    <div className="text-center text-gray-600">No tournament data available</div>
                </div>
            </Page>
        );
    }

    const { tournament, players, pagination, performance } = data;

    return (
        <Page>
            <div className="container mx-auto px-4 py-8 space-y-8">
                {/* Tournament Info Card - Loads instantly with leaderboard */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                        <div>
                            <div className="text-2xl font-bold text-blue-600">
                                {tournament.total_players.toLocaleString()}
                            </div>
                            <div className="text-gray-600">Players</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green-600">
                                ${tournament.total_prize_pool.toFixed(2)}
                            </div>
                            <div className="text-gray-600">Prize Pool</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-orange-600">
                                {tournament.hours_left}h {tournament.minutes_left}m
                            </div>
                            <div className="text-gray-600">Time Left</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-purple-600">
                                {tournament.tournament_day}
                            </div>
                            <div className="text-gray-600">Tournament Day</div>
                        </div>
                    </div>
                </div>

                {/* Performance Debug Info - Shows Redis vs Database performance */}
                <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-600">
                    <div className="flex flex-wrap gap-4">
                        <span>📊 Source: <strong>{performance.source}</strong></span>
                        <span>⚡ Response: <strong>{performance.responseTime}ms</strong></span>
                        <span>💾 Cached: <strong>{performance.cached ? 'Yes' : 'No'}</strong></span>
                        <span>👥 Showing: <strong>{pagination.offset + 1}-{pagination.offset + players.length}</strong> of <strong>{pagination.totalPlayers}</strong></span>
                    </div>
                </div>

                {/* Infinite Scroll Leaderboard - Uses preloaded data for instant display */}
                <InfiniteScrollLeaderboard
                    initialData={{
                        players,
                        pagination,
                        tournament_day: tournament.tournament_day
                    }}
                    apiEndpoint="/api/leaderboard/unified"
                />
            </div>
        </Page>
    );
}