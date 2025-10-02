"use client";

import { useEffect, useState, useCallback } from 'react';
import { Page } from '@/components/PageLayout';
import { TournamentLeaderboard } from '@/components/TournamentLeaderboard';
import { PlayerRankCard } from '@/components/PlayerRankCard';
import { useSession } from 'next-auth/react';
import { CACHE_TTL } from '@/utils/leaderboard-cache';
import { connectSocket, disconnectSocket, joinTournament } from '@/lib/socketio';

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
    realtime_update_id?: string; // For forcing React re-renders on realtime updates
}

interface TournamentData {
    id: string;
    tournament_day: string;
    is_active: boolean;
    total_players: number; // Total users in system (for backward compatibility)
    total_tournament_players?: number; // Actual tournament participants who paid (optional to prevent crashes)
    total_prize_pool: number;
    total_collected: number;
    admin_fee: number;
    guarantee_amount?: number;
    admin_net_result?: number;
    start_time: string;
    end_time: string | null;  // Allow null when no tournament
}

export default function LeaderboardPage() {
    const { data: session } = useSession();

    // 🛡️ CRASH PROTECTION: Error state management
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // ⚡ INSTANT LOADING: Real data immediately, persist across navigation
    const [currentTournament, setCurrentTournament] = useState<TournamentData | null>(() => {
        // ENHANCED: Check for globally preloaded data first, then cache
        if (typeof window !== 'undefined') {
            try {
                const cached = sessionStorage.getItem('tournament_data');
                if (cached) {
                    const parsed = JSON.parse(cached);

                    // Safety checks for data structure
                    if (parsed && parsed.data && parsed.timestamp && typeof parsed.timestamp === 'number') {
                        const cacheAge = Date.now() - parsed.timestamp;

                        // Use cached data if it's less than 30 seconds old (increased from 5)
                        if (cacheAge < 30000) {
                            console.log('⚡ INSTANT CACHE: Using globally preloaded tournament data');
                            console.log(`   Players: ${parsed.data.total_tournament_players || parsed.data.total_players || 'N/A'}`);
                            console.log(`   Prize: ${parsed.data.total_prize_pool || 'N/A'} WLD`);
                            console.log(`   Cache age: ${cacheAge}ms`);
                            return parsed.data;
                        } else {
                            console.log('🗑️ STALE CACHE: Tournament data too old, clearing...');
                            sessionStorage.removeItem('tournament_data');
                        }
                    } else {
                        console.log('🗑️ INVALID CACHE: Tournament data structure invalid, clearing...');
                        sessionStorage.removeItem('tournament_data');
                    }
                }
            } catch (e) {
                console.warn('Cache error, clearing all cache:', e);
                try {
                    sessionStorage.removeItem('tournament_data');
                    sessionStorage.removeItem('leaderboard_data');
                } catch {
                    // Ignore cleanup errors
                }
            }
        }
        // Return null only if no valid cached data found
        return null;
    });

    const [preloadedLeaderboardData, setPreloadedLeaderboardData] = useState<LeaderboardApiResponse | null>(() => {
        // ENHANCED: Prioritize globally preloaded data with better cache handling
        if (typeof window !== 'undefined') {
            try {
                const cached = sessionStorage.getItem('leaderboard_data');
                if (cached) {
                    const parsed = JSON.parse(cached);

                    // Safety checks for data structure
                    if (parsed && parsed.data && parsed.timestamp && typeof parsed.timestamp === 'number') {
                        const cacheAge = Date.now() - parsed.timestamp;

                        // Use cached data if it's less than 30 seconds old (increased from 5)
                        if (cacheAge < 30000) {
                            console.log('⚡ INSTANT CACHE: Using globally preloaded leaderboard data');
                            console.log(`   Players: ${parsed.data?.players?.length || 0}`);
                            console.log(`   Cache age: ${cacheAge}ms`);
                            return parsed.data;
                        } else {
                            console.log('🗑️ STALE CACHE: Leaderboard data too old, clearing...');
                            sessionStorage.removeItem('leaderboard_data');
                        }
                    } else {
                        console.log('🗑️ INVALID CACHE: Leaderboard data structure invalid, clearing...');
                        sessionStorage.removeItem('leaderboard_data');
                    }
                }
            } catch (e) {
                console.warn('Leaderboard cache error, clearing:', e);
                try {
                    sessionStorage.removeItem('leaderboard_data');
                } catch {
                    // Ignore cleanup errors
                }
            }
        }
        return null;
    });
    const [currentUserRank, setCurrentUserRank] = useState<LeaderboardPlayer | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [shouldShowFixedCard, setShouldShowFixedCard] = useState(false);
    const [showPrizeBreakdown, setShowPrizeBreakdown] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

    // 🚨 ULTRA-AGGRESSIVE CACHE CLEARING: Immediate detection of database resets
    useEffect(() => {
        const checkForDatabaseReset = async () => {
            if (typeof window === 'undefined') return;

            try {
                // Get current database state with cache busting
                const leaderboardRes = await fetch(`/api/tournament/leaderboard-data?bust=${Date.now()}`);
                const leaderboardData = await leaderboardRes.json();

                // Get tournament stats too for complete validation
                const statsRes = await fetch(`/api/tournament/stats?bust=${Date.now()}`);
                const statsData = await statsRes.json();

                // Check cached data
                const cachedLeaderboard = sessionStorage.getItem('leaderboard_data');
                const cachedTournament = sessionStorage.getItem('tournament_data');

                console.log('🔍 CACHE CHECK:', {
                    currentPlayers: leaderboardData?.players?.length || 0,
                    currentTotalPlayers: statsData?.total_players || 0,
                    currentTournamentPlayers: statsData?.total_tournament_players || 0,
                    cachedPlayers: (() => {
                        try {
                            return cachedLeaderboard ? JSON.parse(cachedLeaderboard)?.data?.players?.length || 0 : 0;
                        } catch {
                            return 0;
                        }
                    })(),
                    isEmpty: (leaderboardData?.players?.length || 0) === 0 && (statsData?.total_tournament_players || 0) === 0
                });

                if (cachedLeaderboard || cachedTournament) {
                    let parsedLeaderboard = null;
                    let parsedTournament = null;

                    try {
                        parsedLeaderboard = cachedLeaderboard ? JSON.parse(cachedLeaderboard) : null;
                    } catch {
                        // Clear corrupted leaderboard cache
                        sessionStorage.removeItem('leaderboard_data');
                    }

                    try {
                        parsedTournament = cachedTournament ? JSON.parse(cachedTournament) : null;
                    } catch {
                        // Clear corrupted tournament cache
                        sessionStorage.removeItem('tournament_data');
                    }

                    const cachedPlayerCount = parsedLeaderboard?.data?.players?.length || 0;
                    const currentPlayerCount = leaderboardData?.players?.length || 0;
                    const currentTournamentPlayers = statsData?.total_tournament_players || 0;

                    // 🚨 ULTRA-AGGRESSIVE: Clear cache if tournament has no participants
                    const isTournamentEmpty = currentPlayerCount === 0 && currentTournamentPlayers === 0;
                    const hasStaleCache = cachedPlayerCount > 0 && isTournamentEmpty;

                    const cachedTournamentDay = parsedLeaderboard?.data?.tournament_day || parsedTournament?.data?.tournament_day;
                    const currentTournamentDay = leaderboardData?.tournament_day || statsData?.tournament_day;

                    const shouldClearCache = (
                        isTournamentEmpty || // Tournament has no participants - ALWAYS clear
                        hasStaleCache || // Has cached data but tournament is empty
                        cachedPlayerCount > currentPlayerCount || // Tournament reset detected
                        (cachedTournamentDay && currentTournamentDay && cachedTournamentDay !== currentTournamentDay) // Tournament change
                    );

                    if (shouldClearCache) {
                        console.log('🚨 CACHE CLEAR TRIGGERED - DATABASE RESET OR EMPTY STATE!');
                        console.log(`   Cached players: ${cachedPlayerCount}`);
                        console.log(`   Current players: ${currentPlayerCount}`);
                        console.log(`   Empty DB detection: ${currentPlayerCount === 0 ? 'YES' : 'NO'}`);
                        console.log(`   Cached tournament: ${cachedTournamentDay}`);
                        console.log(`   Current tournament: ${currentTournamentDay}`);
                        console.log('   🧹 CLEARING CACHE WITHOUT RELOAD...');

                        // Clear cache but don't reload (prevents crash loops)
                        try {
                            sessionStorage.clear();
                            localStorage.clear();
                            console.log('✅ Cache cleared successfully');
                        } catch (clearError) {
                            console.warn('Cache clear failed:', clearError);
                        }

                        // Let the component re-render with fresh data instead of reloading
                        return;
                    }
                }
            } catch (error) {
                console.warn('Database reset check failed, clearing potentially corrupted cache:', error);
                // Safe cache clearing without auto-reload to prevent crash loops
                try {
                    sessionStorage.clear();
                    localStorage.clear();
                    console.log('🧹 Cache cleared due to error, page will load fresh data');
                } catch (clearError) {
                    console.warn('Cache clearing also failed:', clearError);
                }
            }
        };

        checkForDatabaseReset();
    }, []); // Run once on mount

    // 🧹 TOURNAMENT RESET DETECTION: Clear cache when tournament day changes
    useEffect(() => {
        const checkAndClearStaleCache = () => {
            if (typeof window === 'undefined') return;

            try {
                // Get cached tournament data
                const cachedTournament = sessionStorage.getItem('tournament_data');

                if (!cachedTournament) return;

                let parsed;
                try {
                    parsed = JSON.parse(cachedTournament);
                } catch {
                    // Clear corrupted cache and return
                    sessionStorage.removeItem('tournament_data');
                    return;
                }

                const cachedTournamentDay = parsed?.data?.tournament_day;

                // If we have cached data, fetch current tournament to compare
                fetch('/api/tournament/stats')
                    .then(res => res.json())
                    .then(tournament => {
                        const currentTournamentDay = tournament.tournament_day;

                        // If tournament day changed, clear all caches
                        if (cachedTournamentDay && currentTournamentDay &&
                            cachedTournamentDay !== currentTournamentDay) {

                            console.log('🧹 TOURNAMENT RESET DETECTED!');
                            console.log(`   Old tournament: ${cachedTournamentDay}`);
                            console.log(`   New tournament: ${currentTournamentDay}`);
                            console.log('   Clearing all cached data...');

                            // Clear all tournament-related cache
                            sessionStorage.removeItem('tournament_data');
                            sessionStorage.removeItem('leaderboard_data');
                            sessionStorage.removeItem('preloaded_tournament');
                            sessionStorage.removeItem('preloaded_leaderboard');

                            // Clear environment-specific cache keys too
                            const envPrefix = process.env.NODE_ENV === 'production' ? 'prod_' : 'dev_';
                            sessionStorage.removeItem(`${envPrefix}preloaded_tournament`);
                            sessionStorage.removeItem(`${envPrefix}preloaded_leaderboard`);

                            console.log('✅ All stale tournament cache cleared');

                            // Force refresh the page data
                            window.location.reload();
                        }
                    })
                    .catch(err => {
                        console.warn('Tournament day check failed:', err);
                    });

            } catch (error) {
                console.warn('Cache check failed:', error);
            }
        };

        // Check for stale cache on component mount
        checkAndClearStaleCache();

        // Ultra-frequent checks for empty database states (every 2 seconds)
        const interval = setInterval(checkAndClearStaleCache, 2000);

        // Also run immediate check on mount
        setTimeout(checkAndClearStaleCache, 100);

        return () => clearInterval(interval);
    }, []);

    // ⚡ FAST LOADING: Use existing Redis-cached APIs with instant display
    useEffect(() => {
        const loadEssentialData = async () => {
            try {

                // Try cached data first for instant display
                if (typeof window !== 'undefined') {
                    const cachedTournament = sessionStorage.getItem('tournament_data');
                    const cachedLeaderboard = sessionStorage.getItem('leaderboard_data');

                    if (cachedTournament && cachedLeaderboard) {
                        try {
                            const parsedTournament = JSON.parse(cachedTournament);
                            const parsedLeaderboard = JSON.parse(cachedLeaderboard);

                            if (Date.now() - parsedTournament.timestamp < CACHE_TTL.TOURNAMENT &&
                                Date.now() - parsedLeaderboard.timestamp < CACHE_TTL.LEADERBOARD) {

                                setCurrentTournament(parsedTournament.data);
                                setPreloadedLeaderboardData(parsedLeaderboard.data);
                                console.log('⚡ INSTANT DISPLAY: Using cached data');
                            }
                        } catch (e) {
                            console.warn('Cache parse error:', e);
                        }
                    }
                }

                // 🚀 PARALLEL API CALLS: Tournament stats (fast) + Leaderboard (correct data)
                const [tournamentResponse, leaderboardResponse] = await Promise.all([
                    fetch('/api/tournament/stats'),  // Fast for tournament stats
                    fetch('/api/tournament/leaderboard-data')  // Correct data for players
                ]);

                const [tournamentData, leaderboard] = await Promise.all([
                    tournamentResponse.json(),
                    leaderboardResponse.json()
                ]);

                const newTournamentData: TournamentData = {
                    id: tournamentData.id || 'current', // Use actual tournament ID from API
                    tournament_day: tournamentData.tournament_day || new Date().toISOString().split('T')[0],
                    is_active: true,
                    total_players: tournamentData.total_players || 0, // System users
                    total_tournament_players: tournamentData.total_tournament_players ?? tournamentData.total_players ?? 0, // Tournament participants with safe fallback
                    total_prize_pool: Number(tournamentData.total_prize_pool) || 0,
                    total_collected: Number(tournamentData.total_collected) || 0,
                    admin_fee: Number(tournamentData.admin_fee) || 0,
                    guarantee_amount: Number(tournamentData.guarantee_amount) || 0,
                    admin_net_result: Number(tournamentData.admin_net_result) || 0,
                    start_time: new Date().toISOString(),
                    end_time: tournamentData.end_time || null
                };

                // Update both tournament and leaderboard data
                setCurrentTournament(newTournamentData);
                setPreloadedLeaderboardData(leaderboard);

                // Cache for next instant load
                sessionStorage.setItem('tournament_data', JSON.stringify({
                    data: newTournamentData,
                    timestamp: Date.now()
                }));

                sessionStorage.setItem('leaderboard_data', JSON.stringify({
                    data: leaderboard,
                    timestamp: Date.now()
                }));

                console.log(`⚡ PARALLEL DATA LOADED: ${tournamentData.total_players} players, ${tournamentData.total_prize_pool

                    } WLD, ${leaderboard.players?.length || 0} entries`);

            } catch (error) {
                console.error('Essential data load failed:', error);
                setError('Failed to load tournament data');
            }
        };

        // Load once on mount - Socket.IO handles updates
        loadEssentialData();
    }, []);

    // 🚀 SOCKET.IO REALTIME: Cross-device sync with unlimited connections
    useEffect(() => {
        console.log('🔍 SOCKET.IO USEEFFECT TRIGGERED');
        console.log('🔍 currentTournament:', JSON.stringify(currentTournament));
        console.log('🔍 tournament_day:', currentTournament?.tournament_day);
        console.log('🔍 tournament id:', currentTournament?.id);

        if (!currentTournament?.tournament_day) {
            console.log('❌ Socket.IO setup skipped: No tournament_day available');
            return;
        }

        if (!currentTournament?.id) {
            console.log('❌ Socket.IO setup skipped: No tournament id available');
            return;
        }

        console.log('🚀 Setting up Socket.IO for cross-device sync...');
        console.log(`   Tournament ID: ${currentTournament.id}`);
        console.log(`   Tournament Day: ${currentTournament.tournament_day}`);

        // Connect to Socket.IO server
        const socket = connectSocket();

        // Update connection status
        socket.on('connect', () => {
            console.log('✅ Socket.IO connected');
            setConnectionStatus('connected');
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket.IO disconnected');
            setConnectionStatus('disconnected');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket.IO connection error:', error);
            setConnectionStatus('error');
        });

        // Join tournament room with user info
        const userId = session?.user?.id || 'anonymous';
        const username = session?.user?.name || 'Anonymous';
        joinTournament(currentTournament.id, userId, username);
        console.log(`   Joined tournament room: tournament_${currentTournament.id}`);

        // Listen for score updates
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleScoreUpdate = (message: { tournament_id: string; data: any; }) => {
            const { data } = message;
            console.log('🔥 SOCKET.IO SCORE UPDATE:', message);
            console.log(`⚡ INSTANT UPDATE: ${data.username} score: ${data.new_score}`);

            setPreloadedLeaderboardData(prev => {
                if (!prev?.players) {
                    console.log('🔄 No cached data, fetching fresh leaderboard');
                    fetch(`/api/tournament/leaderboard-data?tournament_day=${currentTournament.tournament_day}&bust=${Date.now()}`)
                        .then(res => res.json())
                        .then(freshData => {
                            if (freshData?.players) {
                                setPreloadedLeaderboardData({
                                    ...freshData,
                                    realtime_update_id: `fresh_sync_${Date.now()}`,
                                    source: 'fresh_sync'
                                });
                            }
                        });
                    return prev;
                }

                const updatedPlayers = prev.players.map(player => {
                    if (player.user_id === data.user_id) {
                        return {
                            ...player,
                            highest_score: data.new_score,
                            username: data.username || player.username
                        };
                    }
                    return player;
                });

                const playerExists = prev.players.some(p => p.user_id === data.user_id);
                if (!playerExists) {
                    console.log('🔄 Player not in cached leaderboard, syncing fresh data');
                    fetch(`/api/tournament/leaderboard-data?tournament_day=${currentTournament.tournament_day}&bust=${Date.now()}`)
                        .then(res => res.json())
                        .then(freshData => {
                            if (freshData?.players) {
                                setPreloadedLeaderboardData({
                                    ...freshData,
                                    realtime_update_id: `player_sync_${Date.now()}`,
                                    source: 'player_sync'
                                });
                            }
                        });
                    return prev;
                }

                updatedPlayers.sort((a, b) => (b.highest_score || 0) - (a.highest_score || 0));

                return {
                    ...prev,
                    players: updatedPlayers,
                    realtime_update_id: `socketio_${Date.now()}`,
                    source: 'socketio_update'
                };
            });
        };

        // Listen for prize pool updates
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handlePrizePoolUpdate = (message: { tournament_id: string; data: any; }) => {
            const { data } = message;
            console.log('🔥 SOCKET.IO PRIZE POOL UPDATE:', message);
            console.log(`📊 PRIZE POOL UPDATED: ${data.total_players} players, ${data.new_prize_pool} WLD`);

            setCurrentTournament(prev => prev ? {
                ...prev,
                total_prize_pool: data.new_prize_pool,
                total_tournament_players: data.total_players
            } : prev);
        };

        // Listen for new player joins
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handlePlayerJoined = (message: { tournament_id: string; data: any; }) => {
            const { data } = message;
            console.log('🔥 SOCKET.IO PLAYER JOINED:', message);
            console.log(`🎮 NEW PLAYER: ${data.username} joined tournament`);

            fetch(`/api/tournament/leaderboard-data?tournament_day=${currentTournament.tournament_day}&bust=${Date.now()}`)
                .then(res => res.json())
                .then(freshData => {
                    if (freshData?.players) {
                        setPreloadedLeaderboardData({
                            ...freshData,
                            realtime_update_id: `player_joined_${Date.now()}`,
                            source: 'player_joined'
                        });
                    }
                });
        };

        socket.on('score_update', handleScoreUpdate);
        socket.on('prize_pool_update', handlePrizePoolUpdate);
        socket.on('player_joined', handlePlayerJoined);

        // Cleanup
        return () => {
            console.log('🛑 Cleaning up Socket.IO connection');
            socket.off('score_update', handleScoreUpdate);
            socket.off('prize_pool_update', handlePrizePoolUpdate);
            socket.off('player_joined', handlePlayerJoined);
            disconnectSocket();
        };
    }, [currentTournament, session?.user?.id, session?.user?.name, setPreloadedLeaderboardData, setCurrentTournament, setConnectionStatus]);

    const handleUserRankUpdate = useCallback((userRank: LeaderboardPlayer | null) => {
        setCurrentUserRank(userRank);
        // We'll handle visibility based on scroll position, not rank number
    }, []);

    const handleUserCardVisibility = useCallback((isVisible: boolean) => {
        // Show fixed card only when user's actual card is NOT visible in viewport
        setShouldShowFixedCard(!isVisible && currentUserRank !== null);
    }, [currentUserRank]);

    const calculatePrizeForRank = useCallback((rank: number, totalPrizePool: number): string | null => {
        if (rank > 10) return null;

        // Plan.md compliant prize percentages
        const prizePercentages = [40, 22, 14, 6, 5, 4, 3, 2, 2, 2];
        const percentage = prizePercentages[rank - 1] || 0;
        const prizeAmount = (totalPrizePool * percentage) / 100;

        return prizeAmount.toFixed(2);
    }, []);

    const scrollToUserPosition = useCallback(() => {
        if (!currentUserRank?.rank) return;

        // Find the user's card in the leaderboard by rank
        const userCardElement = document.querySelector(`[data-rank="${currentUserRank.rank}"]`);

        if (userCardElement) {
            // Scroll to the user's card with smooth behavior
            userCardElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }, [currentUserRank]);

    // ⚡ SIMPLE & FAST: Just load data once, no intervals, no complex cache logic  
    useEffect(() => {
        // Update time every second for countdown
        const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timeInterval);
    }, []);

    // 🛡️ GLOBAL ERROR HANDLER: Add after all hooks to prevent conditional hook errors
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            console.error('🚨 CRITICAL ERROR CAUGHT:', event.error);
            setHasError(true);
            setErrorMessage(event.error?.message || 'Unknown error');

            // Clear potentially corrupted cache
            try {
                sessionStorage.removeItem('tournament_data');
                sessionStorage.removeItem('leaderboard_data');
            } catch {
                // Ignore cleanup errors
            }
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            console.error('🚨 UNHANDLED PROMISE REJECTION:', event.reason);
            setHasError(true);
            setErrorMessage(event.reason?.message || 'Promise rejection');
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [setHasError, setErrorMessage]);

    // Show error recovery UI if something breaks
    if (hasError) {
        return (
            <Page>
                <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">🚨 App Error Detected</h1>
                    <p className="text-gray-300 mb-4">Error: {errorMessage}</p>
                    <div className="space-y-2">
                        <button
                            onClick={() => {
                                try {
                                    sessionStorage.clear();
                                    localStorage.clear();
                                    setHasError(false);
                                    setErrorMessage('');
                                    window.location.reload();
                                } catch {
                                    // If even this fails, just reload
                                    window.location.href = window.location.href;
                                }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
                        >
                            Clear Cache & Retry
                        </button>
                        <button
                            onClick={() => {
                                setHasError(false);
                                setErrorMessage('');
                            }}
                            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </Page>
        );
    }

    // Calculate time remaining
    const getTimeRemaining = () => {
        console.log('🔍 Timer Debug:', {
            currentTournament: currentTournament,
            end_time: currentTournament?.end_time,
            currentTime: currentTime
        });

        if (!currentTournament || !currentTournament.end_time) return null;

        const now = currentTime.getTime();
        const endTime = new Date(currentTournament.end_time).getTime();
        const timeDiff = endTime - now;

        if (timeDiff <= 0) {
            return {
                status: 'ended' as const,
                timeLeft: 'Tournament Ended'
            };
        }

        // Grace period: 30 minutes before end
        const gracePeriodStart = endTime - (30 * 60 * 1000);
        if (now >= gracePeriodStart) {
            const minutes = Math.floor(timeDiff / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            return {
                status: 'grace' as const,
                timeLeft: `${minutes}m ${seconds}s left`
            };
        }

        // Regular countdown
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

        let timeDisplay = '';
        if (days > 0) timeDisplay += `${days}d `;
        if (hours > 0) timeDisplay += `${hours}h `;
        if (minutes > 0) timeDisplay += `${minutes}m `;
        if (seconds > 0) timeDisplay += `${seconds}s`;

        return {
            status: 'active' as const,
            timeLeft: timeDisplay
        };
    };

    const timeRemaining = getTimeRemaining();

    // 🚀 Show error only if there's a critical error (rare since we have fallback data)
    if (error) {
        return (
            <Page>
                <Page.Main className="main-container">
                    <div className="header-section">
                        <div className="epic-title-section">
                            <h1 className="epic-title">🏆 LEADERBOARD</h1>
                            <div className="error-text">{error || 'No active tournament'}</div>
                        </div>
                    </div>
                    <div className="play-section">
                        <button
                            onClick={() => window.location.href = '/'}
                            className="custom-play-btn"
                        >
                            BACK TO GAME
                        </button>
                    </div>

                    <div className="bottom-nav-container">
                        <div className="space-nav-icons">
                            <button
                                className="space-nav-btn home-nav"
                                onClick={() => window.location.href = '/'}
                                aria-label="Launch Pad"
                            >
                                <div className="space-icon">🏠</div>
                            </button>
                            <button
                                className="space-nav-btn prizes-nav"
                                onClick={() => {/* Already on leaderboard page - no action needed */ }}
                                aria-label="Leaderboard"
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
                {/* Fixed Tournament Title at Very Top */}
                <div className="tournament-main-title" style={{ position: 'relative' }}>
                    <h1>🏆 TOURNAMENT</h1>
                    {/* Connection Status Indicator */}
                    <div className={`connection-status-indicator connection-${connectionStatus}`}>
                        <div className="connection-dot"></div>
                        <span className="connection-text">
                            {connectionStatus === 'connected' ? 'Live' : connectionStatus === 'disconnected' ? 'Connecting...' : 'Error'}
                        </span>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="leaderboard-scroll-content">
                    {/* Tournament Info Box - scrolls naturally with content */}
                    <div className="tournament-info-box">
                        {/* Timer Box - Always show when tournament exists */}
                        {timeRemaining && timeRemaining.timeLeft && (
                            <div className="countdown-timer">
                                ⚡ Tournament ends in {timeRemaining.timeLeft}
                            </div>
                        )}

                        {/* Prize Pool Info - IMPROVED: Only show blur when actually no data, not when cached */}
                        <div className="prize-pool-info">
                            <div className="prize-pool-text">
                                Prize pool: <span className={`prize-pool-highlight ${(!currentTournament && !preloadedLeaderboardData) ? 'loading-blur' : ''}`}>
                                    {currentTournament
                                        ? `${currentTournament.total_prize_pool.toFixed(2)} WLD`
                                        : 'Loading...'}
                                </span>
                            </div>
                            <div className="players-text">
                                <span className={`human-count-number ${(!currentTournament && !preloadedLeaderboardData) ? 'loading-blur' : ''}`}>
                                    {currentTournament
                                        ? (currentTournament.total_tournament_players ?? currentTournament.total_players ?? 0) // Safe fallback to prevent crashes
                                        : '...'}
                                </span> <span className="humans-playing-highlight">humans are playing to win the prize pool</span>
                            </div>
                        </div>

                        {/* Prize Info */}
                        <div className="prize-info-box">
                            <span className="prize-info-text">
                                When the game ends, the prize will be shared to the top winners
                            </span>
                            <button
                                className="prize-arrow-btn-right"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowPrizeBreakdown(!showPrizeBreakdown);
                                }}
                                type="button"
                            >
                                {showPrizeBreakdown ? '▲' : '▼'}
                            </button>
                        </div>

                        {/* Prize Breakdown - Always Visible with 2 per row */}
                        {showPrizeBreakdown && (
                            <div className="prize-breakdown-grid">
                                <div className="prize-row">
                                    <div className="prize-box">🥇 1st: 40%</div>
                                    <div className="prize-box">🥈 2nd: 22%</div>
                                </div>
                                <div className="prize-row">
                                    <div className="prize-box">🥉 3rd: 14%</div>
                                    <div className="prize-box">🏆 4th: 6%</div>
                                </div>
                                <div className="prize-row">
                                    <div className="prize-box">🏆 5th: 5%</div>
                                    <div className="prize-box">🏆 6th: 4%</div>
                                </div>
                                <div className="prize-row">
                                    <div className="prize-box">🏆 7th: 3%</div>
                                    <div className="prize-box">🏆 8th-10th: 2% each</div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="leaderboard-section">
                        {/* Sticky Header Row for Leaderboard */}
                        <div className="leaderboard-header-row">
                            <div className="header-rank">Rank</div>
                            <div className="header-player">Human</div>
                            <div className="header-score">Score</div>
                            <div className="header-prize">Prize</div>
                        </div>

                        <TournamentLeaderboard
                            key={preloadedLeaderboardData?.realtime_update_id || "initial"}
                            tournamentId={currentTournament?.id}
                            currentUserId={session?.user?.walletAddress || null}
                            currentUsername={session?.user?.username || null}
                            isGracePeriod={timeRemaining?.status === 'grace'}
                            totalPrizePool={currentTournament?.total_prize_pool}
                            preloadedData={preloadedLeaderboardData} // 🚀 NEW: Pass preloaded data
                            onUserRankUpdate={handleUserRankUpdate}
                            onUserCardVisibility={handleUserCardVisibility}
                        />
                    </div>
                </div>
            </Page.Main>

            {/* Fixed user rank card - completely outside scrolling area */}
            {shouldShowFixedCard && currentUserRank && (
                <div
                    className="fixed-user-position-container clickable-fixed-card"
                    style={{
                        position: 'fixed',
                        bottom: '80px', // Above bottom navigation
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: '10px',
                        borderRadius: '10px',
                        border: '2px solid #00F5FF',
                        zIndex: 9998, // Below bottom nav but above content
                        width: 'calc(100% - 2rem)',
                        maxWidth: '500px',
                        cursor: 'pointer'
                    }}
                    onClick={scrollToUserPosition}
                >
                    <div className="scroll-indicator-icon">📍</div>
                    <PlayerRankCard
                        player={currentUserRank}
                        prizeAmount={calculatePrizeForRank(currentUserRank.rank || 1001, currentTournament?.total_prize_pool || 0)}
                        isCurrentUser={true}
                        isTopThree={currentUserRank.rank !== undefined && currentUserRank.rank <= 10}
                    />
                </div>
            )}

            {/* Fixed Bottom Navigation - completely outside scrolling area */}
            <div className="bottom-nav-container">
                <div className="space-nav-icons">
                    <button
                        className="space-nav-btn home-nav"
                        onClick={() => window.location.href = '/'}
                        aria-label="Launch Pad"
                    >
                        <div className="space-icon">🏠</div>
                    </button>
                    <button
                        className="space-nav-btn prizes-nav"
                        onClick={() => {/* Already on leaderboard - no action needed */ }}
                        aria-label="Leaderboard"
                    >
                        <div className="space-icon">🏆</div>
                    </button>
                </div>
            </div>
        </Page>
    );
}