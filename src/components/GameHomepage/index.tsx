"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import { useGameAuth } from '@/hooks/useGameAuth'; // ADD MISSING IMPORT
import { Page } from '@/components/PageLayout';
import { walletAuth } from '@/auth/wallet';
import dynamic from 'next/dynamic';
import { TournamentEntryModal } from '@/components/TournamentEntryModal';
import InfoModal from '@/components/INFO';
import { CACHE_TTL } from '@/utils/leaderboard-cache';
import { canContinue, spendCoins, getCoins, addCoins } from '@/utils/coins';

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
    const [currentScreen, setCurrentScreen] = useState<'home' | 'gameSelect' | 'tournamentEntry' | 'playing'>('home');
    const [gameMode, setGameMode] = useState<GameMode | null>(null);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    // Debug state changes
    useEffect(() => {
        console.log('Screen changed to:', currentScreen);
    }, [currentScreen]);

    useEffect(() => {
        console.log('Info modal state changed to:', isInfoModalOpen);
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
        console.log('🎮 GAME STARTUP: Beginning professional cache warming...');

        // 🚀 OPTIMIZATION: Check if cache is already warm to prevent redundant calls
        const isAlreadyWarming = sessionStorage.getItem('cache_warming_in_progress');
        if (isAlreadyWarming) {
            console.log('⚡ SKIP: Cache warming already in progress');
            return;
        }

        // Mark warming as in progress
        sessionStorage.setItem('cache_warming_in_progress', Date.now().toString());

        // Warm cache immediately when app loads for instant tournament access
        fetch('/api/warm-cache', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('🚀 CACHE PRE-WARMED: Tournament will load instantly!');
                    console.log(`⏱️ Warming took ${data.performance?.total_time_ms || 'unknown'}ms`);
                } else {
                    console.warn('⚠️ Cache warming had issues (non-critical)');
                }
            })
            .catch(err => {
                console.warn('⚠️ Cache warming failed (non-critical):', err);
            })
            .finally(() => {
                // Clear the warming flag after completion
                sessionStorage.removeItem('cache_warming_in_progress');
            });
    }, []); // Run once on app startup

    // Use useGameAuth for proper database operations
    const { authenticate: authenticateWithDB } = useGameAuth();

    // Local authentication function to replace useGameAuth hook
    const authenticate = useCallback(async (): Promise<boolean> => {
        console.log('🔄 IMPORTANT: Running authentication WITH database operations');

        if (session?.user?.walletAddress) {
            console.log('✅ Already authenticated, triggering database operations...');
            // Still run database operations even if already authenticated
            return await authenticateWithDB();
        }

        setIsAuthenticating(true);
        try {
            const result = await walletAuth();
            if (result && !result.error) {
                // Authentication successful - now trigger database operations
                console.log('✅ MiniKit auth successful, now triggering database operations...');
                setIsAuthenticating(false);
                return await authenticateWithDB();
            } else {
                console.error('Sign in failed:', result?.error);
                setIsAuthenticating(false);
                return false;
            }
        } catch (error) {
            console.error('Authentication failed:', error);
            setIsAuthenticating(false);
            return false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authenticateWithDB]); // 🚀 FIX: Include authenticateWithDB in deps

    // Verification status state
    // Verification state - managed properly with World App session per Plan.md
    const [isVerifiedToday, setIsVerifiedToday] = useState<boolean>(false);
    const [verificationLoading, setVerificationLoading] = useState<boolean>(false);
    const [orbCapabilityLoading, setOrbCapabilityLoading] = useState<boolean>(false);
    const [canUseOrbVerification, setCanUseOrbVerification] = useState<boolean>(true); // Default to true for new users

    // Tournament entry loading states to prevent duplicate operations
    const [isProcessingEntry, setIsProcessingEntry] = useState<boolean>(false);

    // Practice mode continue functionality
    const [continueFromScore, setContinueFromScore] = useState<number>(0);

    // Tournament mode continue tracking
    const [tournamentContinueUsed, setTournamentContinueUsed] = useState<boolean>(false);
    const [tournamentEntryAmount, setTournamentEntryAmount] = useState<number>(1.0); // Track entry amount for continue payment

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
                console.log('✅ Verification status:', data.data);
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
    const checkOrbVerificationCapability = useCallback(async () => {
        if (!session?.user?.walletAddress) return false;

        try {
            setOrbCapabilityLoading(true);

            const response = await fetch('/api/users/orb-verification-capability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: session.user.walletAddress,
                }),
            });

            const data = await response.json();

            if (data.success) {
                console.log('🔮 Orb capability check:', data.data);
                setCanUseOrbVerification(data.data.canUseOrbDiscount);
                return data.data.canUseOrbDiscount;
            } else {
                console.error('❌ Failed to check Orb capability:', data.error);
                setCanUseOrbVerification(true); // Default to allowing verification attempts
                return true;
            }
        } catch (error) {
            console.error('❌ Error checking Orb capability:', error);
            setCanUseOrbVerification(true); // Default to allowing verification attempts
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
                            console.log('✅ Fresh pre-loaded data already exists - skipping duplicate pre-load');
                            return;
                        }
                    } catch {
                        // Corrupted cache, proceed with fresh load
                    }
                }

                console.log('🚀 Pre-loading leaderboard data in background for instant access...');
                const startTime = Date.now();

                // Pre-load both tournament info and leaderboard data
                const [tournamentResponse, leaderboardResponse] = await Promise.all([
                    fetch('/api/tournament/current'),
                    fetch('/api/tournament/leaderboard-data')
                ]);

                const preloadTime = Date.now() - startTime;

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

                    console.log(`✅ Leaderboard pre-loaded successfully in ${preloadTime}ms - leaderboard will now load instantly!`);
                } else {
                    console.log('⚠️ Leaderboard pre-load failed, will use regular loading');
                }
            } catch (error) {
                console.log('⚠️ Leaderboard pre-load failed silently:', error);
                // Silent failure - regular loading will work as fallback
            }
        };

        // 🚀 AGGRESSIVE PRE-LOADING: Start immediately when homepage loads 
        // Zero delay so cache is ready before user can even click leaderboard
        console.log('🚀 Starting IMMEDIATE leaderboard pre-load (zero delay for fastest experience)...');
        console.log('⏰ Pre-load started at:', new Date().toISOString());
        preloadLeaderboard().then(() => {
            console.log('✅ Pre-loading completed at:', new Date().toISOString());
        }).catch((error) => {
            console.error('❌ Pre-loading failed:', error);
        });
    }, []); // Only run once when component mounts    // Check if tournament is still active before allowing payments
    const checkTournamentActive = useCallback(async () => {
        try {
            const response = await fetch('/api/tournament/current');
            const data = await response.json();

            if (data.tournament && data.status) {
                // Use the new API response structure
                if (data.status.has_ended) {
                    alert('❌ Tournament has ended! You can no longer participate.');
                    return false;
                }

                if (data.status.has_not_started) {
                    alert('❌ Tournament has not started yet! Please wait.');
                    return false;
                }

                if (!data.status.entries_allowed) {
                    alert('❌ Tournament entries are not allowed at this time.');
                    return false;
                }

                return true;
            } else {
                alert('❌ No active tournament found!');
                return false;
            }
        } catch (error) {
            console.error('Error checking tournament status:', error);
            alert('❌ Failed to check tournament status. Please try again.');
            return false;
        }
    }, []);

    // Stable event handlers to prevent recreation and caching issues
    const handleInfoClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Info button clicked - opening modal');
        setIsInfoModalOpen(true);
    }, []);

    const handlePlayClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Play button clicked - going to game select');
        setCurrentScreen('gameSelect');
    }, []);

    // Handle game start with authentication
    const handleGameStart = async (mode: GameMode) => {
        try {
            // Reset all game-related state when starting a new game
            setGameResult({ show: false, score: 0, coins: 0, mode: '' });
            setIsSubmittingScore(false);
            setContinueFromScore(0);
            setTournamentContinueUsed(false); // Reset continue state for new game

            // Always attempt authentication to ensure session is valid
            const authSuccess = await authenticate();

            if (authSuccess) {
                // Authentication successful
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
                                alert(`⏰ Tournament has not started yet. Starts in ${minutesUntilStart} minutes!`);
                            } else if (data.status.has_ended) {
                                alert('❌ Tournament has ended. Please wait for the next tournament.');
                            } else if (data.status.is_grace_period) {
                                alert('⏳ Tournament is in grace period - no new entries allowed. Existing players can still play!');
                            } else {
                                alert('❌ Tournament entries are not allowed at this time.');
                            }
                            return;
                        }

                        // Tournament entries allowed, go to tournament entry screen
                        setCurrentScreen('tournamentEntry');
                    } catch (error) {
                        console.error('Error checking tournament status:', error);
                        alert('Unable to check tournament status. Please try again.');
                        return;
                    }
                }
            } else {
                // Authentication failed
                console.error('Failed to authenticate user');
                alert('Authentication required to play. Please try again.');
            }
        } catch (error) {
            console.error('Error during game start:', error);
            alert('Something went wrong. Please try again.');
        }
    };

    // Handle tournament entry selection
    const handleTournamentEntrySelect = async (entryType: 'verify' | 'standard' | 'verified') => {
        // Prevent duplicate operations
        if (isProcessingEntry) {
            console.log('⚠️ Tournament entry operation already in progress, ignoring...');
            return;
        }

        // Check if tournament is still active BEFORE payment
        const tournamentActive = await checkTournamentActive();
        if (!tournamentActive) {
            return; // Stop here if tournament ended
        }

        try {
            setIsProcessingEntry(true);

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
            alert('Tournament entry failed. Please try again.');
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

            console.log('World ID verification result:', result.finalPayload);

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
                console.log('✅ World ID verification successful');
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
                alert('Orb verification is required for the discounted entry. Please use an Orb to verify your World ID, or choose Standard Entry (1.0 WLD).');
            } else if (errorMessage.includes('MaxVerificationsReached')) {
                alert('You have already verified the maximum number of times for this tournament. Please try again in the next tournament.');
            } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
                alert('Network error during verification. Please check your connection and try again, or use Standard Entry.');
            } else {
                alert('World ID verification failed. Please try again or use Standard Entry (1.0 WLD).');
            }
        }
    };

    // Update user verification status in database
    const updateUserVerificationStatus = async (nullifierHash: string, verificationLevel?: string) => {
        try {
            if (!session?.user?.walletAddress) {
                throw new Error('No wallet address found in session');
            }

            console.log('🔄 Updating verification status for wallet:', session.user.walletAddress);

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

            console.log('📝 Update verification response:', responseData);

            if (!response.ok) {
                console.error('❌ Verification update failed:', responseData);
                throw new Error(responseData.error || `HTTP ${response.status}: Failed to update verification status`);
            }

            console.log('✅ User verification status updated:', responseData.data);

            // Refresh verification status after successful update
            await checkVerificationStatus();

            return responseData;
        } catch (error) {
            console.error('❌ Error updating verification status:', error);

            // More specific error message
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            alert(`Verification failed to save to database: ${errorMessage}. Please try again.`);

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

            console.log('✅ Tournament entry created:', responseData.data);
            return responseData.data;

        } catch (error) {
            console.error('❌ Error creating tournament entry:', error);

            // More specific error message
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            alert(`Payment successful but failed to register tournament entry.\n\nError: ${errorMessage}\n\nPlease contact support at flappyufo.help@gmail.com if this persists.`);
            throw error;
        }
    };

    // Handle payment
    const handlePayment = async (amount: number, isVerified: boolean) => {
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
                console.log('✅ Payment successful:', result.finalPayload);

                try {
                    // Create tournament entry after successful payment
                    await createTournamentEntry(result.finalPayload.reference, amount, isVerified);

                    // Track entry amount and reset continue status for new game
                    setTournamentEntryAmount(amount);
                    setTournamentContinueUsed(false);

                    // Start the game directly (only if entry creation succeeds)
                    setGameMode('tournament');
                    setCurrentScreen('playing');
                } catch (entryError) {
                    // Payment succeeded but entry creation failed
                    // Don't throw error here to avoid double alert
                    console.error('❌ Tournament entry creation failed after successful payment:', entryError);
                    // The error message is already shown in createTournamentEntry function
                    return;
                }
            } else {
                throw new Error('Payment failed or was cancelled');
            }
        } catch (error) {
            console.error('❌ Payment error:', error);
            alert('Payment failed. Please try again.');
        }
    };

    // Handle tournament continue payment
    const handleTournamentContinue = async (score: number) => {
        // Check if tournament is still active BEFORE payment
        const tournamentActive = await checkTournamentActive();
        if (!tournamentActive) {
            return; // Stop here if tournament ended
        }

        try {
            const { MiniKit, Tokens, tokenToDecimals } = await import('@worldcoin/minikit-js');

            // Get payment reference from backend for continue payment
            const res = await fetch('/api/initiate-payment', {
                method: 'POST',
            });
            const { id } = await res.json();

            // Make continue payment using the same amount as entry fee
            const result = await MiniKit.commandsAsync.pay({
                reference: id,
                to: process.env.NEXT_PUBLIC_ADMIN_WALLET || '',
                tokens: [
                    {
                        symbol: Tokens.WLD,
                        token_amount: tokenToDecimals(tournamentEntryAmount, Tokens.WLD).toString(),
                    },
                ],
                description: `Flappy UFO Tournament Continue (${tournamentEntryAmount} WLD)`,
            });

            if (result.finalPayload.status === 'success') {
                // Record continue payment in database (only continue-specific columns)
                try {
                    const continueResponse = await fetch('/api/tournament/continue', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            continue_amount: tournamentEntryAmount
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

            } else {
                throw new Error('Continue payment failed or was cancelled');
            }
        } catch {
            // Handle continue payment errors silently or with user-friendly message
        }
    };

    // Handle when user chooses NOT to continue (final game over)
    const handleFinalGameOver = async (score: number) => {
        // CRITICAL: Prevent duplicate submissions and race conditions
        if (gameMode !== 'tournament' || !session?.user?.walletAddress || isSubmittingScore) {
            console.log('⚠️ Skipping score submission:', { gameMode, hasWallet: !!session?.user?.walletAddress, isSubmitting: isSubmittingScore });
            return;
        }

        setIsSubmittingScore(true);

        try {
            console.log('🎯 Starting final score submission:', { score, wallet: session.user.walletAddress });

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

            if (!response.ok) {
                throw new Error(`Score submission failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('✅ Score submission result:', result);

            // CRITICAL: Only update state if component is still mounted and in tournament mode
            if (gameMode === 'tournament' && !isSubmittingScore) {
                console.log('⚠️ Component state changed during submission, skipping result update');
                return;
            }

            // Update modal with high score info
            if (result.success && !result.data.is_duplicate && result.data.is_new_high_score) {
                setGameResult(prev => ({
                    ...prev,
                    isNewHighScore: result.data.is_new_high_score,
                    previousHigh: result.data.previous_highest_score,
                    currentHigh: result.data.current_highest_score
                }));

                // 🚀 SMART CACHE: Only clear cache on NEW HIGH SCORES (matches server logic)
                console.log('🏆 NEW HIGH SCORE! - invalidating leaderboard cache for immediate update');
                const envPrefix = process.env.NODE_ENV === 'production' ? 'prod_' : 'dev_';
                try {
                    sessionStorage.removeItem(`${envPrefix}preloaded_leaderboard`);
                    sessionStorage.removeItem(`${envPrefix}preloaded_tournament`);
                } catch (cacheError) {
                    console.warn('Cache clear failed:', cacheError);
                }
            } else if (result.success) {
                // 🚀 PERFORMANCE: Keep cache for regular scores - no leaderboard position change
                console.log('📊 Regular score submitted - keeping cache for faster navigation');
            } else if (!result.success) {
                console.error('Score submission failed:', result.error);
                setGameResult(prev => ({
                    ...prev,
                    error: result.error || 'Score submission failed'
                }));
            }
        } catch (error) {
            console.error('❌ Final score submission failed:', error);
            // Only update state if still in valid state
            if (gameMode === 'tournament') {
                setGameResult(prev => ({
                    ...prev,
                    error: 'Unable to submit final score. Please check your connection.'
                }));
            }
        } finally {
            // Always clear submission state
            setIsSubmittingScore(false);
        }
    };

    // Handle going back from tournament entry screen
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

        // Reset continue score since the game has ended
        setContinueFromScore(0);

        // ALWAYS show the modal immediately for fast response
        setGameResult({
            show: true,
            score,
            coins,
            mode: modeText
        });

        // For tournament mode, only submit score if continue was already used (meaning this is the final game end)
        if (gameMode === 'tournament' && session?.user?.walletAddress) {
            // If continue was used, this is the final score - submit it
            // If continue wasn't used, this is the first crash - DON'T submit yet (user might continue)
            const shouldSubmitScore = tournamentContinueUsed;

            if (shouldSubmitScore) {
                setIsSubmittingScore(true);

                try {
                    const response = await fetch('/api/score/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            wallet: session.user.walletAddress,
                            score: score,
                            game_duration: Math.max(score * 2000, 5000),
                            used_continue: true,
                            continue_amount: tournamentEntryAmount
                        }),
                    });

                    const result = await response.json();

                    // Update modal with high score info if it's a new high score
                    if (result.success && !result.data.is_duplicate && result.data.is_new_high_score) {
                        setGameResult(prev => ({
                            ...prev,
                            isNewHighScore: result.data.is_new_high_score,
                            previousHigh: result.data.previous_highest_score,
                            currentHigh: result.data.current_highest_score
                        }));

                        // 🚀 CACHE INVALIDATION: Clear pre-loaded leaderboard data after new high score
                        // This ensures users see updated rankings immediately when they check the leaderboard
                        console.log('🗑️ New high score achieved - invalidating leaderboard cache for fresh data');
                        const envPrefix = process.env.NODE_ENV === 'production' ? 'prod_' : 'dev_';
                        sessionStorage.removeItem(`${envPrefix}preloaded_leaderboard`);
                        sessionStorage.removeItem(`${envPrefix}preloaded_tournament`);
                    } else if (result.data?.is_duplicate) {
                        setGameResult(prev => ({
                            ...prev,
                            error: 'Score already submitted'
                        }));
                    } else if (!result.success) {
                        setGameResult(prev => ({
                            ...prev,
                            error: `Score submission failed: ${result.error}`
                        }));
                    }
                } catch {
                    setGameResult(prev => ({
                        ...prev,
                        error: 'Unable to submit score. Please check your connection.'
                    }));
                } finally {
                    setIsSubmittingScore(false);
                }
            }
            // If continue not used yet, don't submit score - wait for user decision
        }
        // Practice mode - update coins immediately  
        else if (gameMode === 'practice') {
            addCoins(coins);
        }
    };

    useEffect(() => {
        // Only run stars animation on home screen and related screens
        if (currentScreen === 'playing') return;

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
        const moveSpeed = 4;
        let running = true;

        function animate() {
            if (!running || !ctx) return;
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
            const dx = mouseX - previousMouseX;
            const dy = mouseY - previousMouseY;
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
                <FlappyGame
                    key={`${gameMode}-${continueFromScore}-${tournamentContinueUsed}`} // Force remount on continue
                    gameMode={gameMode}
                    onGameEnd={handleGameEnd}
                    continueFromScore={continueFromScore}
                />
                {/* Game Result Modal - render over the game */}
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
                                        🎉 NEW HIGH SCORE!
                                        <br />
                                        Previous: {gameResult.previousHigh}
                                    </div>
                                )}

                                {!gameResult.isNewHighScore && gameResult.currentHigh !== undefined && (
                                    <div className="current-high-score">
                                        Your highest score: {gameResult.currentHigh}
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
                                        <small>Collect ⭐ stars to earn 2 coins each • Use 10 coins to continue</small>
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
                                        onClick={() => handleTournamentContinue(gameResult.score)}
                                    >
                                        Continue ({tournamentEntryAmount} WLD) - One continue per game
                                    </button>
                                )}

                                {/* Tournament Mode: Show message if continue already used */}
                                {gameMode === 'tournament' && tournamentContinueUsed && (
                                    <div className="tournament-continue-info">
                                        ❌ Continue already used. Create new entry to play again.
                                    </div>
                                )}

                                {/* Play Again button */}
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
                                            } else if (gameMode === 'tournament' && !tournamentContinueUsed) {
                                                // For tournament mode first crash: submit final score without continue
                                                console.log('🎯 Submitting final score before play again...');
                                                await handleFinalGameOver(gameResult.score);
                                                // Reset all game state and go back to mode selection
                                                setContinueFromScore(0);
                                                setGameResult({ show: false, score: 0, coins: 0, mode: '' });
                                                setTournamentContinueUsed(false);
                                                setGameMode(null); // Clear game mode so user must choose again
                                                setCurrentScreen('gameSelect'); // Go back to mode selection
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
                                    {gameMode === 'tournament' && tournamentContinueUsed ? 'New Entry' : 'Play Again'}
                                </button>

                                <button
                                    className="modal-button primary"
                                    onClick={async () => {
                                        try {
                                            // If tournament mode and continue not used, submit final score
                                            if (gameMode === 'tournament' && !tournamentContinueUsed) {
                                                console.log('🎯 Submitting final score before going home...');
                                                await handleFinalGameOver(gameResult.score);
                                            }
                                            // Reset all game state
                                            setContinueFromScore(0); // Reset continue score
                                            setGameResult({ show: false, score: 0, coins: 0, mode: '' });
                                            setIsSubmittingScore(false); // Ensure submission state is cleared
                                            setCurrentScreen('home');
                                            setGameMode(null);
                                        } catch (error) {
                                            console.error('❌ Go Home navigation error:', error);
                                            // Fallback navigation - always try to recover
                                            setCurrentScreen('home');
                                            setGameMode(null);
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
                        background: linear-gradient(135deg, #ff6b35, #f7931e);
                        color: white;
                        padding: 15px;
                        border-radius: 10px;
                        margin: 15px 0;
                        font-weight: bold;
                        animation: celebrationGlow 1s ease-in-out infinite alternate;
                    }

                    @keyframes celebrationGlow {
                        from { box-shadow: 0 0 20px rgba(255, 107, 53, 0.5); }
                        to { box-shadow: 0 0 30px rgba(255, 107, 53, 0.8); }
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
                        background: linear-gradient(135deg, #ffd700, #ffb347);
                        color: #000;
                        box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
                        font-size: 16px;
                    }

                    .modal-button.continue:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 20px rgba(255, 215, 0, 0.4);
                        background: linear-gradient(135deg, #ffed4a, #ffc82c);
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
                    canUseOrbVerification={canUseOrbVerification}
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
                                aria-label="Tap to Play"
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
                                    🎉 NEW HIGH SCORE!
                                    <br />
                                    Previous: {gameResult.previousHigh}
                                </div>
                            )}

                            {!gameResult.isNewHighScore && gameResult.currentHigh !== undefined && (
                                <div className="current-high-score">
                                    Your highest score: {gameResult.currentHigh}
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
                    color: #10B981;
                    font-size: 18px;
                    font-weight: bold;
                    margin: 15px 0;
                    text-shadow: 0 0 10px #10B981;
                    animation: pulse 2s ease-in-out infinite;
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
            ` }} />
        </>
    );
}