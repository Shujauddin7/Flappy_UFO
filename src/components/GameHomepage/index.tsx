"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Page } from '@/components/PageLayout';
import { useGameAuth } from '@/hooks/useGameAuth';
import dynamic from 'next/dynamic';
import { TournamentEntryModal } from '@/components/TournamentEntryModal';
import { canContinue, spendCoins, getCoins } from '@/utils/coins';

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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { isAuthenticating, authenticate } = useGameAuth();

    // Import useSession to get user wallet
    const { data: session } = useSession();

    // Verification status state
    const [isVerifiedToday, setIsVerifiedToday] = useState<boolean>(false);
    const [verificationLoading, setVerificationLoading] = useState<boolean>(false);

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
    }, [session?.user?.walletAddress]);

    // Check verification status when user session changes
    useEffect(() => {
        if (session?.user?.walletAddress) {
            // Check if user just signed out - if so, force fresh verification check
            const justSignedOut = localStorage.getItem('justSignedOut');
            if (justSignedOut) {
                localStorage.removeItem('justSignedOut');
                console.log('🔄 User just signed out and back in - forcing fresh verification check');
                setIsVerifiedToday(false); // Reset to force verification
            }
            checkVerificationStatus();
        } else {
            setIsVerifiedToday(false);
        }
    }, [session?.user?.walletAddress, checkVerificationStatus]);

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
                    // For tournament mode, go to tournament entry screen
                    setCurrentScreen('tournamentEntry');
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
                await updateUserVerificationStatus(verificationData.nullifier_hash);
                // Proceed with 0.9 WLD payment
                await handlePayment(0.9, true);
            } else {
                throw new Error(verificationData.error || 'Verification failed');
            }

        } catch (error) {
            console.error('World ID verification error:', error);
            alert('World ID verification failed. Please try again or use Standard Entry.');
        }
    };

    // Update user verification status in database
    const updateUserVerificationStatus = async (nullifierHash: string) => {
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
            alert(`Payment successful but failed to register tournament entry.\n\nError: ${errorMessage}\n\nPlease contact support if this persists.`);
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
        if (gameMode === 'tournament' && session?.user?.walletAddress && !isSubmittingScore) {
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

                const result = await response.json();

                // Update modal with high score info
                if (result.success && !result.data.is_duplicate && result.data.is_new_high_score) {
                    setGameResult(prev => ({
                        ...prev,
                        isNewHighScore: result.data.is_new_high_score,
                        previousHigh: result.data.previous_highest_score,
                        currentHigh: result.data.current_highest_score
                    }));
                }
            } catch (error) {
                console.error('Final score submission failed:', error);
                setGameResult(prev => ({
                    ...prev,
                    error: 'Unable to submit final score. Please check your connection.'
                }));
            } finally {
                setIsSubmittingScore(false);
            }
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
            spendCoins(-coins);
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
    }, [currentScreen]); // Add currentScreen as dependency to restart animation when returning to home

    // Render the FlappyGame when playing
    if (currentScreen === 'playing') {
        return (
            <>
                <FlappyGame
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
                                        if (gameMode === 'tournament' && tournamentContinueUsed) {
                                            // For tournament mode after continue used: redirect to new entry
                                            setContinueFromScore(0);
                                            setGameResult({ show: false, score: 0, coins: 0, mode: '' });
                                            setTournamentContinueUsed(false); // Reset for new entry
                                            setCurrentScreen('tournamentEntry');
                                        } else if (gameMode === 'tournament' && !tournamentContinueUsed) {
                                            // For tournament mode first crash: submit final score without continue
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
                                    }}
                                >
                                    {gameMode === 'tournament' && tournamentContinueUsed ? 'New Entry' : 'Play Again'}
                                </button>

                                <button
                                    className="modal-button primary"
                                    onClick={async () => {
                                        // If tournament mode and continue not used, submit final score
                                        if (gameMode === 'tournament' && !tournamentContinueUsed) {
                                            await handleFinalGameOver(gameResult.score);
                                        }
                                        // Reset all game state
                                        setContinueFromScore(0); // Reset continue score
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
                />
            </Page>
        );
    }

    if (currentScreen === 'home') {
        return (
            <Page>
                <canvas ref={canvasRef} className="starfield-canvas" />
                <Page.Main className="main-container">
                    <div className="header-section">
                        <h1 className="game-title">
                            <span className="ufo-icon">🛸</span>
                            <span className="flappy-text">Flappy</span>{''}
                            <span className="ufo-text">UFO</span>
                            <span className="ufo-icon">🛸</span>
                        </h1>
                        <button
                            className="info-btn"
                            onClick={() => alert('Game Rules:\n• Tap to navigate your UFO\n• Avoid obstacles\n• Win WLD tournaments!')}
                            aria-label="Game Info"
                        >
                            ℹ️
                        </button>
                    </div>
                    <div className="play-section">
                        <button
                            className="custom-play-btn"
                            onClick={() => setCurrentScreen('gameSelect')}
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
                                onClick={() => alert('Launch Pad - Home Base')}
                                aria-label="Launch Pad"
                            >
                                <div className="space-icon">🏠</div>

                            </button>
                            <button
                                className="space-nav-btn prizes-nav"
                                onClick={() => alert('Galactic Leaderboard & Cosmic Prizes')}
                                aria-label="Cosmic Prizes"
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
                                onClick={() => alert('Galactic Leaderboard & Cosmic Prizes')}
                                aria-label="Cosmic Prizes"
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

                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.05); }
                }
            ` }} />
        </>
    );
}