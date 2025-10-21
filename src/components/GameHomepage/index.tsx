"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import { useGameAuth } from '@/hooks/useGameAuth';
import { Page } from '@/components/PageLayout';
import dynamic from 'next/dynamic';
import { TournamentEntryModal } from '@/components/TournamentEntryModal';
import InfoModal from '@/components/INFO';
import GracePeriodModal from '@/components/GracePeriodModal';
import { GameErrorBoundary } from '@/components/GameErrorBoundary';
import { CACHE_TTL } from '@/utils/leaderboard-cache';
import { canContinue, spendCoins, getCoins, addCoins } from '@/utils/coins';
import { useSocketIO } from '@/contexts/SocketIOContext';
import { fetchWithTimeout } from '@/utils/fetch-timeout';
import { GameNotification } from '@/components/GameNotification';

// Dynamically import FlappyGame to avoid SSR issues
const FlappyGame = dynamic(() => import('@/components/FlappyGame'), {
    ssr: false
});

// Dynamically import DevSignOut only in development
const DevSignOut = dynamic(() => import('@/components/DevSignOut'), {
    ssr: false
});

interface Star {
    x: number;
    y: number;
    z: number;
    size: number;
    reset(width: number, height: number): void;
    update(moveSpeed: number, deltaMouseX: number, deltaMouseY: number, width: number, height: number): void;
    draw(ctx: CanvasRenderingContext2D, width: number, height: number): void;
}

type GameMode = 'practice' | 'tournament';

export default function GameHomepage() {
    // CRITICAL: Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true);
    const modalOpenRef = useRef(false); // Track modal state to prevent race conditions
    const { socket, joinTournamentRoom } = useSocketIO(); // ✅ Use global socket context

    const [currentScreen, setCurrentScreen] = useState<'home' | 'gameSelect' | 'tournamentEntry' | 'playing'>('home');
    const [gameMode, setGameMode] = useState<GameMode | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isGracePeriodModalOpen, setIsGracePeriodModalOpen] = useState(false);
    const [gracePeriodEndTime, setGracePeriodEndTime] = useState<string | undefined>();

    // Cleanup on unmount to prevent state updates
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);    // Debug state changes
    useEffect(() => {
    }, [currentScreen]);

    useEffect(() => {
    }, [isInfoModalOpen]);

    // Close info modal when navigating away from home screen
    useEffect(() => {
        if (currentScreen !== 'home' && isInfoModalOpen) {
            setIsInfoModalOpen(false);
        }
    }, [currentScreen, isInfoModalOpen]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false); // Local auth state

    // Use single session management per Plan.md
    const { session } = useSessionPersistence();

    // 🚀 GAMING INDUSTRY PERFORMANCE: Pre-warm cache on app startup for instant loading
    useEffect(() => {
        // 🚀 OPTIMIZATION: Check if cache is already warm to prevent redundant calls
        const isAlreadyWarming = sessionStorage.getItem('cache_warming_in_progress');
        if (isAlreadyWarming) {
            return;
        }

        // Mark warming as in progress
        sessionStorage.setItem('cache_warming_in_progress', Date.now().toString());

        // Warm cache immediately when app loads for instant tournament access
        fetch('/api/warm-cache', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                }
            })
            .catch(() => {
                // Intentionally ignore cache warming errors
            })
            .finally(() => {
                // Clear the warming flag after completion
                sessionStorage.removeItem('cache_warming_in_progress');
            });
    }, []); // Run once on app startup

    // ✅ Use useGameAuth hook for authentication (handles wallet auth + database operations)
    const { authenticate, isAuthenticating: hookIsAuthenticating } = useGameAuth();

    // Sync local auth state with hook state for UI updates
    useEffect(() => {
        setIsAuthenticating(hookIsAuthenticating);
    }, [hookIsAuthenticating]);

    // Verification status state
    // Verification state - managed properly with World App session per Plan.md
    const [isVerifiedToday, setIsVerifiedToday] = useState<boolean>(false);
    const [verificationLoading, setVerificationLoading] = useState<boolean>(false);
    const [orbCapabilityLoading, setOrbCapabilityLoading] = useState<boolean>(false);

    // Notification state for GameNotification modal
    const [notification, setNotification] = useState<{
        show: boolean;
        type: 'success' | 'error' | 'warning' | 'info';
        title: string;
        message: string;
    }>({
        show: false,
        type: 'info',
        title: '',
        message: ''
    });

    // Helper function to show notifications
    const showNotification = useCallback((
        type: 'success' | 'error' | 'warning' | 'info',
        title: string,
        message: string
    ) => {
        setNotification({ show: true, type, title, message });
    }, []);

    // Tournament entry loading states to prevent duplicate operations
    const [isProcessingEntry, setIsProcessingEntry] = useState<boolean>(false);

    // Practice mode continue functionality
    const [continueFromScore, setContinueFromScore] = useState<number>(0);

    // Tournament mode continue tracking
    const [tournamentContinueUsed, setTournamentContinueUsed] = useState<boolean>(false);
    const [tournamentEntryAmount, setTournamentEntryAmount] = useState<number>(1.0); // Track entry amount for continue payment

    // Payment processing state - prevents navigation during payment flow
    const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);

    // 🚀 Track user's current highest score for Socket.IO real-time updates and modal display
    const [userHighestScore, setUserHighestScore] = useState<number | null>(null);
    const [currentTournamentId, setCurrentTournamentId] = useState<string | null>(null);
    const [scoreUpdateTrigger, setScoreUpdateTrigger] = useState<number>(0); // Force refresh trigger


    // Check user's verification status for today's tournament
    const checkVerificationStatus = useCallback(async () => {
        if (!session?.user?.walletAddress) return false;

        try {
            setVerificationLoading(true);

            const response = await fetch('/api/users/verification-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: session.user.walletAddress,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setIsVerifiedToday(data.data.isVerified);
                return data.data.isVerified;
            } else {
                console.error('❌ Failed to check verification status:', data.error);
                setIsVerifiedToday(false);
                return false;
            }
        } catch (error) {
            console.error('❌ Error checking verification status:', error);
            setIsVerifiedToday(false);
            return false;
        } finally {
            setVerificationLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 🚀 FIX: Empty deps array to prevent infinite loop - function is stable

    // Check verification status when user session changes
    useEffect(() => {
        if (session?.user?.walletAddress) {
            checkVerificationStatus();
        } else {
            setIsVerifiedToday(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.user?.walletAddress]);

    // 🔮 CHECK ORB VERIFICATION CAPABILITY
    // Made available to everyone - MiniKit will validate Orb ownership during verification
    const checkOrbVerificationCapability = useCallback(async () => {
        if (!session?.user?.walletAddress) return false;

        try {
            setOrbCapabilityLoading(true);

            // Always allow users to try Orb verification
            // MiniKit will handle validation and show appropriate error if user doesn't have Orb
            return true;
        } catch (error) {
            console.error('❌ Error checking Orb capability:', error);
            return true;
        } finally {
            setOrbCapabilityLoading(false);
        }
    }, [session?.user?.walletAddress]);

    // Check both verification status and Orb capability when wallet changes
    useEffect(() => {
        if (session?.user?.walletAddress) {
            checkVerificationStatus();
            checkOrbVerificationCapability();
        }
    }, [session?.user?.walletAddress, checkVerificationStatus, checkOrbVerificationCapability]); // 🚀 FIX: Removed checkVerificationStatus from deps to prevent infinite loop

    // 🚀 FIX: Fetch user's current highest score and setup Socket.IO real-time updates
    useEffect(() => {
        const fetchUserHighestScore = async () => {
            if (!session?.user?.walletAddress) {
                setUserHighestScore(null);
                setCurrentTournamentId(null);
                return;
            }

            try {
                // Fetch current tournament to get tournament_id
                const tournamentRes = await fetchWithTimeout('/api/tournament/current');
                const tournamentData = await tournamentRes.json();

                if (!tournamentData?.tournament?.id) {
                    return;
                }

                const tournamentId = tournamentData.tournament.id;
                setCurrentTournamentId(tournamentId);

                // Fetch user's tournament record to get highest score
                const userRes = await fetchWithTimeout('/api/tournament/leaderboard-data');
                const leaderboardData = await userRes.json();

                if (leaderboardData?.players) {
                    const userRecord = leaderboardData.players.find(
                        (player: { wallet: string; highest_score: number }) =>
                            player.wallet?.toLowerCase() === session.user.walletAddress?.toLowerCase()
                    );

                    if (userRecord) {
                        setUserHighestScore(userRecord.highest_score || 0);
                    } else {
                        setUserHighestScore(0);
                    }
                }
            } catch (error) {
                console.error('❌ Error fetching user highest score:', error);
            }
        };

        fetchUserHighestScore();
    }, [session?.user?.walletAddress, currentScreen, scoreUpdateTrigger]); // Re-fetch when score updates

    // 🚀 FIX: Setup Socket.IO connection for real-time score updates on the playing device
    useEffect(() => {
        if (!currentTournamentId || !session?.user?.id || !socket) {
            return;
        }

        const userId = session.user.id;
        const username = session.user.name || 'Anonymous';

        // Handler for score updates
        const handleScoreUpdate = (message: { tournament_id: string; data: { user_id: string; new_score: number } }) => {
            const { data } = message;
            // Only update if it's the current user's score
            if (data.user_id === userId) {
                setUserHighestScore(data.new_score);
                // Note: Modal doesn't display currentHigh to avoid confusion with outdated data
            }
        };

        socket.on('connect', () => {
            joinTournamentRoom(currentTournamentId, userId, username);
        });

        // Remove any existing listener first to prevent duplicates
        socket.off('score_update', handleScoreUpdate);
        socket.on('score_update', handleScoreUpdate);

        // Only cleanup listener, don't disconnect socket (let it persist)
        return () => {
            socket.off('score_update', handleScoreUpdate);
        };
    }, [currentTournamentId, session?.user?.id, session?.user?.name, socket, joinTournamentRoom]);

    // 🚀 LIGHTNING FAST LEADERBOARD: Pre-load leaderboard data in background
    // This makes leaderboard tab load instantly when clicked (0ms perceived load time)
    // Industry standard used by Clash Royale, PUBG Mobile, etc.
    useEffect(() => {
        const preloadLeaderboard = async () => {
            try {
                // 🚀 DEPLOYMENT FIX: Add environment-based cache keys to prevent prod/dev conflicts
                const envPrefix = process.env.NODE_ENV === 'production' ? 'prod_' : 'dev_';
                const tournamentKey = `${envPrefix}preloaded_tournament`;
                const leaderboardKey = `${envPrefix}preloaded_leaderboard`;

                // Check if data is already cached and fresh
                const existingTournament = sessionStorage.getItem(tournamentKey);
                const existingLeaderboard = sessionStorage.getItem(leaderboardKey);

                if (existingTournament && existingLeaderboard) {
                    try {
                        const tournamentCache = JSON.parse(existingTournament);
                        const leaderboardCache = JSON.parse(existingLeaderboard);
                        const now = Date.now();

                        const tournamentFresh = (now - tournamentCache.timestamp) < tournamentCache.ttl;
                        const leaderboardFresh = (now - leaderboardCache.timestamp) < leaderboardCache.ttl;

                        if (tournamentFresh && leaderboardFresh) {
                            return;
                        }
                    } catch {
                        // Corrupted cache, proceed with fresh load
                    }
                }

                // Pre-load both tournament info and leaderboard data
                const [tournamentResponse, leaderboardResponse] = await Promise.all([
                    fetchWithTimeout('/api/tournament/current'),
                    fetchWithTimeout('/api/tournament/leaderboard-data')
                ]);

                if (tournamentResponse.ok && leaderboardResponse.ok) {
                    const tournamentData = await tournamentResponse.json();
                    const leaderboardData = await leaderboardResponse.json();

                    // Store in sessionStorage with environment-specific keys
                    sessionStorage.setItem(tournamentKey, JSON.stringify({
                        data: tournamentData,
                        timestamp: Date.now(),
                        ttl: CACHE_TTL.PRELOAD_TOURNAMENT // Use standardized preload tournament cache TTL
                    }));

                    sessionStorage.setItem(leaderboardKey, JSON.stringify({
                        data: leaderboardData,
                        timestamp: Date.now(),
                        ttl: CACHE_TTL.PRELOAD_LEADERBOARD // Use standardized preload leaderboard cache TTL
                    }));

                } else {
                }
            } catch {
                // Silent failure - regular loading will work as fallback
            }
        };

        // 🚀 AGGRESSIVE PRE-LOADING: Start immediately when homepage loads 
        // Zero delay so cache is ready before user can even click leaderboard
        preloadLeaderboard().then(() => {
            // Pre-load success
        }).catch((error) => {
            console.error('❌ Pre-loading failed:', error);
        });
    }, []); // Only run once when component mounts

    // Check if tournament is still active before allowing payments
    const checkTournamentActive = useCallback(async () => {
        try {
            const response = await fetch('/api/tournament/current');
            const data = await response.json();

            if (data.tournament && data.status) {
                // Check if tournament has ended
                if (data.status.has_ended) {
                    showNotification('error', 'Tournament Ended', 'Tournament has ended! You can no longer participate.');
                    return false;
                }

                // Check if tournament hasn't started
                if (data.status.has_not_started) {
                    showNotification('warning', 'Not Started Yet', 'Tournament has not started yet! Please wait.');
                    return false;
                }

                // Check if we're in grace period (last 30 minutes)
                if (data.status.is_grace_period) {
                    // Show grace period modal instead of alert
                    setGracePeriodEndTime(data.status.end_time);
                    setIsGracePeriodModalOpen(true);
                    return false;
                }

                // Check if entries are allowed (covers other edge cases)
                if (!data.status.entries_allowed) {
                    showNotification('error', 'Entries Not Allowed', 'Tournament entries are not allowed at this time.');
                    return false;
                }

                return true;
            } else {
                showNotification('error', 'No Tournament', 'No active tournament found!');
                return false;
            }
        } catch (error) {
            console.error('Error checking tournament status:', error);
            showNotification('error', 'Check Failed', 'Failed to check tournament status. Please try again.');
            return false;
        }
    }, [showNotification]);

    // Stable event handlers to prevent recreation and caching issues
    const handleInfoClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsInfoModalOpen(true);
    }, []);

    const handlePlayClick = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Authenticate ONCE on "Tap to Play" - prevents duplicate sign-in prompts
        const authSuccess = await authenticate();

        if (authSuccess) {
            setCurrentScreen('gameSelect');
        }
    }, [authenticate]);

    // Handle game start - authentication already done in handlePlayClick
    const handleGameStart = async (mode: GameMode) => {
        try {
            // Reset all game-related state when starting a new game
            setGameResult({ show: false, score: 0, coins: 0, mode: '' });
            setIsSubmittingScore(false);
            setContinueFromScore(0);
            setTournamentContinueUsed(false); // Reset continue state for new game

            // User already authenticated in handlePlayClick - proceed directly
            if (mode === 'practice') {
                // Start practice game immediately
                setGameMode(mode);
                setCurrentScreen('playing');
            } else {
                // For tournament mode, check tournament status first
                try {
                    const response = await fetch('/api/tournament/current');
                    const data = await response.json();

                    if (data.status && !data.status.entries_allowed) {
                        // Tournament entries not allowed - check why
                        if (data.status.has_not_started) {
                            const startTime = new Date(data.tournament.start_time);
                            const minutesUntilStart = Math.ceil((startTime.getTime() - new Date().getTime()) / 60000);
                            showNotification('warning', 'Not Started Yet', `Tournament has not started yet. Starts in ${minutesUntilStart} minutes!`);
                        } else if (data.status.has_ended) {
                            showNotification('error', 'Tournament Ended', 'Tournament has ended. Please wait for the next tournament.');
                        } else if (data.status.is_grace_period) {
                            showNotification('info', 'Grace Period', 'Tournament is in grace period - no new entries allowed. Existing players can still play!');
                        } else {
                            showNotification('error', 'Entries Not Allowed', 'Tournament entries are not allowed at this time.');
                        }
                        return;
                    }

                    // Tournament entries allowed, go to tournament entry screen
                    setCurrentScreen('tournamentEntry');
                } catch (error) {
                    console.error('Error checking tournament status:', error);
                    showNotification('error', 'Check Failed', 'Unable to check tournament status. Please try again.');
                    return;
                }
            }
        } catch (error) {
            console.error('Error during game start:', error);
            showNotification('error', 'Error', 'Something went wrong. Please try again.');
        }
    };

    // Handle tournament entry selection
    const handleTournamentEntrySelect = async (entryType: 'verify' | 'standard' | 'verified') => {
        // Prevent duplicate operations
        if (isProcessingEntry) {
            return;
        }

        // Check if tournament is still active BEFORE payment
        const tournamentActive = await checkTournamentActive();
        if (!tournamentActive) {
            return; // Stop here if tournament ended
        }

        try {
            setIsProcessingEntry(true);
            setIsProcessingPayment(true); // Disable navigation during payment

            if (entryType === 'verify') {
                // Verify identity first, then pay 0.9 WLD
                await handleWorldIDVerification();
            } else if (entryType === 'verified') {
                // User is already verified, proceed with 0.9 WLD payment
                await handlePayment(0.9, true);
            } else {
                // Standard entry - proceed with 1.0 WLD payment
                await handlePayment(1.0, false);
            }

        } catch (error) {
            console.error('Error during tournament entry:', error);
            showNotification('error', 'Entry Failed', 'Tournament entry failed. Please try again.');
            setIsProcessingPayment(false); // Re-enable navigation on error
        } finally {
            setIsProcessingEntry(false);
        }
    };

    // Handle World ID verification for verified entry
    const handleWorldIDVerification = async () => {
        try {
            const { MiniKit, VerificationLevel } = await import('@worldcoin/minikit-js');

            // Use MiniKit to verify World ID with Orb verification level
            const result = await MiniKit.commandsAsync.verify({
                action: 'flappy-ufo', // World ID app identifier from developer portal
                verification_level: VerificationLevel.Orb, // Require Orb verification for discount
            });

            // Send proof to backend for verification
            const response = await fetch('/api/verify-proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: result.finalPayload,
                    action: 'flappy-ufo', // Updated to match World ID app
                }),
            });

            const verificationData = await response.json();

            if (verificationData.success) {
                // Update user's verification status in database
                await updateUserVerificationStatus(
                    verificationData.nullifier_hash,
                    verificationData.verification_level
                );
                // Proceed with 0.9 WLD payment
                await handlePayment(0.9, true);
            } else {
                throw new Error(verificationData.error || 'Verification failed');
            }

        } catch (error) {
            console.error('World ID verification error:', error);

            // Provide more specific error messages
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            if (errorMessage.includes('CredentialUnavailable') || errorMessage.includes('verification level')) {
                showNotification('warning', 'Orb Required', 'Orb verification is required for the discounted entry. Please use an Orb to verify your World ID, or choose Standard Entry (1.0 WLD).');
            } else if (errorMessage.includes('MaxVerificationsReached')) {
                showNotification('error', 'Max Verifications', 'You have already verified the maximum number of times for this tournament. Please try again in the next tournament.');
            } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
                showNotification('error', 'Network Error', 'Network error during verification. Please check your connection and try again, or use Standard Entry.');
            } else {
                showNotification('error', 'Verification Failed', 'World ID verification failed. Please try again or use Standard Entry (1.0 WLD).');
            }
        }
    };

    // Update user verification status in database
    const updateUserVerificationStatus = async (nullifierHash: string, verificationLevel?: string) => {
        try {
            if (!session?.user?.walletAddress) {
                throw new Error('No wallet address found in session');
            }

            const response = await fetch('/api/users/update-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nullifier_hash: nullifierHash,
                    verification_date: new Date().toISOString(),
                    wallet: session.user.walletAddress, // Pass wallet address
                    verification_level: verificationLevel, // Pass verification level
                }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                console.error('❌ Verification update failed:', responseData);
                throw new Error(responseData.error || `HTTP ${response.status}: Failed to update verification status`);
            }

            // Refresh verification status after successful update
            await checkVerificationStatus();

            return responseData;
        } catch (error) {
            console.error('❌ Error updating verification status:', error);

            // More specific error message
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            showNotification('error', 'Database Update Failed', `Verification failed to save to database: ${errorMessage}. Please try again.`);

            return null;
        }
    };

    // Create tournament entry after successful payment
    const createTournamentEntry = async (paymentReference: string, amount: number, isVerified: boolean) => {
        try {
            if (!session?.user?.walletAddress) {
                throw new Error('No wallet address found in session');
            }

            const response = await fetch('/api/tournament/entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payment_reference: paymentReference,
                    paid_amount: amount,
                    is_verified_entry: isVerified,
                    wallet: session.user.walletAddress,
                }),
            });

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.error || 'Failed to create tournament entry');
            }

            return responseData.data;

        } catch (error) {
            console.error('❌ Error creating tournament entry:', error);

            // More specific error message
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            showNotification('error', 'Entry Registration Failed', `Payment successful but failed to register tournament entry.\n\nError: ${errorMessage}\n\nPlease contact support at flappyufo.help@gmail.com if this persists.`);
            throw error;
        }
    };

    // Handle payment
    const handlePayment = async (amount: number, isVerified: boolean) => {
        // 🔥 CRITICAL: Check tournament status BEFORE accepting payment
        const tournamentActive = await checkTournamentActive();
        if (!tournamentActive) {
            // checkTournamentActive already shows appropriate modal/alert
            return;
        }

        try {
            const { MiniKit, Tokens, tokenToDecimals } = await import('@worldcoin/minikit-js');

            // Get payment reference from backend
            const res = await fetch('/api/initiate-payment', {
                method: 'POST',
            });
            const { id } = await res.json();

            // Make payment using MiniKit
            const result = await MiniKit.commandsAsync.pay({
                reference: id,
                to: process.env.NEXT_PUBLIC_ADMIN_WALLET || '',
                tokens: [
                    {
                        symbol: Tokens.WLD,
                        token_amount: tokenToDecimals(amount, Tokens.WLD).toString(),
                    },
                ],
                description: `Flappy UFO Tournament Entry ${isVerified ? '(Verified - 0.9 WLD)' : '(Standard - 1.0 WLD)'}`,
            });

            if (result.finalPayload.status === 'success') {
                try {
                    // Create tournament entry after successful payment
                    await createTournamentEntry(result.finalPayload.reference, amount, isVerified);

                    // Track entry amount and reset continue status for new game
                    setTournamentEntryAmount(amount);
                    setTournamentContinueUsed(false);

                    // Start the game directly (only if entry creation succeeds)
                    setGameMode('tournament');
                    setCurrentScreen('playing');

                    // Re-enable navigation after game starts
                    setIsProcessingPayment(false);
                } catch (entryError) {
                    // Payment succeeded but entry creation failed
                    // Don't throw error here to avoid double alert
                    console.error('❌ Tournament entry creation failed after successful payment:', entryError);
                    // The error message is already shown in createTournamentEntry function
                    setIsProcessingPayment(false); // Re-enable navigation on error
                    return;
                }
            } else {
                setIsProcessingPayment(false); // Re-enable navigation if payment cancelled
                throw new Error('Payment failed or was cancelled');
            }
        } catch (error) {
            console.error('❌ Payment error:', error);
            showNotification('error', 'Payment Failed', 'Payment failed. Please try again.');
            setIsProcessingPayment(false); // Re-enable navigation on error
        }
    };

    // Handle tournament continue payment
    const handleTournamentContinue = async (score: number) => {
        // � CRITICAL: Check if modal is still open (prevent race condition with Go Home button)
        if (!modalOpenRef.current) {
            setIsProcessingPayment(false);
            return;
        }

        // �🔥 CRITICAL: Check if tournament is still active BEFORE payment (blocks grace period)
        const tournamentActive = await checkTournamentActive();
        if (!tournamentActive) {
            // checkTournamentActive already shows grace period modal or alert
            setIsProcessingPayment(false);
            return;
        }

        try {
            const { MiniKit, Tokens, tokenToDecimals } = await import('@worldcoin/minikit-js');

            // Get payment reference from backend for continue payment
            const res = await fetch('/api/initiate-payment', {
                method: 'POST',
            });
            const { id } = await res.json();

            // Make continue payment using 50% of entry fee
            const continueAmount = tournamentEntryAmount * 0.5;
            const result = await MiniKit.commandsAsync.pay({
                reference: id,
                to: process.env.NEXT_PUBLIC_ADMIN_WALLET || '',
                tokens: [
                    {
                        symbol: Tokens.WLD,
                        token_amount: tokenToDecimals(continueAmount, Tokens.WLD).toString(),
                    },
                ],
                description: `Flappy UFO Tournament Continue (${continueAmount} WLD)`,
            });

            if (result.finalPayload.status === 'success') {
                // Record continue payment in database (only continue-specific columns)
                try {
                    const continueAmount = tournamentEntryAmount * 0.5;
                    const continueResponse = await fetch('/api/tournament/continue', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            continue_amount: continueAmount
                        }),
                    });

                    const continueData = await continueResponse.json();

                    if (!continueData.success) {
                        // Don't fail the continue - just log the warning
                    }
                } catch {
                    // Don't fail the continue - just log the warning
                }

                // Mark continue as used and continue the game from current score
                setTournamentContinueUsed(true);
                setContinueFromScore(score);
                setGameResult({ show: false, score: 0, coins: 0, mode: '' });

                // Re-enable navigation after game restarts
                setIsProcessingPayment(false);

            } else {
                setIsProcessingPayment(false); // Re-enable navigation if payment cancelled
                throw new Error('Continue payment failed or was cancelled');
            }
        } catch {
            // Handle continue payment errors silently or with user-friendly message
            setIsProcessingPayment(false); // Re-enable navigation on error
        }
    };

    // Handle when user chooses NOT to continue (final game over)
    const handleFinalGameOver = async (score: number) => {
        // CRITICAL: Check if component is still mounted
        if (!isMountedRef.current) {
            return;
        }

        // CRITICAL: Prevent duplicate submissions and race conditions
        if (gameMode !== 'tournament' || !session?.user?.walletAddress || isSubmittingScore) {
            return;
        }

        setIsSubmittingScore(true);

        try {
            const response = await fetch('/api/score/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: session.user.walletAddress,
                    score: score,
                    game_duration: Math.max(score * 2000, 5000),
                    used_continue: false,
                    continue_amount: 0
                }),
            });

            // Check if component is still mounted before continuing
            if (!isMountedRef.current) {
                return;
            }

            if (!response.ok) {
                throw new Error(`Score submission failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            // CRITICAL: Only update state if component is still mounted and in tournament mode
            if (!isMountedRef.current) {
                return;
            }

            if (gameMode !== 'tournament') {
                return;
            }

            // Update modal with high score info
            if (result.success && !result.data.is_duplicate && result.data.is_new_high_score) {
                // 🚀 FIX: Immediately update local highest score state for instant display
                setUserHighestScore(result.data.current_highest_score);
                setScoreUpdateTrigger(Date.now()); // Trigger refresh

                // 🎯 CRITICAL FIX: Keep the HIGHER value (instant calc vs API)
                // Don't let API overwrite if we already calculated a higher value
                setGameResult(prev => ({
                    ...prev,
                    currentHigh: Math.max(prev.currentHigh || 0, result.data.current_highest_score),
                    isNewHighScore: result.data.is_new_high_score,
                    previousHigh: result.data.previous_highest_score,
                    currentRank: result.data.current_rank // 🎯 INSTANT RANK display
                }));

                // 🚀 INSTANT OWN SCORE UPDATE: Clear cache + set invalidation flag
                try {
                    // Clear ALL possible cache keys for instant own score update
                    sessionStorage.removeItem('leaderboard_data');
                    sessionStorage.removeItem('tournament_data');
                    sessionStorage.removeItem('preloaded_leaderboard');
                    sessionStorage.removeItem('preloaded_tournament');
                    sessionStorage.removeItem('prod_preloaded_leaderboard');
                    sessionStorage.removeItem('prod_preloaded_tournament');
                    sessionStorage.removeItem('dev_preloaded_leaderboard');
                    sessionStorage.removeItem('dev_preloaded_tournament');

                    // 🎯 CRITICAL: Set cache invalidation timestamp for instant leaderboard refresh
                    sessionStorage.setItem('cache_invalidated_at', Date.now().toString());
                } catch {
                }
            } else if (result.success) {
                // Update local state with current highest score for Socket.IO and future reference
                if (result.data.current_highest_score !== undefined) {
                    setUserHighestScore(result.data.current_highest_score);
                    setScoreUpdateTrigger(Date.now()); // Trigger refresh

                    // 🎯 CRITICAL FIX: Keep HIGHER value (don't let API downgrade instant calc)
                    setGameResult(prev => ({
                        ...prev,
                        currentHigh: Math.max(prev.currentHigh || 0, result.data.current_highest_score),
                        currentRank: result.data.current_rank // 🎯 INSTANT RANK display
                    }));
                }

                // 🚀 INSTANT UPDATE: ALWAYS clear cache for ANY score submission (even duplicates)
                // This ensures leaderboard shows current data when user navigates
                try {
                    sessionStorage.removeItem('leaderboard_data');
                    sessionStorage.removeItem('tournament_data');
                    sessionStorage.removeItem('preloaded_leaderboard');
                    sessionStorage.removeItem('preloaded_tournament');
                    sessionStorage.removeItem('prod_preloaded_leaderboard');
                    sessionStorage.removeItem('prod_preloaded_tournament');
                    sessionStorage.removeItem('dev_preloaded_leaderboard');
                    sessionStorage.removeItem('dev_preloaded_tournament');

                    // 🎯 CRITICAL: Set cache invalidation timestamp for instant leaderboard refresh
                    const invalidationTime = Date.now();
                    sessionStorage.setItem('cache_invalidated_at', invalidationTime.toString());
                } catch {
                }
            } else if (!result.success) {
                console.error('Score submission failed:', result.error);
                if (isMountedRef.current) {
                    setGameResult(prev => ({
                        ...prev,
                        error: result.error || 'Score submission failed'
                    }));
                }
            }
        } catch (error) {
            console.error('❌ Final score submission failed:', error);
            // Only update state if still in valid state and mounted
            if (isMountedRef.current && gameMode === 'tournament') {
                setGameResult(prev => ({
                    ...prev,
                    error: 'Unable to submit final score. Please check your connection.'
                }));
            }
        } finally {
            // Always clear submission state if mounted
            if (isMountedRef.current) {
                setIsSubmittingScore(false);
            }
        }
    };    // Handle going back from tournament entry screen
    const handleTournamentEntryBack = () => {
        setCurrentScreen('gameSelect');
    };

    // Game result state for modal
    const [gameResult, setGameResult] = useState<{
        show: boolean;
        score: number;
        coins: number;
        mode: string;
        isNewHighScore?: boolean;
        previousHigh?: number;
        currentHigh?: number;
        currentRank?: number;
        error?: string;
    }>({
        show: false,
        score: 0,
        coins: 0,
        mode: '',
    });

    // Track if score has been submitted to prevent duplicates
    const [isSubmittingScore, setIsSubmittingScore] = useState<boolean>(false);

    // Handle game end
    const handleGameEnd = async (score: number, coins: number) => {
        // Prevent duplicate submissions
        if (isSubmittingScore) {
            return;
        }

        const modeText = gameMode === 'practice' ? 'Practice' : 'Tournament';

        // DON'T reset continue - keep it so second crash shows "Play Again" not "Continue"
        // setContinueFromScore(0); // REMOVED - this was causing bug

        // Calculate current high score
        const currentHigh = userHighestScore || 0;
        const newHighScore = Math.max(score, currentHigh);
        const isNewHigh = score > currentHigh;

        // Show modal IMMEDIATELY for instant feedback (best UX)
        setGameResult({
            show: true,
            score,
            coins,
            mode: modeText,
            currentHigh: newHighScore,
            isNewHighScore: isNewHigh,
            previousHigh: isNewHigh ? currentHigh : undefined
        });
        modalOpenRef.current = true;

        // For tournament mode, submit score in background (no need to wait for rank)
        if (gameMode === 'tournament' && session?.user?.walletAddress) {
            setIsSubmittingScore(true);

            try {
                await fetch('/api/score/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet: session.user.walletAddress,
                        score: score,
                        game_duration: Math.max(score * 2000, 5000),
                        used_continue: tournamentContinueUsed,
                        continue_amount: tournamentContinueUsed ? tournamentEntryAmount : 0
                    }),
                });

                // Don't need to wait for result - just submit and forget
                // Leaderboard will show updated rank when they check it
            } catch (error) {
                console.error('Score submission failed:', error);
            } finally {
                setIsSubmittingScore(false);
            }
        }

        // Update coins for practice mode
        if (gameMode === 'practice') {
            addCoins(coins);
        }
    };

    useEffect(() => {
        // Run stars animation on all screens
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        class StarImpl implements Star {
            x = 0;
            y = 0;
            z = 0;
            size = 0;
            constructor(width: number, height: number) {
                this.reset(width, height);
            }
            reset(width: number, height: number) {
                this.x = (Math.random() - 0.5) * width;
                this.y = (Math.random() - 0.5) * height;
                this.z = Math.random() * width;
                this.size = Math.random() * 1.2 + 0.3;
            }
            update(moveSpeed: number, deltaMouseX: number, deltaMouseY: number, width: number, height: number) {
                this.z -= moveSpeed;
                if (this.z <= 1) {
                    this.reset(width, height);
                    this.z = width;
                }
                this.x += deltaMouseX * 0.0006 * this.z;
                this.y += deltaMouseY * 0.0006 * this.z;
                if (this.x > width / 2) this.x -= width;
                else if (this.x < -width / 2) this.x += width;
                if (this.y > height / 2) this.y -= height;
                else if (this.y < -height / 2) this.y += height;
            }
            draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
                const sx = (this.x / this.z) * width + width / 2;
                const sy = (this.y / this.z) * height + height / 2;
                const radius = (1 - this.z / width) * this.size * 2.3;
                if (sx < 0 || sx >= width || sy < 0 || sy >= height || radius <= 0) return;
                ctx.beginPath();
                ctx.fillStyle = 'white';
                ctx.shadowColor = 'white';
                ctx.shadowBlur = 2 * (1 - this.z / width);
                ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const numStars = 250;
        const stars: Star[] = [];
        for (let i = 0; i < numStars; i++) {
            stars.push(new StarImpl(width, height));
        }

        let mouseX = 0;
        let mouseY = 0;
        let previousMouseX = 0;
        let previousMouseY = 0;
        let running = true;

        function animate() {
            if (!running || !ctx) return;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
            const dx = mouseX - previousMouseX;
            const dy = mouseY - previousMouseY;
            // Use slower speed during gameplay, faster on other screens
            const moveSpeed = currentScreen === 'playing' ? 1.5 : 4;
            for (const star of stars) {
                star.update(moveSpeed, dx, dy, width, height);
                star.draw(ctx, width, height);
            }
            previousMouseX = mouseX;
            previousMouseY = mouseY;
            requestAnimationFrame(animate);
        }

        function onResize() {
            if (!canvas) return;
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
            stars.forEach(star => star.reset(width, height));
        }

        function onMouseMove(e: MouseEvent) {
            mouseX = e.clientX - width / 2;
            mouseY = e.clientY - height / 2;
        }
        function onTouchMove(e: TouchEvent) {
            // Allow native scrolling when INFO modal is open
            if (isInfoModalOpen) {
                return;
            }
            if (e.touches.length > 0) {
                mouseX = e.touches[0].clientX - width / 2;
                mouseY = e.touches[0].clientY - height / 2;
            }
            e.preventDefault();
        }

        window.addEventListener('resize', onResize);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchmove', onTouchMove, { passive: false });

        animate();

        return () => {
            running = false;
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchmove', onTouchMove);
        };
    }, [currentScreen, isInfoModalOpen]); // Update handler when modal state changes so scrolling works inside modal

    // Render the FlappyGame when playing
    if (currentScreen === 'playing') {
        return (
            <>
                <canvas ref={canvasRef} className="starfield-canvas" />
                <GameErrorBoundary componentName="Game Engine">
                    <FlappyGame
                        key={`${gameMode}-${continueFromScore}-${tournamentContinueUsed}`} // Force remount on continue
                        gameMode={gameMode}
                        onGameEnd={handleGameEnd}
                        continueFromScore={continueFromScore}
                    />
                </GameErrorBoundary>
                {/* Game Result Modal - render over the game */}
                {gameResult.show && (
                    <div className="game-result-modal-overlay">
                        <div className="game-result-modal">
                            <div className="modal-header">
                                <h2 className="modal-title">
                                    {gameResult.isNewHighScore ? " Champion!" : "Nice Try! 🎮"}
                                </h2>
                            </div>

                            <div className="modal-content">
                                <div className="score-display">
                                    <div className="score-item">
                                        <span className="score-label">Score:</span>
                                        <span className="score-value">{gameResult.score}</span>
                                    </div>
                                    <div className="score-item">
                                        <span className="score-label">⭐ Coins:</span>
                                        <span className="score-value">{gameResult.coins}</span>
                                    </div>
                                </div>

                                {gameResult.isNewHighScore && (
                                    <div className="new-high-score">
                                        🎉 NEW RECORD!
                                        <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '10px' }}>
                                            {gameResult.currentHigh || userHighestScore}
                                        </div>
                                        <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.9 }}>
                                            {(() => {
                                                const messages = ["Amazing! 🚀", "Incredible! ⭐", "Legendary! 🔥", "Fantastic! 💫", "Unstoppable! ⚡"];
                                                return messages[Math.floor(Math.random() * messages.length)];
                                            })()}
                                        </div>
                                    </div>
                                )}

                                {/* 🎯 Motivational messages when NOT new high score - encourage continue */}
                                {gameMode === 'tournament' && !gameResult.isNewHighScore && !tournamentContinueUsed && (
                                    <div className="current-high-info" style={{
                                        marginTop: '15px',
                                        padding: '12px',
                                        background: 'rgba(0, 245, 255, 0.1)',
                                        border: '1px solid rgba(0, 245, 255, 0.3)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        animation: 'fadeIn 0.3s ease-in'
                                    }}>
                                        <div style={{ fontSize: '13px', color: '#00F5FF', textAlign: 'center' }}>
                                            {[
                                                "So close! 💫",
                                                "You can beat it! 🚀",
                                                "Almost there! 🔥",
                                                "Don't give up! 💪",
                                                "You've got this! ⭐"
                                            ][Math.floor(Math.random() * 5)]}
                                        </div>
                                    </div>
                                )}

                                {/* Show best score after continue used */}
                                {gameMode === 'tournament' && !gameResult.isNewHighScore && tournamentContinueUsed && (
                                    <div className="current-high-info" style={{
                                        marginTop: '15px',
                                        padding: '12px',
                                        background: 'rgba(147, 51, 234, 0.1)',
                                        border: '1px solid rgba(147, 51, 234, 0.3)',
                                        borderRadius: '8px',
                                        fontSize: '14px',
                                        animation: 'fadeIn 0.3s ease-in'
                                    }}>
                                        <div style={{ fontSize: '13px', color: '#9333EA', textAlign: 'center' }}>
                                            {[
                                                "Keep improving! 💪",
                                                "Nice try! 🎯",
                                                "Good effort! 🚀",
                                                "Start fresh! 🔥",
                                                "Keep going! ⭐"
                                            ][Math.floor(Math.random() * 5)]}
                                        </div>
                                    </div>
                                )}

                                {gameResult.error && (
                                    <div className="error-message">
                                        ⚠️ {gameResult.error}
                                    </div>
                                )}

                                {/* Practice Mode coin info */}
                                {gameMode === 'practice' && (
                                    <div className="practice-info">
                                        💰 You have {getCoins()} coins
                                        <br />
                                        <small>Collect ⭐ stars to earn 1 coin each • Use 10 coins to continue</small>
                                    </div>
                                )}
                            </div>

                            <div className="modal-actions">
                                {/* Continue button for Practice Mode */}
                                {gameMode === 'practice' && canContinue() && (
                                    <button
                                        className="modal-button continue"
                                        onClick={() => {
                                            // Spend 10 coins to continue
                                            if (spendCoins(10)) {
                                                setContinueFromScore(gameResult.score);
                                                setGameResult({ show: false, score: 0, coins: 0, mode: '' });
                                                // Game will restart with the previous score
                                            } else {
                                                // Insufficient coins - show error in game result instead of alert
                                                setGameResult(prev => ({
                                                    ...prev,
                                                    error: 'Not enough coins to continue! You need 10 coins.'
                                                }));
                                            }
                                        }}
                                    >
                                        Continue (10 ⭐) - {getCoins()} coins available
                                    </button>
                                )}

                                {/* Continue button for Tournament Mode - one continue per game only */}
                                {gameMode === 'tournament' && !tournamentContinueUsed && (
                                    <button
                                        className="modal-button continue"
                                        disabled={isProcessingPayment}
                                        onClick={async () => {
                                            if (isProcessingPayment || !modalOpenRef.current) return; // Check ref, not state
                                            setIsProcessingPayment(true); // Disable navigation during payment
                                            await handleTournamentContinue(gameResult.score);
                                        }}
                                    >
                                        Continue ({tournamentEntryAmount * 0.5} WLD) - One continue per game
                                    </button>
                                )}

                                {/* Tournament Mode: Show message if continue already used */}
                                {gameMode === 'tournament' && tournamentContinueUsed && (
                                    <div className="tournament-continue-info">
                                        ✨ Ready for a fresh start! Play again to create a new entry.
                                    </div>
                                )}

                                {/* Play Again button - ONLY show when continue is NOT available */}
                                {(gameMode !== 'tournament' || tournamentContinueUsed) && (
                                    <button
                                        className="modal-button secondary"
                                        onClick={async () => {
                                            try {
                                                if (gameMode === 'tournament' && tournamentContinueUsed) {
                                                    // For tournament mode after continue used: redirect to new entry
                                                    setContinueFromScore(0);
                                                    setGameResult({ show: false, score: 0, coins: 0, mode: '' });
                                                    setTournamentContinueUsed(false); // Reset for new entry
                                                    setCurrentScreen('tournamentEntry');
                                                } else {
                                                    // Practice mode: Reset all game state and go back to mode selection
                                                    setContinueFromScore(0);
                                                    setGameResult({ show: false, score: 0, coins: 0, mode: '' });
                                                    setTournamentContinueUsed(false);
                                                    setGameMode(null); // Clear game mode so user must choose again
                                                    setCurrentScreen('gameSelect'); // Go back to mode selection
                                                }
                                            } catch (error) {
                                                console.error('❌ Play Again navigation error:', error);
                                                // Fallback navigation - always try to recover
                                                setCurrentScreen('gameSelect');
                                                setGameMode(null);
                                            }
                                        }}
                                    >
                                        Play Again
                                    </button>
                                )}                                <button
                                    className="modal-button primary"
                                    disabled={isProcessingPayment}
                                    style={{
                                        opacity: isProcessingPayment ? 0.5 : 1,
                                        cursor: isProcessingPayment ? 'not-allowed' : 'pointer'
                                    }}
                                    onClick={async () => {
                                        if (isProcessingPayment) return; // Prevent click during payment

                                        // Navigate FIRST to prevent showing crash screen
                                        setCurrentScreen('home');
                                        setGameMode(null);

                                        // Then close modal and cleanup
                                        modalOpenRef.current = false;
                                        setGameResult({ show: false, score: 0, coins: 0, mode: '' });

                                        try {
                                            // If tournament mode and continue not used, submit final score
                                            if (gameMode === 'tournament' && !tournamentContinueUsed) {
                                                await handleFinalGameOver(gameResult.score);
                                            }
                                            // Reset all game state
                                            setContinueFromScore(0); // Reset continue score
                                            setIsSubmittingScore(false); // Ensure submission state is cleared
                                        } catch (error) {
                                            console.error('❌ Go Home navigation error:', error);
                                        }
                                    }}
                                >
                                    Go Home
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .game-result-modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100vw;
                        height: 100vh;
                        background: rgba(0, 0, 0, 0.8);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10000;
                        backdrop-filter: blur(4px);
                    }

                    .game-result-modal {
                        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                        border-radius: 20px;
                        padding: 30px;
                        max-width: 400px;
                        width: 90%;
                        text-align: center;
                        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                        border: 2px solid #00bfff;
                        animation: modalSlideIn 0.3s ease-out;
                    }

                    @keyframes modalSlideIn {
                        from {
                            opacity: 0;
                            transform: scale(0.8) translateY(50px);
                        }
                        to {
                            opacity: 1;
                            transform: scale(1) translateY(0);
                        }
                    }

                    .modal-header {
                        margin-bottom: 25px;
                    }

                    .modal-title {
                        color: #00bfff;
                        font-size: 28px;
                        font-weight: bold;
                        margin: 0;
                        text-shadow: 0 0 20px rgba(0, 191, 255, 0.5);
                    }

                    .modal-content {
                        margin-bottom: 30px;
                    }

                    .score-display {
                        display: flex;
                        justify-content: space-around;
                        margin-bottom: 20px;
                    }

                    .score-item {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 5px;
                    }

                    .score-label {
                        color: #888;
                        font-size: 16px;
                    }

                    .score-value {
                        color: #fff;
                        font-size: 24px;
                        font-weight: bold;
                        text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
                    }

                    .new-high-score {
                        background: linear-gradient(135deg, #00F5FF, #9333EA);
                        color: white;
                        padding: 20px;
                        border-radius: 12px;
                        margin: 15px 0;
                        font-weight: bold;
                        text-align: center;
                        animation: celebrationGlow 1s ease-in-out infinite alternate;
                    }

                    @keyframes celebrationGlow {
                        from { box-shadow: 0 0 20px rgba(0, 245, 255, 0.5); }
                        to { box-shadow: 0 0 30px rgba(147, 51, 234, 0.8); }
                    }

                    .current-high-score {
                        color: #ffd700;
                        font-size: 16px;
                        margin: 10px 0;
                    }

                    .error-message {
                        color: #ff6b6b;
                        background: rgba(255, 107, 107, 0.1);
                        padding: 10px;
                        border-radius: 8px;
                        margin: 10px 0;
                        border: 1px solid rgba(255, 107, 107, 0.3);
                    }

                    .practice-info {
                        color: #ffd700;
                        background: rgba(255, 215, 0, 0.1);
                        padding: 10px;
                        border-radius: 8px;
                        margin: 10px 0;
                        border: 1px solid rgba(255, 215, 0, 0.3);
                        text-align: center;
                        font-size: 14px;
                    }

                    .practice-info small {
                        color: #cccccc;
                        font-size: 12px;
                    }

                    .tournament-continue-info {
                        color: #ff6b6b;
                        background: rgba(255, 107, 107, 0.1);
                        padding: 10px;
                        border-radius: 8px;
                        margin: 10px 0;
                        border: 1px solid rgba(255, 107, 107, 0.3);
                        text-align: center;
                        font-size: 14px;
                        font-weight: bold;
                    }

                    .modal-actions {
                        display: flex;
                        gap: 15px;
                        justify-content: center;
                    }

                    .modal-button {
                        padding: 12px 30px;
                        border: none;
                        border-radius: 10px;
                        font-size: 18px;
                        font-weight: bold;
                        cursor: pointer;
                        transition: all 0.2s;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }

                    .modal-button.primary {
                        background: linear-gradient(135deg, #00bfff, #0080ff);
                        color: white;
                        box-shadow: 0 4px 15px rgba(0, 191, 255, 0.3);
                    }

                    .modal-button.primary:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(0, 191, 255, 0.4);
                    }

                    .modal-button.continue {
                        background: linear-gradient(135deg, #00F5FF, #9333EA);
                        color: white;
                        box-shadow: 0 4px 15px rgba(0, 245, 255, 0.3);
                        font-size: 16px;
                        font-weight: 600;
                    }

                    .modal-button.continue:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(0, 245, 255, 0.5);
                    }

                    .modal-actions {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                        justify-content: center;
                        align-items: center;
                    }

                    @media (min-width: 480px) {
                        .modal-actions {
                            flex-direction: row;
                        }
                    }

                    .modal-button.secondary {
                        background: transparent;
                        color: #888;
                        border: 2px solid #444;
                    }

                    .modal-button.secondary:hover {
                        color: #fff;
                        border-color: #666;
                    }
                    `
                }} />
            </>
        );
    }

    // Render tournament entry screen
    if (currentScreen === 'tournamentEntry') {
        return (
            <Page>
                <canvas ref={canvasRef} className="starfield-canvas" />
                <TournamentEntryModal
                    onBack={handleTournamentEntryBack}
                    onEntrySelect={handleTournamentEntrySelect}
                    isAuthenticating={isAuthenticating}
                    isVerifiedToday={isVerifiedToday}
                    verificationLoading={verificationLoading}
                    isProcessingEntry={isProcessingEntry}
                    orbCapabilityLoading={orbCapabilityLoading}
                />
            </Page>
        );
    }

    if (currentScreen === 'home') {
        return (
            <>
                <Page>
                    <canvas ref={canvasRef} className="starfield-canvas" />
                    <Page.Main className="main-container">
                        {/* Info button positioned absolutely outside header section */}
                        <button
                            onClick={handleInfoClick}
                            className="info-btn"
                            aria-label="Game Info"
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                zIndex: 1000,
                                pointerEvents: 'auto'
                            }}
                        >
                            ?
                        </button>

                        <div className="header-section">
                            <h1 className="game-title">
                                <span className="ufo-icon">🛸</span>
                                <span className="flappy-text">Flappy</span>{''}
                                <span className="ufo-text">UFO</span>
                                <span className="ufo-icon">🛸</span>
                            </h1>
                        </div>
                        <div className="play-section">
                            <button
                                key={`play-btn-${currentScreen}`}
                                className="custom-play-btn"
                                onClick={handlePlayClick}
                                onTouchEnd={handlePlayClick}
                                aria-label="Tap to Play"
                                style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                            >
                                Tap To Play
                            </button>
                            <DevSignOut />
                        </div>
                        <div className="bottom-nav-container">
                            <div className="space-nav-icons">
                                <button
                                    className="space-nav-btn home-nav"
                                    onClick={() => {/* Already on home page - no action needed */ }}
                                    aria-label="Launch Pad"
                                >
                                    <div className="space-icon">🏠</div>

                                </button>
                                <button
                                    className="space-nav-btn prizes-nav"
                                    onClick={() => window.location.href = '/leaderboard'}
                                    aria-label="Leaderboard"
                                    style={{ touchAction: 'manipulation', cursor: 'pointer' }}
                                >
                                    <div className="space-icon">🏆</div>

                                </button>
                            </div>
                        </div>
                    </Page.Main>
                </Page>

                {/* Info Modal for home screen */}
                {isInfoModalOpen && (
                    <InfoModal
                        isOpen={isInfoModalOpen}
                        onClose={() => setIsInfoModalOpen(false)}
                    />
                )}

                {/* Grace Period Modal */}
                <GracePeriodModal
                    isOpen={isGracePeriodModalOpen}
                    onClose={() => setIsGracePeriodModalOpen(false)}
                    tournamentEndTime={gracePeriodEndTime}
                />
            </>
        );
    }

    return (
        <>
            <Page>
                <canvas ref={canvasRef} className="starfield-canvas" />
                <Page.Main className="game-select-screen">

                    <div className="epic-title-section">
                        <h1 className="epic-title">
                            <span className="choose-word">Choose Your</span>
                            <span className="destiny-word">Destiny</span>
                        </h1>
                        <p className="epic-subtitle">Navigate the cosmos • Claim your reward</p>
                    </div>

                    <div className="game-modes">

                        <div className="mode-card practice-mode">
                            <div className="cosmic-aura practice-aura"></div>
                            <div className="mode-content">
                                <div className="mode-icon">⚡</div>
                                <h2 className="mode-name">PRACTICE</h2>
                                <p className="mode-desc">Master the void</p>
                                <div className="mode-features">
                                    <span className="feature">🚀 Unlimited tries</span>
                                    <span className="feature">⭐ Perfect your skills</span>
                                </div>
                                <button
                                    className="mode-button practice-button"
                                    onClick={() => handleGameStart('practice')}
                                    disabled={isAuthenticating}
                                >
                                    {isAuthenticating ? 'AUTHENTICATING...' : 'ENTER TRAINING'}
                                </button>
                            </div>
                        </div>

                        <div className="mode-card tournament-mode">
                            <div className="cosmic-aura tournament-aura"></div>
                            <div className="mode-content">
                                <div className="mode-icon">💎</div>
                                <h2 className="mode-name">TOURNAMENT</h2>
                                <p className="mode-desc">Conquer for glory</p>
                                <div className="mode-features">
                                    <span className="feature">💰 Win WLD prizes</span>
                                    <span className="feature">🏆 Daily challenges</span>
                                </div>
                                <button
                                    className="mode-button tournament-button"
                                    onClick={() => handleGameStart('tournament')}
                                    disabled={isAuthenticating}
                                >
                                    {isAuthenticating ? 'AUTHENTICATING...' : 'JOIN BATTLE'}
                                </button>
                            </div>
                        </div>

                    </div>

                    <div className="bottom-nav-container">
                        <div className="space-nav-icons">
                            <button
                                className="space-nav-btn home-nav"
                                onClick={() => setCurrentScreen('home')}
                                aria-label="Launch Pad"
                            >
                                <div className="space-icon">🏠</div>

                            </button>
                            <button
                                className="space-nav-btn prizes-nav"
                                onClick={() => window.location.href = '/leaderboard'}
                                aria-label="Leaderboard"
                            >
                                <div className="space-icon">🏆</div>

                            </button>
                        </div>
                    </div>

                </Page.Main>
            </Page>

            {/* Game Result Modal */}
            {gameResult.show && (
                <div className="game-result-modal-overlay">
                    <div className="game-result-modal">
                        <div className="modal-header">
                            <h2 className="modal-title">{gameResult.mode} Complete!</h2>
                        </div>

                        <div className="modal-content">
                            <div className="score-display">
                                <div className="score-item">
                                    <span className="score-label">Score:</span>
                                    <span className="score-value">{gameResult.score}</span>
                                </div>
                                <div className="score-item">
                                    <span className="score-label">⭐ Coins:</span>
                                    <span className="score-value">{gameResult.coins}</span>
                                </div>
                            </div>

                            {gameResult.isNewHighScore && (
                                <div className="new-high-score">
                                    🎉 NEW RECORD!
                                    <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '10px' }}>
                                        {gameResult.currentHigh || userHighestScore}
                                    </div>
                                    <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.9 }}>
                                        {(() => {
                                            const messages = ["Amazing! 🚀", "Incredible! ⭐", "Legendary! 🔥", "Fantastic! 💫", "Unstoppable! ⚡"];
                                            return messages[Math.floor(Math.random() * messages.length)];
                                        })()}
                                    </div>
                                </div>
                            )}

                            {gameResult.error && (
                                <div className="error-message">
                                    ⚠️ {gameResult.error}
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button
                                className="modal-button primary"
                                onClick={() => {
                                    // Reset all game state
                                    setGameResult({ show: false, score: 0, coins: 0, mode: '' });
                                    setIsSubmittingScore(false); // Ensure submission state is cleared
                                    setCurrentScreen('home');
                                    setGameMode(null);
                                }}
                            >
                                Go Home
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .game-result-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(4px);
                }

                .game-result-modal {
                    background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
                    border: 2px solid #00BFFF;
                    border-radius: 12px;
                    padding: 30px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0, 191, 255, 0.3);
                }

                .modal-header {
                    margin-bottom: 20px;
                }

                .modal-title {
                    color: #00BFFF;
                    font-size: 24px;
                    font-weight: bold;
                    margin: 0;
                    text-shadow: 0 0 10px #00BFFF;
                }

                .modal-content {
                    margin-bottom: 30px;
                }

                .score-display {
                    display: flex;
                    justify-content: space-around;
                    margin-bottom: 20px;
                }

                .score-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .score-label {
                    color: #94A3B8;
                    font-size: 14px;
                    margin-bottom: 5px;
                }

                .score-value {
                    color: #FFFFFF;
                    font-size: 24px;
                    font-weight: bold;
                    text-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
                }

                .new-high-score {
                    background: linear-gradient(135deg, #00F5FF, #9333EA);
                    color: white;
                    padding: 20px;
                    border-radius: 12px;
                    margin: 15px 0;
                    font-weight: bold;
                    text-align: center;
                    animation: celebrationGlow 1s ease-in-out infinite alternate;
                }
                
                @keyframes celebrationGlow {
                    from { box-shadow: 0 0 20px rgba(0, 245, 255, 0.5); }
                    to { box-shadow: 0 0 30px rgba(147, 51, 234, 0.8); }
                }

                .current-high-score {
                    color: #FFD700;
                    font-size: 16px;
                    margin: 10px 0;
                }

                .error-message {
                    color: #EF4444;
                    font-size: 14px;
                    margin: 10px 0;
                    padding: 10px;
                    background: rgba(239, 68, 68, 0.1);
                    border-radius: 6px;
                    border: 1px solid rgba(239, 68, 68, 0.3);
                }

                .modal-actions {
                    display: flex;
                    justify-content: center;
                }

                .modal-button {
                    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                    color: white;
                    border: none;
                    padding: 12px 30px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                }

                .modal-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.6);
                }

                .modal-button:active {
                    transform: translateY(0);
                }

                /* Info Modal Styles */
                .info-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(11, 12, 16, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                    backdrop-filter: blur(8px);
                    animation: fadeIn 0.2s ease-out;
                }

                .info-modal {
                    background: linear-gradient(135deg, #1D4ED8 0%, #9333EA 100%);
                    border-radius: 16px;
                    padding: 0;
                    width: 90%;
                    max-width: 480px;
                    border: 2px solid #00F5FF;
                    box-shadow: 0 20px 40px rgba(0, 245, 255, 0.3);
                    animation: slideIn 0.3s ease-out;
                    overflow: hidden;
                }

                .info-modal-header {
                    background: rgba(11, 12, 16, 0.8);
                    padding: 20px 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #00F5FF;
                }

                .info-modal-title {
                    color: #00F5FF;
                    font-size: 24px;
                    font-weight: bold;
                    margin: 0;
                }

                .info-close-btn {
                    background: none;
                    border: none;
                    color: #E5E7EB;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    width: 40px;
                    height: 40px;
                }

                .info-close-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #00F5FF;
                    transform: rotate(90deg);
                }

                .info-modal-content {
                    padding: 24px;
                    background: rgba(11, 12, 16, 0.6);
                }

                .info-description {
                    color: #E5E7EB;
                    text-align: center;
                    margin: 0 0 24px 0;
                    font-size: 16px;
                    line-height: 1.5;
                }

                .info-links {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .info-link-btn {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px;
                    background: rgba(29, 78, 216, 0.2);
                    border: 1px solid rgba(0, 245, 255, 0.3);
                    border-radius: 12px;
                    text-decoration: none;
                    color: white;
                    transition: all 0.3s ease;
                    backdrop-filter: blur(4px);
                }

                .info-link-btn:hover {
                    background: rgba(0, 245, 255, 0.1);
                    border-color: #00F5FF;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 16px rgba(0, 245, 255, 0.2);
                }

                .info-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }

                .info-link-text {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .info-link-title {
                    font-weight: bold;
                    font-size: 16px;
                    color: #00F5FF;
                }

                .info-link-desc {
                    font-size: 14px;
                    color: #E5E7EB;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideIn {
                    from { 
                        opacity: 0;
                        transform: scale(0.9) translateY(-20px);
                    }
                    to { 
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                /* Mobile responsiveness for info modal */
                @media (max-width: 640px) {
                    .info-modal {
                        width: 95%;
                        margin: 20px;
                    }

                    .info-modal-header {
                        padding: 16px 20px;
                    }

                    .info-modal-title {
                        font-size: 20px;
                    }

                    .info-modal-content {
                        padding: 20px;
                    }

                    .info-link-btn {
                        padding: 14px;
                        gap: 12px;
                    }

                    .info-icon {
                        font-size: 20px;
                    }

                    .info-link-title {
                        font-size: 15px;
                    }

                    .info-link-desc {
                        font-size: 13px;
                    }
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.05); }
                }

                @keyframes shimmer {
                    0% { opacity: 0.5; }
                    50% { opacity: 1; }
                    100% { opacity: 0.5; }
                }
            ` }} />

            {/* Game Notification Modal */}
            <GameNotification
                isOpen={notification.show}
                type={notification.type}
                title={notification.title}
                message={notification.message}
                onClose={() => setNotification({ ...notification, show: false })}
            />
        </>
    );
}