"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { Page } from '@/components/PageLayout';
import { TournamentLeaderboard } from '@/components/TournamentLeaderboard';
import { PlayerRankCard } from '@/components/PlayerRankCard';
import { useSession } from 'next-auth/react';

interface Star {
    x: number;
    y: number;
    z: number;
    size: number;
    reset(width: number, height: number): void;
    update(moveSpeed: number, deltaMouseX: number, deltaMouseY: number, width: number, height: number): void;
    draw(ctx: CanvasRenderingContext2D, width: number, height: number): void;
}

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

interface TournamentData {
    id: string;
    tournament_day: string;
    is_active: boolean;
    total_players: number;
    total_prize_pool: number;
    total_collected: number;
    admin_fee: number;
    guarantee_amount?: number;
    admin_net_result?: number;
    start_time: string;
    end_time: string;
}

interface PrizePoolData {
    prize_pool: {
        base_amount: number;
        guarantee_amount: number;
        final_amount: number;
    };
    guarantee_applied: boolean;
    admin_net_result: number;
}

export default function LeaderboardPage() {
    const { data: session } = useSession();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currentTournament, setCurrentTournament] = useState<TournamentData | null>(null);
    const [prizePoolData, setPrizePoolData] = useState<PrizePoolData | null>(null);
    const [currentUserRank, setCurrentUserRank] = useState<LeaderboardPlayer | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [shouldShowFixedCard, setShouldShowFixedCard] = useState(false);
    const [showPrizeBreakdown, setShowPrizeBreakdown] = useState(false); // Hidden by default

    const handleUserRankUpdate = useCallback((userRank: LeaderboardPlayer | null) => {
        setCurrentUserRank(userRank);
        // We'll handle visibility based on scroll position, not rank number
    }, []);

    const handleUserCardVisibility = useCallback((isVisible: boolean) => {
        // Show fixed card only when user's actual card is NOT visible in viewport
        setShouldShowFixedCard(!isVisible && currentUserRank !== null);
    }, [currentUserRank]); const calculatePrizeForRank = useCallback((rank: number, totalPrizePool: number): string | null => {
        if (rank > 10) return null;

        // Plan.md compliant prize percentages
        const prizePercentages = [40, 22, 14, 6, 5, 4, 3, 2, 2, 2];
        const percentage = prizePercentages[rank - 1] || 0;
        const prizeAmount = (totalPrizePool * percentage) / 100;

        return prizeAmount.toFixed(2);
    }, []);

    useEffect(() => {
        const fetchCurrentTournament = async () => {
            try {
                setLoading(true);
                setError(null);

                // Add a minimum loading time but keep it very short
                const loadingPromise = new Promise(resolve => setTimeout(resolve, 300));

                const [tournamentResponse, prizeResponse] = await Promise.all([
                    fetch('/api/tournament/current', {
                        cache: 'force-cache',
                        next: { revalidate: 60 } // Cache for 1 minute
                    }),
                    fetch('/api/tournament/dynamic-prizes', {
                        cache: 'force-cache',
                        next: { revalidate: 60 } // Cache for 1 minute
                    }),
                    loadingPromise // Minimum loading time
                ]);

                const tournamentData = await tournamentResponse.json();
                const prizeData = await prizeResponse.json();

                if (!tournamentResponse.ok) {
                    console.error('Error fetching tournament:', tournamentData.error);
                    setError(tournamentData.error || 'Failed to load tournament data');
                    return;
                }

                setCurrentTournament(tournamentData.tournament);

                if (prizeResponse.ok) {
                    setPrizePoolData(prizeData);
                }

                setError(null);
            } catch (err) {
                console.error('Failed to fetch tournament:', err);
                setError('Failed to load tournament data');
            } finally {
                setLoading(false);
            }
        };

        // Fetch tournament data on mount
        fetchCurrentTournament();

        // Update time every second for live countdown
        const timeInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => {
            clearInterval(timeInterval);
        };
    }, []); // Empty dependency array - run only once on mount

    // Star particles animation
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

    // Calculate time remaining
    const getTimeRemaining = () => {
        if (!currentTournament) return null;

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

    if (loading) {
        return (
            <Page>
                <canvas ref={canvasRef} className="starfield-canvas" />
                <Page.Main className="main-container">
                    <div className="header-section">
                        <div className="epic-title-section">
                            <h1 className="epic-title">🏆 LEADERBOARD</h1>
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <div className="loading-text">Loading tournament...</div>
                            </div>
                        </div>
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

    if (error || !currentTournament) {
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
            <canvas ref={canvasRef} className="starfield-canvas" />
            
            {/* Fixed Tournament Title at Top */}
            <div className="fixed-tournament-title">
                <h1>🏆 TOURNAMENT</h1>
            </div>

            <Page.Main className="leaderboard-container-fixed">
                {/* Tournament Info Box - will scroll up naturally */}
                <div className="tournament-info-box">
                        {/* Timer Box */}
                        {timeRemaining && (
                            <div className="countdown-timer">
                                ⚡ Tournament ends in {timeRemaining.timeLeft}
                            </div>
                        )}

                        {/* Prize Pool Info */}
                        <div className="prize-pool-info">
                            <div className="prize-pool-text">
                                Prize pool: {prizePoolData?.prize_pool?.base_amount?.toFixed(2) || currentTournament.total_prize_pool.toFixed(2)} WLD
                            </div>
                            <div className="players-text">
                                {currentTournament.total_players} humans are playing to win the prize pool
                            </div>
                        </div>

                        {/* Prize Info */}
                        <div className="prize-info-box">
                            <span className="prize-info-text">
                                When the game ends, the prize will be shared to the top winners
                            </span>
                            <button
                                className="prize-arrow-btn"
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

                {/* Sticky Column Header - becomes sticky when it hits the top */}
                <div className="sticky-columns-header">
                    <div className="column-header rank-column">Rank</div>
                    <div className="column-header human-column">Human</div>
                    <div className="column-header score-column">Score</div>
                    <div className="column-header prize-column">Prize</div>
                </div>

                <div className="leaderboard-section">
                    <TournamentLeaderboard
                        tournamentId={currentTournament.id}
                        currentUserId={session?.user?.walletAddress || null}
                        currentUsername={session?.user?.username || null}
                        isGracePeriod={timeRemaining?.status === 'grace'}
                        totalPrizePool={prizePoolData?.prize_pool?.base_amount || currentTournament.total_prize_pool}
                        onUserRankUpdate={handleUserRankUpdate}
                        onUserCardVisibility={handleUserCardVisibility}
                    />
                </div>

                {/* Fixed user rank card when scrolled past user's position */}
                {shouldShowFixedCard && currentUserRank && (
                    <div className="fixed-user-position-container" style={{
                        position: 'sticky',
                        bottom: '20px',
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        padding: '10px',
                        marginTop: '10px',
                        borderRadius: '10px',
                        border: '2px solid #00F5FF',
                        zIndex: 1000,
                        width: '100%',
                        maxWidth: '600px',
                        margin: '10px auto 0 auto'
                    }}>
                        <PlayerRankCard
                            player={currentUserRank}
                            prizeAmount={calculatePrizeForRank(currentUserRank.rank || 1001, prizePoolData?.prize_pool?.base_amount || currentTournament.total_prize_pool)}
                            isCurrentUser={true}
                            isTopThree={currentUserRank.rank !== undefined && currentUserRank.rank <= 10}
                        />
                    </div>
                )}

                {/* Navigation buttons */}
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
            </Page.Main>
        </Page>
    );
}