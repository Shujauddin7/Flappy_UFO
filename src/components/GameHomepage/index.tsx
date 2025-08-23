"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Page } from '@/components/PageLayout';
import { useGameAuth } from '@/hooks/useGameAuth';
import dynamic from 'next/dynamic';
import { TournamentEntryModal } from '@/components/TournamentEntryModal';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';

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
            checkVerificationStatus();
        } else {
            setIsVerifiedToday(false);
        }
    }, [session?.user?.walletAddress, checkVerificationStatus]);

    // Handle game start with authentication
    const handleGameStart = async (mode: GameMode) => {
        try {
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
        try {
            console.log(`Selected tournament entry type: ${entryType}`);

            if (entryType === 'verify') {
                // Handle World ID verification first
                await handleWorldIDVerification();
            } else if (entryType === 'verified') {
                // User is already verified, proceed with 0.9 WLD entry
                await handleVerifiedEntry();
            } else {
                // Standard entry - proceed directly to payment
                await handleStandardEntry();
            }

        } catch (error) {
            console.error('Error during tournament entry:', error);
            alert('Tournament entry failed. Please try again.');
        }
    };

    // Handle World ID verification for verified entry
    const handleWorldIDVerification = async () => {
        try {
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
                // Proceed with 0.9 WLD entry
                await handleVerifiedEntry();
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

            if (!response.ok) {
                throw new Error(responseData.error || 'Failed to update verification status');
            }

            console.log('✅ User verification status updated:', responseData.data);

            // Refresh verification status after successful update
            await checkVerificationStatus();

            return responseData;
        } catch (error) {
            console.error('❌ Error updating verification status:', error);
            alert('Warning: Verification successful but failed to save to database. You may need to verify again.');
            return null;
        }
    };

    // Handle verified entry (0.9 WLD)
    const handleVerifiedEntry = async () => {
        // TODO: Implement payment processing for 0.9 WLD
        console.log('Processing verified entry payment: 0.9 WLD');

        // For now, just start the tournament game
        setGameMode('tournament');
        setCurrentScreen('playing');
    };

    // Handle standard entry (1.0 WLD)
    const handleStandardEntry = async () => {
        // TODO: Implement payment processing for 1.0 WLD
        console.log('Processing standard entry payment: 1.0 WLD');

        // For now, just start the tournament game
        setGameMode('tournament');
        setCurrentScreen('playing');
    };

    // Handle going back from tournament entry screen
    const handleTournamentEntryBack = () => {
        setCurrentScreen('gameSelect');
    };

    // Handle game end
    const handleGameEnd = (score: number, coins: number) => {
        // Show results based on game mode
        const modeText = gameMode === 'practice' ? 'Practice' : 'Tournament';
        alert(`${modeText} Complete!\nScore: ${score}\nCoins: ${coins}`);

        // Return to game select
        setCurrentScreen('gameSelect');
        setGameMode(null);
    };

    useEffect(() => {
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
    }, []);

    // Render the FlappyGame when playing
    if (currentScreen === 'playing') {
        return <FlappyGame gameMode={gameMode} onGameEnd={handleGameEnd} />;
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
    );
}
