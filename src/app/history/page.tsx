"use client";

import { useEffect, useState } from 'react';
import { Page } from '@/components/PageLayout';
import { useRouter } from 'next/navigation';

interface Tournament {
    id: string;
    serial_no: number;
    tournament_day: string;
    start_time: string;
    end_time: string;
    is_active: boolean;
    total_tournament_players: number;
    total_prize_pool: string;
    total_collected: string;
    admin_fee: string;
    guarantee_amount: string;
    admin_net_result: string;
    created_at: string;
}

export default function HistoryPage() {
    const router = useRouter();
    const [tournaments, setTournaments] = useState<Tournament[]>(() => {
        // INSTANT LOAD: Try to get cached data immediately
        if (typeof window !== 'undefined') {
            try {
                const cached = localStorage.getItem('tournament_history_cache');
                if (cached) {
                    const { data } = JSON.parse(cached);
                    return data; // Always use cache for instant display
                }
            } catch {
                // Ignore cache errors
            }
        }
        return [];
    });
    const [loading, setLoading] = useState(tournaments.length === 0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTournaments = async () => {
            try {
                const response = await fetch('/api/tournament/history');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch tournaments');
                }

                const tournamentData = data.tournaments || [];

                // Check if we need to update (new tournaments added)
                const cached = localStorage.getItem('tournament_history_cache');
                let shouldUpdate = true;

                if (cached && tournaments.length > 0) {
                    const { count } = JSON.parse(cached);
                    // Only update if tournament count changed
                    shouldUpdate = tournamentData.length !== count;
                }

                if (shouldUpdate) {
                    // API returns sorted by end_time ascending (oldest first)
                    setTournaments(tournamentData);

                    // Cache permanently with tournament count for validation
                    try {
                        localStorage.setItem('tournament_history_cache', JSON.stringify({
                            data: tournamentData,
                            count: tournamentData.length,
                            timestamp: Date.now()
                        }));
                    } catch {
                        // Ignore storage errors
                    }
                }
            } catch (err) {
                console.error('Error loading tournament history:', err);
                setError('Failed to load tournament history');
            } finally {
                setLoading(false);
            }
        };

        fetchTournaments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount to check for updates

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
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
                        Loading tournament history...
                    </div>
                    <div className="bottom-nav-container">
                        <div className="space-nav-icons">
                            <button
                                className="space-nav-btn home-nav"
                                onClick={() => router.push('/')}
                                aria-label="Home"
                            >
                                <div className="space-icon">🏠</div>
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

    if (error) {
        return (
            <Page>
                <Page.Main className="main-container">
                    <div className="tournament-main-title">
                        <h1>🏆 TOURNAMENT HISTORY</h1>
                    </div>
                    <div className="error-text" style={{ textAlign: 'center', padding: '2rem', color: '#ff4444' }}>
                        {error}
                    </div>
                    <div className="bottom-nav-container">
                        <div className="space-nav-icons">
                            <button
                                className="space-nav-btn home-nav"
                                onClick={() => router.push('/')}
                                aria-label="Home"
                            >
                                <div className="space-icon">🏠</div>
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

    if (tournaments.length === 0) {
        return (
            <Page>
                <Page.Main className="main-container">
                    <div className="tournament-main-title">
                        <h1>🏆 TOURNAMENT HISTORY</h1>
                    </div>
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📜</div>
                        <p>No past tournaments yet</p>
                        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                            Check back after the first tournament ends!
                        </p>
                    </div>
                    <div className="bottom-nav-container">
                        <div className="space-nav-icons">
                            <button
                                className="space-nav-btn home-nav"
                                onClick={() => router.push('/')}
                                aria-label="Home"
                            >
                                <div className="space-icon">🏠</div>
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
                    <h1>🏆 TOURNAMENT HISTORY</h1>
                </div>

                <div className="leaderboard-scroll-content" style={{ paddingBottom: '100px' }}>
                    <div style={{
                        display: 'grid',
                        gap: '1rem',
                        padding: '1rem',
                        gridTemplateColumns: '1fr'
                    }}>
                        {[...tournaments].reverse().map((tournament, index) => {
                            // API returns oldest first (ascending by end_time)
                            // Reverse for display (newest at top)
                            // But calculate position from original array: oldest = #1
                            const tournamentNumber = tournaments.length - index;

                            return (
                                <div
                                    key={tournament.id}
                                    onClick={() => router.push(`/history/${tournament.id}?position=${tournamentNumber}`)}
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(0, 245, 255, 0.1), rgba(138, 43, 226, 0.1))',
                                        border: '2px solid rgba(0, 245, 255, 0.3)',
                                        borderRadius: '12px',
                                        padding: '1.5rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.02)';
                                        e.currentTarget.style.borderColor = 'rgba(0, 245, 255, 0.6)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                        e.currentTarget.style.borderColor = 'rgba(0, 245, 255, 0.3)';
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#00F5FF' }}>
                                            Tournament {tournamentNumber}
                                        </h3>
                                        <span style={{ fontSize: '1.5rem' }}>📜</span>
                                    </div>

                                    <div style={{ display: 'grid', gap: '0.5rem', color: '#fff' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#888' }}>Date:</span>
                                            <span style={{ fontWeight: 'bold' }}>{formatDate(tournament.tournament_day)}</span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#888' }}>Players:</span>
                                            <span style={{ fontWeight: 'bold', color: '#00F5FF' }}>
                                                {tournament.total_tournament_players} {tournament.total_tournament_players === 1 ? 'Human' : 'Humans'}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#888' }}>Prize Pool:</span>
                                            <span style={{ fontWeight: 'bold', color: '#FFD700' }}>
                                                {Number(tournament.total_prize_pool).toFixed(2)} WLD
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{
                                        marginTop: '1rem',
                                        paddingTop: '1rem',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                                        textAlign: 'center',
                                        color: '#00F5FF',
                                        fontSize: '0.9rem'
                                    }}>
                                        Tap to view winners →
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="bottom-nav-container">
                    <div className="space-nav-icons">
                        <button
                            className="space-nav-btn home-nav"
                            onClick={() => router.push('/')}
                            aria-label="Home"
                        >
                            <div className="space-icon">🏠</div>
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
