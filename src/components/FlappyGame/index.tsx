"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Page } from '@/components/PageLayout';
import { addCoins, getCoins } from '@/utils/coins';

interface GameObject {
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'planet' | 'coin' | 'trigger' | 'invisible-wall';
    planetType?: string;
    scored?: boolean;
    moveSpeed?: number;
    moveDirection?: number;
    baseY?: number;
}

interface UFO {
    x: number;
    y: number;
    velocity: number;
    rotation: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
}

interface GameState {
    ufo: UFO;
    obstacles: GameObject[];
    particles: Particle[];
    score: number;
    coins: number;
    gameStatus: 'ready' | 'playing' | 'gameOver';
    gameEndCalled?: boolean; // Prevent multiple game end calls
}

const PLANETS = [
    'Earth.jpg', 'Jupiter.jpg', 'Mercury.jpg',
    'Neptune.jpg', 'Saturn.jpg', 'Uranus.jpg', 'Venus.jpg'
];

interface FlappyGameProps {
    gameMode: 'practice' | 'tournament' | null;
    onGameEnd: (score: number, coins: number) => void;
    continueFromScore?: number; // For practice mode continue functionality
}

export default function FlappyGame({
    gameMode,
    onGameEnd,
    continueFromScore = 0
}: FlappyGameProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameStateRef = useRef<GameState>({
        ufo: { x: 100, y: 300, velocity: 0, rotation: 0 },
        obstacles: [],
        particles: [],
        score: 0,
        coins: 0,
        gameStatus: 'ready',
        gameEndCalled: false // Initialize flag
    });

    const [, setGameState] = useState(gameStateRef.current);
    const gameLoopRef = useRef<number | undefined>(undefined);
    const planetImagesRef = useRef<{ [key: string]: HTMLImageElement }>({});
    const lastTimeRef = useRef<number>(0); // For deltaTime calculation

    // Reset game state when component mounts
    useEffect(() => {
        // Initialize coins based on mode
        const initialCoins = gameMode === 'practice' ? getCoins() : 0;

        gameStateRef.current = {
            ufo: { x: 100, y: 300, velocity: 0, rotation: 0 },
            obstacles: [],
            particles: [],
            score: continueFromScore, // Start from previous score if continuing
            coins: initialCoins, // Load saved coins for practice mode
            gameStatus: 'ready',
            gameEndCalled: false
        };

        // Reset deltaTime calculation
        lastTimeRef.current = 0;

        setGameState({ ...gameStateRef.current });
    }, [gameMode, continueFromScore]);

    // Load planet images
    useEffect(() => {
        PLANETS.forEach(planet => {
            const img = new Image();
            img.src = `/${planet}`;
            planetImagesRef.current[planet] = img;
        });
    }, []);

    // Create simple space obstacles - back to basics
    const createObstacles = useCallback((x: number, currentScore: number) => {
        const obstacles: GameObject[] = [];
        const canvas = canvasRef.current;
        if (!canvas) return obstacles;

        const canvasHeight = canvas.height;

        // Progressive difficulty with more randomization
        let gapSize = 280 + Math.random() * 40 - 20; // Random variation: 260-300
        if (currentScore > 3) gapSize = 250 + Math.random() * 30 - 15; // 235-265  
        if (currentScore > 8) gapSize = 220 + Math.random() * 20 - 10; // 210-230
        if (currentScore > 15) gapSize = 200 + Math.random() * 20 - 10; // 190-210
        if (currentScore > 25) gapSize = 180 + Math.random() * 20 - 10; // 170-190

        // More randomized gap position
        const minGapY = 80 + Math.random() * 40; // 80-120
        const maxGapY = canvasHeight - gapSize - 80 - Math.random() * 40; // More varied
        const gapY = minGapY + Math.random() * (maxGapY - minGapY);

        // Randomize pipe width and position slightly for more variation
        const pipeWidth = 70 + Math.random() * 20; // 70-90px wide
        const pipeX = x + Math.random() * 20 - 10; // Slight X variation

        // Create invisible collision walls (the actual pipes)
        // Top invisible wall
        obstacles.push({
            x: pipeX,
            y: 0,
            width: pipeWidth,
            height: gapY - 5, // Small gap from planet
            type: 'invisible-wall'
        });

        // Bottom invisible wall  
        obstacles.push({
            x: pipeX,
            y: gapY + gapSize + 5, // Small gap from planet
            width: pipeWidth,
            height: canvasHeight - (gapY + gapSize + 5),
            type: 'invisible-wall'
        });

        // Place planets at BOTH ENDS of the invisible pipes (always 2 planets)
        const topPlanet = PLANETS[Math.floor(Math.random() * PLANETS.length)];
        const bottomPlanet = PLANETS[Math.floor(Math.random() * PLANETS.length)];

        const topPlanetSize = 60 + Math.random() * 20; // 60-80px for consistency
        const bottomPlanetSize = 60 + Math.random() * 20; // 60-80px for consistency

        // Top planet (at the end of top pipe) - ensure it's always visible
        const topPlanetY = Math.max(20, gapY - topPlanetSize - 15);
        const shouldTopMove = Math.random() > 0.8; // 20% chance to move (less chaotic)
        obstacles.push({
            x: pipeX + pipeWidth / 2 - topPlanetSize / 2,
            y: topPlanetY,
            width: topPlanetSize,
            height: topPlanetSize,
            type: 'planet',
            planetType: topPlanet,
            moveSpeed: shouldTopMove ? 0.4 + Math.random() * 0.4 : 0, // 0.4-0.8 slower movement
            moveDirection: shouldTopMove ? (Math.random() > 0.5 ? 1 : -1) : 0,
            baseY: topPlanetY
        });

        // Bottom planet (at the end of bottom pipe) - ensure it's always visible  
        const bottomPlanetY = Math.min(canvasHeight - bottomPlanetSize - 20, gapY + gapSize + 15);
        const shouldBottomMove = Math.random() > 0.8; // 20% chance to move (less chaotic)
        obstacles.push({
            x: pipeX + pipeWidth / 2 - bottomPlanetSize / 2,
            y: bottomPlanetY,
            width: bottomPlanetSize,
            height: bottomPlanetSize,
            type: 'planet',
            planetType: bottomPlanet,
            moveSpeed: shouldBottomMove ? 0.4 + Math.random() * 0.4 : 0, // 0.4-0.8 slower movement
            moveDirection: shouldBottomMove ? (Math.random() > 0.5 ? 1 : -1) : 0,
            baseY: bottomPlanetY
        });

        // Randomly add 1-2 floating decoration planets (not blocking path)
        const decorationPlanets = Math.random() > 0.5 ? 1 : (Math.random() > 0.7 ? 2 : 0);
        for (let i = 0; i < decorationPlanets; i++) {
            const decorPlanet = PLANETS[Math.floor(Math.random() * PLANETS.length)];
            const decorSize = 40 + Math.random() * 30; // Smaller decoration planets

            // Place far from the main path
            const decorX = pipeX + (Math.random() > 0.5 ? 150 + Math.random() * 100 : -150 - Math.random() * 100);
            const decorY = Math.random() * (canvasHeight - decorSize);

            const shouldDecorMove = Math.random() > 0.5; // 50% chance to move
            obstacles.push({
                x: decorX,
                y: decorY,
                width: decorSize,
                height: decorSize,
                type: 'planet',
                planetType: decorPlanet,
                moveSpeed: shouldDecorMove ? 0.2 + Math.random() * 0.5 : 0,
                moveDirection: shouldDecorMove ? (Math.random() > 0.5 ? 1 : -1) : 0,
                baseY: decorY
            });
        }

        // Coin in the gap for bonus (sometimes)
        if (Math.random() > 0.3) { // 70% chance, more generous
            obstacles.push({
                x: pipeX + pipeWidth / 2 - 12,
                y: gapY + gapSize / 2 - 12,
                width: 24,
                height: 24,
                type: 'coin'
            });
        }

        // Scoring trigger (invisible)
        obstacles.push({
            x: pipeX + pipeWidth / 2,
            y: 0,
            width: 2,
            height: canvasHeight,
            type: 'trigger',
            scored: false
        });

        return obstacles;
    }, []);

    // Create particles for effects
    const createParticles = useCallback((x: number, y: number, count: number) => {
        const particles: Particle[] = [];
        for (let i = 0; i < count; i++) {
            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 40,
                maxLife: 40,
                size: 2 + Math.random() * 3
            });
        }
        return particles;
    }, []);

    // UFO controls
    const handleJump = useCallback(() => {
        if (gameStateRef.current.gameStatus === 'ready') {
            gameStateRef.current.gameStatus = 'playing';
            lastTimeRef.current = 0; // Reset deltaTime when starting
        }
        if (gameStateRef.current.gameStatus === 'playing') {
            gameStateRef.current.ufo.velocity = -8; // Balanced jump strength (frame-rate independent)
            gameStateRef.current.ufo.rotation = -20; // Visual feedback

            // Jump particles
            const jumpParticles = createParticles(
                gameStateRef.current.ufo.x - 5,
                gameStateRef.current.ufo.y + 15,
                4
            );
            gameStateRef.current.particles.push(...jumpParticles);
        }
    }, [createParticles]);    // Collision detection - fair and forgiving
    const checkCollisions = useCallback(() => {
        const { ufo, obstacles } = gameStateRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return false;

        // Ground and ceiling collision (adjusted for larger UFO)
        if (ufo.y <= 30 || ufo.y >= canvas.height - 80) {
            return true;
        }

        // Check collisions with different obstacle types
        for (const obstacle of obstacles) {
            if (obstacle.type === 'coin') {
                // Coin collection (adjusted for larger UFO)
                if (ufo.x + 15 < obstacle.x + obstacle.width &&
                    ufo.x + 45 > obstacle.x &&
                    ufo.y + 15 < obstacle.y + obstacle.height &&
                    ufo.y + 35 > obstacle.y) {

                    // Practice Mode: 2 coins per star, save to localStorage
                    // Tournament Mode: 1 coin per star, not saved
                    const coinsToAdd = gameMode === 'practice' ? 2 : 1;
                    gameStateRef.current.coins += coinsToAdd;

                    // For Practice Mode, also save to localStorage
                    if (gameMode === 'practice') {
                        addCoins(coinsToAdd);
                    }

                    const coinParticles = createParticles(obstacle.x, obstacle.y, 6);
                    gameStateRef.current.particles.push(...coinParticles);

                    // Remove collected coin
                    const index = gameStateRef.current.obstacles.indexOf(obstacle);
                    gameStateRef.current.obstacles.splice(index, 1);
                }
            } else if (obstacle.type === 'planet') {
                // Planet collision - generous UFO hitbox (adjusted for larger UFO)
                const distance = Math.sqrt(
                    Math.pow((ufo.x + 30) - (obstacle.x + obstacle.width / 2), 2) +
                    Math.pow((ufo.y + 25) - (obstacle.y + obstacle.height / 2), 2)
                );

                if (distance < (obstacle.width / 2 + 20)) { // Generous collision radius
                    return true; // Collision with planet
                }
            } else if (obstacle.type === 'invisible-wall') {
                // Invisible wall collision - adjusted for larger UFO
                if (ufo.x + 20 < obstacle.x + obstacle.width &&
                    ufo.x + 40 > obstacle.x &&
                    ufo.y + 20 < obstacle.y + obstacle.height &&
                    ufo.y + 30 > obstacle.y) {

                    return true; // Collision with invisible barrier
                }
            }
        }

        return false;
    }, [createParticles, gameMode]);    // Main game loop
    const gameLoop = useCallback((currentTime: number = 0) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        // Calculate deltaTime for frame-rate independent movement
        const deltaTime = lastTimeRef.current === 0 ? 16.67 : currentTime - lastTimeRef.current; // Default to ~60fps on first frame
        lastTimeRef.current = currentTime;

        // Target 60fps as baseline (16.67ms per frame)
        const timeMultiplier = deltaTime / 16.67;

        const state = gameStateRef.current;

        if (state.gameStatus === 'playing') {
            // UFO physics - balanced and smooth (now frame-rate independent)
            state.ufo.velocity += 0.5 * timeMultiplier; // Gentle gravity - keep constant
            state.ufo.y += state.ufo.velocity * timeMultiplier;

            // Rotation based on velocity
            state.ufo.rotation = Math.max(-30, Math.min(30, state.ufo.velocity * 2));

            // Move obstacles at consistent speed (now frame-rate independent)
            state.obstacles = state.obstacles.filter(obstacle => {
                obstacle.x -= 4.5 * timeMultiplier; // Faster speed for better gameplay feel

                // Move planets up and down if they have movement (frame-rate independent)
                if (obstacle.type === 'planet' && obstacle.moveSpeed && obstacle.moveSpeed > 0 && obstacle.baseY !== undefined) {
                    obstacle.y += obstacle.moveDirection! * obstacle.moveSpeed * timeMultiplier;

                    // Bounce at boundaries (keep within reasonable limits)
                    if (obstacle.y < obstacle.baseY - 30 || obstacle.y > obstacle.baseY + 30) {
                        obstacle.moveDirection! *= -1;
                    }
                }

                // Score when passing trigger
                if (obstacle.type === 'trigger' &&
                    obstacle.x + obstacle.width < state.ufo.x &&
                    !obstacle.scored) {
                    state.score += 1;
                    obstacle.scored = true;

                    // Score particles
                    const scoreParticles = createParticles(state.ufo.x, state.ufo.y, 4);
                    state.particles.push(...scoreParticles);
                }

                return obstacle.x > -150; // Remove off-screen obstacles
            });

            // Generate new obstacles
            if (state.obstacles.length === 0 ||
                state.obstacles[state.obstacles.length - 1].x < canvas.width - 350) {
                const newObstacles = createObstacles(canvas.width + 100, state.score);
                state.obstacles.push(...newObstacles);
            }

            // Update particles (frame-rate independent)
            state.particles = state.particles.filter(particle => {
                particle.x += particle.vx * timeMultiplier;
                particle.y += particle.vy * timeMultiplier;
                particle.vx *= Math.pow(0.95, timeMultiplier);
                particle.vy *= Math.pow(0.95, timeMultiplier);
                particle.life -= timeMultiplier;
                return particle.life > 0;
            });

            // Check collisions
            if (checkCollisions()) {
                state.gameStatus = 'gameOver';

                // Call onGameEnd immediately
                if (!state.gameEndCalled) {
                    state.gameEndCalled = true;
                    onGameEnd(state.score, state.coins);
                }

                // Explosion particles for visual effect
                const explosionParticles = createParticles(state.ufo.x, state.ufo.y, 15);
                state.particles.push(...explosionParticles);
            }
        }

        // Clear canvas with beautiful space background
        const backgroundGradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
        );
        backgroundGradient.addColorStop(0, '#0B1426');
        backgroundGradient.addColorStop(0.5, '#1E2A4A');
        backgroundGradient.addColorStop(1, '#0A0A0A');

        ctx.fillStyle = backgroundGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Animated starfield (frame-rate independent)
        ctx.globalAlpha = 1;
        for (let i = 0; i < 100; i++) {
            const x = ((i * 150 + currentTime * 0.02) % (canvas.width + 100)) - 50;
            const y = (i * 234) % canvas.height;
            const size = Math.random() * 2;
            const twinkle = 0.4 + Math.sin(currentTime * 0.003 + i) * 0.6;

            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = twinkle;
            ctx.fillRect(x, y, size, size);
        }
        ctx.globalAlpha = 1;

        // Draw planets and coins (not invisible walls)
        state.obstacles.forEach(obstacle => {
            if (obstacle.type === 'planet' && obstacle.planetType) {
                const img = planetImagesRef.current[obstacle.planetType];
                const centerX = obstacle.x + obstacle.width / 2;
                const centerY = obstacle.y + obstacle.height / 2;
                const radius = obstacle.width / 2;

                // Get planet-specific glow color
                const getPlanetGlow = (planetName: string): string => {
                    const planetGlows: { [key: string]: string } = {
                        'Earth.jpg': '#4A90E2', // Blue glow
                        'Mars.jpg': '#FF6B35', // Red-orange glow  
                        'Jupiter.jpg': '#FFB347', // Orange-yellow glow
                        'Saturn.jpg': '#F4D03F', // Golden glow
                        'Venus.jpg': '#FFC300', // Bright yellow glow
                        'Neptune.jpg': '#3498DB', // Deep blue glow
                        'Uranus.jpg': '#85C1E9', // Light blue glow
                        'Mercury.jpg': '#D7DBDD', // Gray-white glow
                    };
                    return planetGlows[planetName] || '#FFFFFF'; // Default white glow
                };

                const glowColor = getPlanetGlow(obstacle.planetType);

                // Planet glow with planet-specific color
                ctx.save();

                // Outer glow effect
                ctx.globalAlpha = 0.6;
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 20;
                const outerGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.3);
                outerGlow.addColorStop(0, `${glowColor}60`);
                outerGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = outerGlow;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;

                // Create circular clip for the planet image
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.clip();

                if (img && img.complete) {
                    // Draw the image within the circular clip
                    ctx.drawImage(img, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                } else {
                    // Fallback gradient circle with planet color
                    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
                    gradient.addColorStop(0, glowColor);
                    gradient.addColorStop(0.7, `${glowColor}80`);
                    gradient.addColorStop(1, `${glowColor}20`);
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }

                ctx.restore();

                // Add planet-specific atmospheric ring
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.strokeStyle = `${glowColor}50`;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Gas giant atmospheric rings
                const isGasGiant = ['Jupiter.jpg', 'Saturn.jpg', 'Uranus.jpg', 'Neptune.jpg'].includes(obstacle.planetType);
                if (isGasGiant) {
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius * 1.1, 0, Math.PI * 2);
                    ctx.strokeStyle = `${glowColor}30`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }

            } else if (obstacle.type === 'coin') {
                // Animated coin (frame-rate independent)
                const time = currentTime * 0.005;
                const scale = 1 + Math.sin(time) * 0.2;

                ctx.save();
                ctx.translate(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
                ctx.scale(scale, scale);

                ctx.fillStyle = '#FFD700';
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 10;

                // Star shape
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
                    const x = Math.cos(angle) * 10;
                    const y = Math.sin(angle) * 10;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);

                    const innerAngle = ((i + 0.5) * Math.PI * 2) / 5 - Math.PI / 2;
                    const innerX = Math.cos(innerAngle) * 5;
                    const innerY = Math.sin(innerAngle) * 5;
                    ctx.lineTo(innerX, innerY);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();
                ctx.shadowBlur = 0;
            }
        });

        // Draw simple UFO emoji
        ctx.save();
        ctx.translate(state.ufo.x + 30, state.ufo.y + 25);
        ctx.rotate(state.ufo.rotation * Math.PI / 180);

        // UFO emoji
        ctx.font = '60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('🛸', 0, 0);

        ctx.restore();

        // Draw particles
        state.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#00BFFF';
            ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
        });
        ctx.globalAlpha = 1;

        // UI (remove environment indicator)
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillStyle = '#00BFFF';
        ctx.shadowColor = '#00BFFF';
        ctx.shadowBlur = 8;
        ctx.fillText(`🛸 Score: ${state.score}`, 20, 50);

        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD700';
        ctx.fillText(`⭐ ${state.coins}`, 20, 80);
        ctx.shadowBlur = 0;        // Game status
        if (state.gameStatus === 'ready') {
            ctx.font = 'bold 32px Arial, sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 8;
            ctx.fillText('TAP TO START', canvas.width / 2, canvas.height / 2);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
        }

        if (state.gameStatus === 'gameOver') {
            // Don't render any game over text - let the parent modal handle it
            // Just continue with normal rendering but frozen state
        }

        setGameState({ ...state });

        // Continue game loop - restart if needed
        if (state.gameStatus !== 'gameOver') {
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        } else {
            // Game is over, but we still need to render one more time to show the final state
            // The parent component will show the modal
        }
    }, [checkCollisions, createObstacles, createParticles, onGameEnd]);

    // Input handlers
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleTouch = (e: TouchEvent) => {
            e.preventDefault();

            // Only handle input if game is not over
            if (gameStateRef.current.gameStatus !== 'gameOver') {
                handleJump();
            }
        };

        const handleClick = (e: MouseEvent) => {
            e.preventDefault();

            // Only handle input if game is not over  
            if (gameStateRef.current.gameStatus !== 'gameOver') {
                handleJump();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                // Only handle input if game is not over
                if (gameStateRef.current.gameStatus !== 'gameOver') {
                    handleJump();
                }
            }
            // Remove Escape key handling - let parent modal handle everything
        };

        canvas.addEventListener('touchstart', handleTouch, { passive: false });
        canvas.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            canvas.removeEventListener('touchstart', handleTouch);
            canvas.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleJump, onGameEnd]);

    // Start game loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', handleResize);

        // Always start a new game loop when this effect runs
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
        }
        gameLoopRef.current = requestAnimationFrame(gameLoop);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        };
    }, [gameLoop, gameMode, continueFromScore]); // Added dependencies to restart loop when game restarts

    return (
        <Page>
            <canvas
                ref={canvasRef}
                className="game-canvas"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: '#0B1426',
                    touchAction: 'none',
                    zIndex: 10
                }}
            />
        </Page>
    );
}