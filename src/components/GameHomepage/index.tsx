"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Page } from '@/components/PageLayout';
import { useGameAuth } from '@/hooks/useGameAuth';
import dynamic from 'next/dynamic';
import { TournamentEntryModal } from '@/components/TournamentEntryModal';

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
    const { data: session } = useSession();

    // Verification status state
    const [isVerifiedToday, setIsVerifiedToday] = useState<boolean>(false);
    const [verificationLoading, setVerificationLoading] = useState<boolean>(false);
    const [isProcessingEntry, setIsProcessingEntry] = useState<boolean>(false);
    const [isSubmittingScore, setIsSubmittingScore] = useState<boolean>(false);

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
            const justSignedOut = localStorage.getItem('justSignedOut');
            if (justSignedOut) {
                localStorage.removeItem('justSignedOut');
                console.log('🔄 User just signed out and back in - forcing fresh verification check');
                setIsVerifiedToday(false);
            }
            checkVerificationStatus();
        } else {
            setIsVerifiedToday(false);
        }
    }, [session?.user?.walletAddress, checkVerificationStatus]);

    // Handle game start with authentication
    const handleGameStart = async (mode: GameMode) => {
        try {
            const authSuccess = await authenticate();
            if (authSuccess) {
                if (mode === 'practice') {
                    setGameMode(mode);
                    setCurrentScreen('playing');
                } else {
                    setCurrentScreen('tournamentEntry');
                }
            } else {
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
        if (isProcessingEntry) {
            console.log('⚠️ Tournament entry operation already in progress, ignoring...');
            return;
        }

        try {
            setIsProcessingEntry(true);

            if (entryType === 'verify') {
                await handleWorldIDVerification();
            } else if (entryType === 'verified') {
                await handlePayment(0.9, true);
            } else {
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

            const result = await MiniKit.commandsAsync.verify({
                action: 'flappy-ufo',
                verification_level: VerificationLevel.Orb,
            });

            console.log('World ID verification result:', result.finalPayload);

            const response = await fetch('/api/verify-proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: result.finalPayload,
                    action: 'flappy-ufo',
                }),
            });

            const verificationData = await response.json();

            if (verificationData.success) {
                console.log('✅ World ID verification successful');
                await updateUserVerificationStatus(verificationData.nullifier_hash);
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
                    wallet: session.user.walletAddress,
                }),
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ User verification status updated successfully');
                setIsVerifiedToday(true);
            } else {
                console.error('❌ Failed to update verification status:', data.error);
                throw new Error(`Failed to save verification: ${data.error}`);
            }
        } catch (error) {
            console.error('❌ Error updating verification status:', error);
            throw error;
        }
    };

    // Create tournament entry record
    const createTournamentEntry = async (paymentReference: string, amount: number, isVerified: boolean) => {
        try {
            if (!session?.user?.walletAddress) {
                throw new Error('No wallet address found in session');
            }

            console.log('🎯 Creating tournament entry:', {
                wallet: session.user.walletAddress,
                paymentReference,
                amount,
                isVerified,
            });

            const response = await fetch('/api/tournament/entry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallet: session.user.walletAddress,
                    payment_reference: paymentReference,
                    amount_paid: amount,
                    entry_date: new Date().toISOString(),
                    verified_entry: isVerified,
                }),
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Tournament entry created successfully:', data.data);
            } else {
                console.error('❌ Failed to create tournament entry:', data.error);
                alert(`Failed to register tournament entry: ${data.error}`);
                throw new Error(`Tournament entry failed: ${data.error}`);
            }
        } catch (error) {
            console.error('❌ Error creating tournament entry:', error);
            throw error;
        }
    };

    // Handle payment processing
    const handlePayment = async (amount: number, isVerified: boolean) => {
        try {
            const { MiniKit, Tokens, tokenToDecimals } = await import('@worldcoin/minikit-js');

            const id = `flappy-ufo-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

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
                    await createTournamentEntry(result.finalPayload.reference, amount, isVerified);
                    setGameMode('tournament');
                    setCurrentScreen('playing');
                } catch (entryError) {
                    console.error('❌ Tournament entry creation failed after successful payment:', entryError);
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

    // Handle going back from tournament entry screen
    const handleTournamentEntryBack = () => {
        setCurrentScreen('gameSelect');
    };

    // Handle game end - SIMPLIFIED (no modal, just submit score)
    const handleGameEnd = async (score: number, coins: number) => {
        if (isSubmittingScore) {
            console.log('⚠️ Score submission already in progress, ignoring...');
            return;
        }

        console.log('🎮 Game ended:', { score, coins, mode: gameMode });

        // Always transition back to home screen first
        setCurrentScreen('home');
        setGameMode(null);

        // If tournament mode, submit score to backend
        if (gameMode === 'tournament' && session?.user?.walletAddress) {
            try {
                setIsSubmittingScore(true);
                console.log('Submitting tournament score:', { score, coins });

                const response = await fetch('/api/score/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet: session.user.walletAddress,
                        score: score,
                        game_duration: Math.max(score * 2000, 5000)
                    }),
                });

                const result = await response.json();

                if (result.success && !result.data.is_duplicate) {
                    console.log('✅ Score submitted successfully:', result.data);
                } else if (result.data?.is_duplicate) {
                    console.log('⚠️ Duplicate submission ignored');
                } else {
                    console.error('❌ Failed to submit score:', result.error);
                }
            } catch (error) {
                console.error('❌ Error submitting score:', error);
            } finally {
                setIsSubmittingScore(false);
            }
        }
    };

    // Starfield effect useEffect
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        let running = true;
        const stars: Star[] = [];
        let mouseX = 0;
        let mouseY = 0;
        let previousMouseX = 0;
        let previousMouseY = 0;
        const moveSpeed = 0.5;

        class StarClass implements Star {
            x: number = 0;
            y: number = 0;
            z: number = 0;
            size: number = 0;

            reset(width: number, height: number) {
                this.x = Math.random() * width - width / 2;
                this.y = Math.random() * height - height / 2;
                this.z = Math.random() * 1000 + 1;
                this.size = Math.random() * 2 + 0.5;
            }

            update(moveSpeed: number, deltaMouseX: number, deltaMouseY: number, width: number, height: number) {
                this.z -= moveSpeed;
                this.x += deltaMouseX * 0.01;
                this.y += deltaMouseY * 0.01;

                if (this.z <= 0) {
                    this.reset(width, height);
                }
            }

            draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
                const x = (this.x / this.z) * width + width / 2;
                const y = (this.y / this.z) * height + height / 2;
                const size = (1 - this.z / 1000) * this.size;

                if (x >= 0 && x <= width && y >= 0 && y <= height && size > 0) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${1 - this.z / 1000})`;
                    ctx.fillRect(x, y, size, size);
                }
            }
        }

        for (let i = 0; i < 800; i++) {
            const star = new StarClass();
            star.reset(width, height);
            stars.push(star);
        }

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
    }, []);

    // Render screens
    if (currentScreen === 'playing') {
        return <FlappyGame gameMode={gameMode} onGameEnd={handleGameEnd} />;
    }

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

    if (currentScreen === 'gameSelect') {
        return (
            <Page>
                <canvas ref={canvasRef} className="starfield-canvas" />
                <Page.Main className="main-container">
                    <div className="header-section">
                        <h1 className="game-title">
                            <span className="ufo-icon">🛸</span>
                            <span className="flappy-text">Flappy</span>
                            <span className="ufo-text">UFO</span>
                            <span className="ufo-icon">🛸</span>
                        </h1>
                        <button
                            className="back-btn"
                            onClick={() => setCurrentScreen('home')}
                            aria-label="Back to Home"
                        >
                            ← Back
                        </button>
                    </div>
                    <div className="play-section">
                        <div className="mode-selection">
                            <div className="mode-card practice-mode">
                                <div className="mode-header">
                                    <h2 className="mode-name">PRACTICE</h2>
                                    <p className="mode-desc">Hone your skills</p>
                                </div>
                                <div className="mode-features">
                                    <span className="feature">🆓 Free to play</span>
                                    <span className="feature">⭐ Collect coins</span>
                                    <span className="feature">🎯 Perfect your technique</span>
                                </div>
                                <button
                                    className="mode-button practice-button"
                                    onClick={() => handleGameStart('practice')}
                                    disabled={isAuthenticating}
                                >
                                    START PRACTICE
                                </button>
                            </div>

                            <div className="mode-card tournament-mode">
                                <div className="mode-header">
                                    <h2 className="mode-name">TOURNAMENT</h2>
                                    <p className="mode-desc">Compete for prizes</p>
                                </div>
                                <div className="mode-features">
                                    <span className="feature">🏆 Win WLD prizes</span>
                                    <span className="feature">💎 Entry fee required</span>
                                    <span className="feature">🌟 Global leaderboard</span>
                                </div>
                                <button
                                    className="mode-button tournament-button"
                                    onClick={() => handleGameStart('tournament')}
                                    disabled={isAuthenticating}
                                >
                                    {isAuthenticating ? 'AUTHENTICATING...' : 'JOIN TOURNAMENT'}
                                </button>
                            </div>
                        </div>
                    </div>
                </Page.Main>
            </Page>
        );
    }

    // Default: Home screen
    return (
        <Page>
            <canvas ref={canvasRef} className="starfield-canvas" />
            <Page.Main className="main-container">
                <div className="header-section">
                    <h1 className="game-title">
                        <span className="ufo-icon">🛸</span>
                        <span className="flappy-text">Flappy</span>
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
