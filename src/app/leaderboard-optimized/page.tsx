'use client';

import { useState, useEffect } from 'react';
import { Page } from '@/components/PageLayout';
import InfiniteScrollLeaderboard from '@/components/InfiniteScrollLeaderboard';

// Types
interface TournamentInfo {
    tournament_day: string;
    total_prize_pool: number;
    total_players: number;
    hours_left: number;
    minutes_left: number;
}

interface LeaderboardApiResponse {
    success: boolean;
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
    };
    performance: {
        source: 'redis' | 'database';
        responseTime: number;
        cached: boolean;
    };
    tournament_day: string;
    fetched_at: string;
}

export default function OptimizedLeaderboardPage() {
    const [tournamentInfo, setTournamentInfo] = useState<TournamentInfo | null>(null);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardApiResponse | null>(null);
    const [loadingTournament, setLoadingTournament] = useState(true);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load tournament info (fast - should be <3s)
    useEffect(() => {
        async function loadTournamentInfo() {
            try {
                setLoadingTournament(true);
                console.log('⚡ Loading tournament info...');

                const [tournamentResponse, prizesResponse] = await Promise.all([
                    fetch('/api/tournament/current'),
                    fetch('/api/tournament/dynamic-prizes')
                ]);

                if (!tournamentResponse.ok || !prizesResponse.ok) {
                    throw new Error('Failed to load tournament data');
                }

                const tournament = await tournamentResponse.json();
                const prizes = await prizesResponse.json();

                if (tournament.success && prizes.success) {
                    setTournamentInfo({
                        tournament_day: tournament.tournament_day,
                        total_prize_pool: prizes.data.totalPrizePool || 0,
                        total_players: tournament.total_players || 0,
                        hours_left: tournament.hours_left || 0,
                        minutes_left: tournament.minutes_left || 0
                    });
                }
            } catch (err) {
                console.error('❌ Tournament info error:', err);
                setError(err instanceof Error ? err.message : 'Failed to load tournament');
            } finally {
                setLoadingTournament(false);
            }
        }

        loadTournamentInfo();
    }, []);

    // Load initial leaderboard data (optimized - should be <100ms for top 20)
    useEffect(() => {
        async function loadInitialLeaderboard() {
            try {
                setLoadingLeaderboard(true);
                console.log('⚡ Loading initial leaderboard...');

                const response = await fetch('/api/leaderboard?limit=20');

                if (!response.ok) {
                    throw new Error('Failed to load leaderboard');
                }

                const data = await response.json();

                if (data.success) {
                    setLeaderboardData(data);
                    console.log(`🚀 Initial leaderboard loaded: ${data.players.length} players from ${data.performance.source} in ${data.performance.responseTime}ms`);
                }
            } catch (err) {
                console.error('❌ Leaderboard error:', err);
                setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
            } finally {
                setLoadingLeaderboard(false);
            }
        }

        // Load leaderboard immediately (don't wait for tournament info)
        loadInitialLeaderboard();
    }, []);

    return (
        <Page>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Tournament Header - Shows Immediately */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-center text-white mb-6">
                        🏆 Tournament Leaderboard
                    </h1>

                    {loadingTournament ? (
                        <div className="bg-gray-800/50 rounded-lg p-6 animate-pulse">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="text-center">
                                    <div className="w-16 h-6 bg-gray-700 rounded mx-auto mb-2"></div>
                                    <div className="w-20 h-4 bg-gray-700 rounded mx-auto"></div>
                                </div>
                                <div className="text-center">
                                    <div className="w-24 h-6 bg-gray-700 rounded mx-auto mb-2"></div>
                                    <div className="w-16 h-4 bg-gray-700 rounded mx-auto"></div>
                                </div>
                                <div className="text-center">
                                    <div className="w-20 h-6 bg-gray-700 rounded mx-auto mb-2"></div>
                                    <div className="w-24 h-4 bg-gray-700 rounded mx-auto"></div>
                                </div>
                            </div>
                        </div>
                    ) : tournamentInfo ? (
                        <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-6 border border-blue-500/30">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-bold text-green-400">
                                        ${tournamentInfo.total_prize_pool.toLocaleString()}
                                    </p>
                                    <p className="text-gray-300">Total Prize Pool</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-blue-400">
                                        {tournamentInfo.total_players.toLocaleString()}
                                    </p>
                                    <p className="text-gray-300">Players</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-yellow-400">
                                        {tournamentInfo.hours_left}h {tournamentInfo.minutes_left}m
                                    </p>
                                    <p className="text-gray-300">Time Left</p>
                                </div>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="bg-red-900/50 rounded-lg p-6 border border-red-500/30">
                            <p className="text-red-400 text-center">❌ {error}</p>
                        </div>
                    ) : null}
                </div>

                {/* Leaderboard Section */}
                <div className="bg-gray-900/50 rounded-lg p-6">
                    <h2 className="text-2xl font-semibold text-white mb-6 text-center">
                        🥇 Top Players
                    </h2>

                    {loadingLeaderboard && !leaderboardData ? (
                        <div className="space-y-4">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg animate-pulse">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                                        <div className="space-y-2">
                                            <div className="w-24 h-4 bg-gray-700 rounded"></div>
                                            <div className="w-16 h-3 bg-gray-700 rounded"></div>
                                        </div>
                                    </div>
                                    <div className="w-16 h-6 bg-gray-700 rounded"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <InfiniteScrollLeaderboard
                            initialData={leaderboardData}
                            tournamentDay={tournamentInfo?.tournament_day}
                            className="min-h-[600px]"
                        />
                    )}
                </div>

                {/* Performance Info */}
                {leaderboardData?.performance && (
                    <div className="mt-4 text-center text-xs text-gray-500">
                        ⚡ Loaded from {leaderboardData.performance.source} •
                        Response time: {leaderboardData.performance.responseTime}ms •
                        {leaderboardData.performance.cached ? 'Cached' : 'Fresh'} data
                    </div>
                )}
            </div>
        </Page>
    );
}