"use client";

import { useEffect, useState } from 'react';
import { Page } from '@/components/PageLayout';
import { TournamentLeaderboard } from '@/components/TournamentLeaderboard';
import { useRouter } from 'next/navigation';
import { use } from 'react';

interface Tournament {
    id: string;
    serial_no: number;
    tournament_day: string;
    total_tournament_players: number;
    total_prize_pool: string;
}

interface Winner {
    id: string;
    user_id: string;
    username: string | null;
    wallet: string;
    highest_score: number;
    tournament_day: string;
    created_at: string;
    rank: number;
    prize_amount: number | null; // Change from string to number to match API
}

interface LeaderboardApiResponse {
    players: Winner[];
    tournament_day: string;
    total_players: number;
}

export default function TournamentHistoryDetailPage({
    params,
}: {
    params: Promise<{ tournamentId: string }>;
}) {
    const router = useRouter();
    const { tournamentId } = use(params);

    // INSTANT LOAD: Initialize with cached data
    const [tournament, setTournament] = useState<Tournament | null>(() => {
        if (typeof window !== 'undefined') {
            try {
                const cached = localStorage.getItem(`tournament_detail_${tournamentId}`);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
                        return data.tournament;
                    }
                }
            } catch {
                // Ignore cache errors
            }
        }
        return null;
    });

    const [leaderboardData, setLeaderboardData] = useState<LeaderboardApiResponse | null>(() => {
        if (typeof window !== 'undefined') {
            try {
                const cached = localStorage.getItem(`tournament_detail_${tournamentId}`);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
                        return {
                            players: data.winners || [],
                            tournament_day: data.tournament.tournament_day,
                            total_players: data.total_winners || 0
                        };
                    }
                }
            } catch {
                // Ignore cache errors
            }
        }
        return null;
    });

    const [loading, setLoading] = useState(tournament === null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTournamentDetail = async () => {
            // Skip fetch if we already have cached data
            if (tournament !== null && leaderboardData !== null) {
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/tournament/history/${tournamentId}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch tournament details');
                }

                setTournament(data.tournament);

                // Format data for TournamentLeaderboard component
                const leaderboard = {
                    players: data.winners || [],
                    tournament_day: data.tournament.tournament_day,
                    total_players: data.total_winners || 0
                };
                setLeaderboardData(leaderboard);

                // Cache for 7 days
                try {
                    localStorage.setItem(`tournament_detail_${tournamentId}`, JSON.stringify({
                        data,
                        timestamp: Date.now()
                    }));
                } catch {
                    // Ignore storage errors
                }
            } catch (err) {
                console.error('Error loading tournament details:', err);
                setError('Failed to load tournament details');
            } finally {
                setLoading(false);
            }
        };

        fetchTournamentDetail();
    }, [tournamentId, tournament, leaderboardData]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <Page>
                <Page.Main className="main-container">
                    <div className="tournament-main-title">
                        <h1>🏆 TOURNAMENT HISTORY</h1>
                    </div>
                    <div className="loading-text" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                        Loading tournament details...
                    </div>
                    <div className="bottom-nav-container">
                        <div className="space-nav-icons">
                            <button
                                className="space-nav-btn home-nav"
                                onClick={() => router.push('/history')}
                                aria-label="Back to History"
                            >
                                <div className="space-icon">◀️</div>
                            </button>
                            <button
                                className="space-nav-btn prizes-nav"
                                onClick={() => router.push('/leaderboard')}
                                aria-label="Current Leaderboard"
                            >
                                <div className="space-icon">🏆</div>
                            </button>
                        </div>
                    </div>
                </Page.Main>
            </Page>
        );
    }

    if (error || !tournament) {
        return (
            <Page>
                <Page.Main className="main-container">
                    <div className="tournament-main-title">
                        <h1>🏆 TOURNAMENT HISTORY</h1>
                    </div>
                    <div className="error-text" style={{ textAlign: 'center', padding: '2rem', color: '#ff4444' }}>
                        {error || 'Tournament not found'}
                    </div>
                    <div className="bottom-nav-container">
                        <div className="space-nav-icons">
                            <button
                                className="space-nav-btn home-nav"
                                onClick={() => router.push('/history')}
                                aria-label="Back to History"
                            >
                                <div className="space-icon">◀️</div>
                            </button>
                            <button
                                className="space-nav-btn prizes-nav"
                                onClick={() => router.push('/leaderboard')}
                                aria-label="Current Leaderboard"
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
                <div className="tournament-main-title">
                    <h1>🏆 TOURNAMENT {tournament.serial_no}</h1>
                </div>

                <div className="leaderboard-scroll-content">
                    {/* Tournament Info Box */}
                    <div className="tournament-info-box">
                        <div className="prize-pool-info">
                            <div className="prize-pool-text">
                                <span>Tournament Date:</span>
                                <span className="prize-pool-highlight">
                                    {formatDate(tournament.tournament_day)}
                                </span>
                            </div>
                            <div className="prize-pool-text" style={{ marginTop: '0.5rem' }}>
                                <span>Prize Pool:</span>
                                <span className="prize-pool-highlight">
                                    {Number(tournament.total_prize_pool).toFixed(2)} WLD
                                </span>
                            </div>
                            <div className="players-text">
                                <span className="human-count-number">
                                    {tournament.total_tournament_players}
                                </span>
                                <span className="humans-playing-highlight">
                                    {tournament.total_tournament_players === 1 ? 'Human competed' : 'Humans competed'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="leaderboard-section">
                        {/* Sticky Header Row for Leaderboard - WITHOUT Score column */}
                        <div className="leaderboard-header-row">
                            <div className="header-rank">Rank</div>
                            <div className="header-player">Human</div>
                            <div className="header-prize">Prize</div>
                        </div>

                        {leaderboardData && leaderboardData.players.length > 0 ? (
                            <TournamentLeaderboard
                                tournamentId={tournament.id}
                                totalPrizePool={Number(tournament.total_prize_pool)}
                                preloadedData={leaderboardData}
                                showScores={false} // CRITICAL: Hide scores in history
                                isHistoryView={true} // CRITICAL: Show only DB prizes, no calculations
                            />
                        ) : (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🏆</div>
                                <p>No winners recorded for this tournament</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bottom-nav-container">
                    <div className="space-nav-icons">
                        <button
                            className="space-nav-btn home-nav"
                            onClick={() => router.push('/history')}
                            aria-label="Back to History"
                        >
                            <div className="space-icon">◀️</div>
                        </button>
                        <button
                            className="space-nav-btn prizes-nav"
                            onClick={() => router.push('/leaderboard')}
                            aria-label="Current Leaderboard"
                        >
                            <div className="space-icon">🏆</div>
                        </button>
                    </div>
                </div>
            </Page.Main>
        </Page>
    );
}
