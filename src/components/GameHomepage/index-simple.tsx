"use client";

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Page } from '@/components/PageLayout';

import { AuthButton } from '@/components/AuthButton';
import dynamic from 'next/dynamic';




// Dynamically import FlappyGame to avoid SSR issues
const FlappyGame = dynamic(() => import('@/components/FlappyGame'), {
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
    const { data: session, status } = useSession();

    const [currentScreen, setCurrentScreen] = useState<'home' | 'gameSelect' | 'playing'>('home');
    const [gameMode, setGameMode] = useState<GameMode | null>(null);
    const [showTournamentModal, setShowTournamentModal] = useState(false);
    const [showSignInModal, setShowSignInModal] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Handle tap to play - go directly to mode selection screen (no sign-in yet)
    const handleTapToPlay = () => {
        setCurrentScreen('gameSelect');
    };

    // Handle game start - both modes require sign-in first
    const handleGameStart = (mode: GameMode) => {
        if (status === 'loading') return;

        // Simple session check - just like the original World template
        if (session?.user?.walletAddress) {
            // User is already signed in, start the game
            if (mode === 'tournament') {
                setShowTournamentModal(true);
            } else {
                setGameMode(mode);
                setCurrentScreen('playing');
            }
        } else {
            // User not signed in - show sign-in modal
            setGameMode(mode); // Remember which mode they want
            setShowSignInModal(true);
        }
    };

   

    // Handle tournament entry selection from modal
    const handleTournamentEntry = (entryType: 'verified' | 'standard') => {
        setShowTournamentModal(false);
        setGameMode('tournament');
        setCurrentScreen('playing');
        console.log(`Selected entry type: ${entryType}`);
    };

    // Handle modal close
    const handleModalClose = () => {
        setShowTournamentModal(false);
        setShowSignInModal(false);
    };

    // Handle game end
    const handleGameEnd = (score: number, coins: number) => {
        const modeText = gameMode === 'practice' ? 'Practice' : 'Tournament';
        alert(`${modeText} Complete!\\nScore: ${score}\\nCoins: ${coins}`);
        setCurrentScreen('gameSelect');
        setGameMode(null);
    };

    // Animated background effect
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
                const x = this.x / (this.z * 0.001) + width / 2;
                const y = this.y / (this.z * 0.001) + height / 2;
                const d = this.size * width / this.z * 0.001;
                ctx.beginPath();
                ctx.arc(x, y, d, 0, 2 * Math.PI);
                const opacity = (1 - this.z / width) * 0.5;
                ctx.fillStyle = `rgba(0, 245, 255, ${opacity})`;
                ctx.fill();
            }
        }

        const stars: Star[] = [];
        for (let i = 0; i < 100; i++) {
            stars.push(new StarImpl(width, height));
        }

        let mouseX = 0;
        let mouseY = 0;
        let targetMouseX = 0;
        let targetMouseY = 0;

        const handleMouseMove = (e: MouseEvent) => {
            targetMouseX = e.clientX - width / 2;
            targetMouseY = e.clientY - height / 2;
        };

        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('resize', handleResize);

        const animate = () => {
            mouseX += (targetMouseX - mouseX) * 0.05;
            mouseY += (targetMouseY - mouseY) * 0.05;

            const deltaMouseX = targetMouseX - mouseX;
            const deltaMouseY = targetMouseY - mouseY;

            ctx.fillStyle = '#0B0C10';
            ctx.fillRect(0, 0, width, height);

            stars.forEach(star => {
                star.update(2, deltaMouseX, deltaMouseY, width, height);
                star.draw(ctx, width, height);
            });

            requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return (
        <Page className="min-h-screen bg-[#0B0C10] text-white relative overflow-hidden">
            {/* Animated space background */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ zIndex: 0 }}
            />

            
            {/* Main content */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4">
                {currentScreen === 'home' && (
                    <div className="text-center space-y-8 max-w-md mx-auto">
                        {/* Title */}
                        <div className="space-y-4">
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#00F5FF] to-[#9333EA] bg-clip-text text-transparent">
                                🛸 Flappy UFO
                            </h1>
                            <p className="text-lg text-[#E5E7EB]">
                                Navigate through space obstacles and win WLD tournaments!
                            </p>
                        </div>

                        {/* Tap to Play Button */}
                        <button
                            onClick={handleTapToPlay}
                            className="w-full px-8 py-4 bg-gradient-to-r from-[#1D4ED8] to-[#9333EA] hover:from-[#00F5FF] hover:to-[#EC4899] text-white font-bold rounded-xl text-xl transition-all duration-300 transform hover:scale-105"
                        >
                            🚀 Tap to Play
                        </button>

                        {/* Bottom Navigation */}
                        <div className="flex justify-center space-x-8 pt-8">
                            <button className="text-[#00F5FF] hover:text-white transition-colors">
                                🏠 Home
                            </button>
                            <button className="text-[#E5E7EB] hover:text-white transition-colors">
                                🏆 Leaderboard
                            </button>
                        </div>
                    </div>
                )}

                {currentScreen === 'gameSelect' && (
                    <div className="text-center space-y-8 max-w-md mx-auto">
                        <h2 className="text-3xl font-bold text-[#00F5FF]">
                            Choose Game Mode
                        </h2>

                        <div className="space-y-4">
                            {/* Practice Mode Button */}
                            <button
                                onClick={() => handleGameStart('practice')}
                                disabled={status === 'loading'}
                                className="w-full px-6 py-4 bg-gradient-to-r from-[#374151] to-[#1F2937] hover:from-[#4B5563] hover:to-[#374151] text-white font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="text-left">
                                    <div className="text-lg">🆓 Practice Mode</div>
                                    <div className="text-sm text-[#E5E7EB] mt-1">
                                        Free play • Collect coins • No prizes
                                    </div>
                                </div>
                            </button>

                            {/* Tournament Mode Button */}
                            <button
                                onClick={() => handleGameStart('tournament')}
                                disabled={status === 'loading'}
                                className="w-full px-6 py-4 bg-gradient-to-r from-[#FFD700] to-[#FF8C00] hover:from-[#FFA500] hover:to-[#FF6347] text-black font-semibold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="text-left">
                                    <div className="text-lg">🏆 Tournament Mode</div>
                                    <div className="text-sm text-gray-800 mt-1">
                                        Win WLD prizes • Daily tournaments
                                    </div>
                                </div>
                            </button>
                        </div>

                        {/* Back Button */}
                        <button
                            onClick={() => setCurrentScreen('home')}
                            className="text-[#E5E7EB] hover:text-white transition-colors"
                        >
                            ← Back to Home
                        </button>
                    </div>
                )}


            {/* Sign-in Modal */}
            {showSignInModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1F2937] rounded-xl p-6 max-w-sm w-full text-center space-y-4">
                        <h3 className="text-xl font-bold text-[#00F5FF]">Sign In Required</h3>
                        <p className="text-[#E5E7EB]">
                            You need to sign in with your World App wallet to play {gameMode} mode.
                        </p>

                        {/* Use the AuthButton which has built-in session restoration */}
                        <div className="space-y-3">
                            <AuthButton />
                        </div>

                        <button
                            onClick={handleModalClose}
                            className="text-[#E5E7EB] hover:text-white transition-colors text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Tournament Entry Modal */}
            {showTournamentModal && (
                <TournamentEntryModal
                    onSelectEntry={handleTournamentEntry}
                    onClose={handleModalClose}
                />
            )}
        </Page>
    );
}
