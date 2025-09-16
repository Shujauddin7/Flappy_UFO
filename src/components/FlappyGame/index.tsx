"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { Page } from '@/components/PageLayout';
import { getCoins } from '@/utils/coins';

interface GameObject {
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'planet' | 'coin' | 'trigger' | 'invisible-wall' | 'asteroid' | 'dust-particle' | 'energy-barrier' | 'asteroid-chunk' | 'nebula-cloud' | 'space-debris' | 'laser-grid';
    planetType?: string;
    barrierType?: 'energy' | 'asteroid-belt' | 'nebula' | 'debris' | 'laser';
    scored?: boolean;
    collected?: boolean; // For preventing duplicate coin collection
    moveSpeed?: number;
    moveDirection?: number;
    baseY?: number;
    // For animated effects
    animationPhase?: number;
    glowIntensity?: number;
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
    gamePatternSeed: number; // Seed for consistent but varied patterns per game
    obstacleCount: number; // Track number of obstacles created
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
        gameEndCalled: false, // Initialize flag
        gamePatternSeed: Math.random() * 1000, // Random seed for each game
        obstacleCount: 0 // Track obstacles created
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
            gameEndCalled: false,
            gamePatternSeed: Math.random() * 1000, // New random seed for each game
            obstacleCount: 0 // Reset obstacle counter
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

    // Create simple space obstacles - with varied patterns per game
    const createObstacles = useCallback((x: number, currentScore: number, obstacleIndex: number, patternSeed: number) => {
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

        // Every 10 points: Create simple invisible pipe with moving planets inside the gap
        const shouldAddInvisiblePipe = currentScore > 0 && currentScore % 10 === 0;

        if (shouldAddInvisiblePipe) {
            // Simple invisible pipe barriers - same gap size as regular pipes
            obstacles.push({
                x: pipeX,
                y: 0,
                width: pipeWidth,
                height: gapY - 5,
                type: 'invisible-wall'
            });

            obstacles.push({
                x: pipeX,
                y: gapY + gapSize + 5,
                width: pipeWidth,
                height: canvasHeight - (gapY + gapSize + 5),
                type: 'invisible-wall'
            });

            // Add 1-2 moving planets INSIDE the gap (passable)
            const movingPlanetCount = 1 + Math.floor(Math.random() * 2); // 1-2 planets
            for (let i = 0; i < movingPlanetCount; i++) {
                const movingPlanet = PLANETS[Math.floor(Math.random() * PLANETS.length)];
                const planetSize = 35 + Math.random() * 15; // 35-50px smaller planets

                obstacles.push({
                    x: pipeX + 20 + (i * 30), // Spread planets across gap
                    y: gapY + 30 + (i * 30), // Position within normal gap
                    width: planetSize,
                    height: planetSize,
                    type: 'planet',
                    planetType: movingPlanet,
                    moveSpeed: 0.3 + Math.random() * 0.4, // Much slower: 0.3-0.7 instead of 1.2-2.0
                    moveDirection: Math.random() > 0.5 ? 1 : -1,
                    baseY: gapY + 30 + (i * 30)
                });
            }
        } else {
            // Normal pipes with varied barrier patterns
            const barrierTypes: ('energy' | 'asteroid-belt' | 'nebula' | 'debris' | 'laser')[] =
                ['energy', 'asteroid-belt', 'nebula', 'debris', 'laser'];
            const selectedBarrierType = barrierTypes[Math.floor((patternSeed + obstacleIndex * 17) % barrierTypes.length)];

            // Calculate planet sizes first to constrain barriers within planet boundaries
            const topPlanetSize = 60 + Math.random() * 20;
            const bottomPlanetSize = 60 + Math.random() * 20;
            const planetCenterX = pipeX + pipeWidth / 2;

            // Calculate the maximum planet boundary for barriers
            const maxPlanetSize = Math.max(topPlanetSize, bottomPlanetSize);
            const planetLeftEdge = planetCenterX - maxPlanetSize / 2;
            const planetRightEdge = planetCenterX + maxPlanetSize / 2;
            const planetBarrierWidth = maxPlanetSize;

            // Create barriers based on selected type - constrained within planet boundaries
            if (selectedBarrierType === 'energy') {
                // Energy barriers - vertical blue energy beams within planet boundary
                for (let i = 0; i < 3; i++) {
                    const beamX = planetLeftEdge + (i * (planetBarrierWidth / 3));
                    obstacles.push({
                        x: beamX,
                        y: 0,
                        width: 6,
                        height: gapY - 5,
                        type: 'energy-barrier',
                        barrierType: 'energy',
                        animationPhase: Math.random() * Math.PI * 2
                    });

                    obstacles.push({
                        x: beamX,
                        y: gapY + gapSize + 5,
                        width: 6,
                        height: canvasHeight - (gapY + gapSize + 5),
                        type: 'energy-barrier',
                        barrierType: 'energy',
                        animationPhase: Math.random() * Math.PI * 2
                    });
                }
            } else if (selectedBarrierType === 'asteroid-belt') {
                // Asteroid belt - scattered small asteroids within planet boundary
                const asteroidCount = Math.floor(planetBarrierWidth / 25);
                for (let i = 0; i < asteroidCount; i++) {
                    const asteroidX = planetLeftEdge + (i * 25) + Math.random() * 10 - 5;

                    // Top asteroid belt
                    for (let j = 0; j < Math.floor((gapY - 5) / 35); j++) {
                        obstacles.push({
                            x: Math.max(planetLeftEdge, Math.min(planetRightEdge - 12, asteroidX + Math.random() * 8 - 4)),
                            y: j * 35 + Math.random() * 8 - 4,
                            width: 12 + Math.random() * 8,
                            height: 12 + Math.random() * 8,
                            type: 'asteroid-chunk',
                            barrierType: 'asteroid-belt',
                            animationPhase: Math.random() * Math.PI * 2
                        });
                    }

                    // Bottom asteroid belt
                    const startY = gapY + gapSize + 5;
                    for (let j = 0; j < Math.floor((canvasHeight - startY) / 35); j++) {
                        obstacles.push({
                            x: Math.max(planetLeftEdge, Math.min(planetRightEdge - 12, asteroidX + Math.random() * 8 - 4)),
                            y: startY + (j * 35) + Math.random() * 8 - 4,
                            width: 12 + Math.random() * 8,
                            height: 12 + Math.random() * 8,
                            type: 'asteroid-chunk',
                            barrierType: 'asteroid-belt',
                            animationPhase: Math.random() * Math.PI * 2
                        });
                    }
                }
            } else if (selectedBarrierType === 'nebula') {
                // Nebula clouds - colorful gas clouds within planet boundary
                const cloudCount = 3 + Math.floor(Math.random() * 2);
                for (let i = 0; i < cloudCount; i++) {
                    const cloudX = planetLeftEdge + (i * (planetBarrierWidth / cloudCount)) + Math.random() * 15 - 7;

                    // Top nebula clouds
                    for (let j = 0; j < Math.floor((gapY - 5) / 40); j++) {
                        obstacles.push({
                            x: Math.max(planetLeftEdge, Math.min(planetRightEdge - 25, cloudX + Math.random() * 20 - 10)),
                            y: j * 40 + Math.random() * 15 - 7,
                            width: 25 + Math.random() * 15,
                            height: 25 + Math.random() * 15,
                            type: 'nebula-cloud',
                            barrierType: 'nebula',
                            animationPhase: Math.random() * Math.PI * 2,
                            glowIntensity: 0.5 + Math.random() * 0.3
                        });
                    }

                    // Bottom nebula clouds
                    const startY = gapY + gapSize + 5;
                    for (let j = 0; j < Math.floor((canvasHeight - startY) / 40); j++) {
                        obstacles.push({
                            x: Math.max(planetLeftEdge, Math.min(planetRightEdge - 25, cloudX + Math.random() * 20 - 10)),
                            y: startY + (j * 40) + Math.random() * 15 - 7,
                            width: 25 + Math.random() * 15,
                            height: 25 + Math.random() * 15,
                            type: 'nebula-cloud',
                            barrierType: 'nebula',
                            animationPhase: Math.random() * Math.PI * 2,
                            glowIntensity: 0.5 + Math.random() * 0.3
                        });
                    }
                }
            } else if (selectedBarrierType === 'debris') {
                // Space debris - satellites and space junk within planet boundary
                const debrisCount = Math.floor(planetBarrierWidth / 30);
                for (let i = 0; i < debrisCount; i++) {
                    const debrisX = planetLeftEdge + (i * 30) + Math.random() * 12 - 6;

                    // Top debris field
                    for (let j = 0; j < Math.floor((gapY - 5) / 45); j++) {
                        obstacles.push({
                            x: Math.max(planetLeftEdge, Math.min(planetRightEdge - 15, debrisX + Math.random() * 10 - 5)),
                            y: j * 45 + Math.random() * 10 - 5,
                            width: 15 + Math.random() * 10,
                            height: 10 + Math.random() * 8,
                            type: 'space-debris',
                            barrierType: 'debris',
                            animationPhase: Math.random() * Math.PI * 2
                        });
                    }

                    // Bottom debris field
                    const startY = gapY + gapSize + 5;
                    for (let j = 0; j < Math.floor((canvasHeight - startY) / 45); j++) {
                        obstacles.push({
                            x: Math.max(planetLeftEdge, Math.min(planetRightEdge - 15, debrisX + Math.random() * 10 - 5)),
                            y: startY + (j * 45) + Math.random() * 10 - 5,
                            width: 15 + Math.random() * 10,
                            height: 10 + Math.random() * 8,
                            type: 'space-debris',
                            barrierType: 'debris',
                            animationPhase: Math.random() * Math.PI * 2
                        });
                    }
                }
            } else if (selectedBarrierType === 'laser') {
                // Laser grid - thin red laser lines within planet boundary
                const laserLines = Math.min(6, Math.floor(planetBarrierWidth / 10)) + Math.floor(Math.random() * 3);
                for (let i = 0; i < laserLines; i++) {
                    const laserX = planetLeftEdge + (i * (planetBarrierWidth / laserLines));

                    // Top laser grid
                    obstacles.push({
                        x: laserX,
                        y: 0,
                        width: 2,
                        height: gapY - 5,
                        type: 'laser-grid',
                        barrierType: 'laser',
                        animationPhase: Math.random() * Math.PI * 2
                    });

                    // Bottom laser grid
                    obstacles.push({
                        x: laserX,
                        y: gapY + gapSize + 5,
                        width: 2,
                        height: canvasHeight - (gapY + gapSize + 5),
                        type: 'laser-grid',
                        barrierType: 'laser',
                        animationPhase: Math.random() * Math.PI * 2
                    });
                }
            }

            // Add planets with barriers
            const topPlanet = PLANETS[Math.floor(Math.random() * PLANETS.length)];
            const bottomPlanet = PLANETS[Math.floor(Math.random() * PLANETS.length)];

            // Top planet
            obstacles.push({
                x: planetCenterX - topPlanetSize / 2,
                y: Math.max(20, gapY - topPlanetSize - 15),
                width: topPlanetSize,
                height: topPlanetSize,
                type: 'planet',
                planetType: topPlanet,
                moveSpeed: Math.random() > 0.8 ? 0.4 + Math.random() * 0.4 : 0,
                moveDirection: Math.random() > 0.5 ? 1 : -1,
                baseY: Math.max(20, gapY - topPlanetSize - 15)
            });

            // Bottom planet
            obstacles.push({
                x: planetCenterX - bottomPlanetSize / 2,
                y: Math.min(canvasHeight - bottomPlanetSize - 20, gapY + gapSize + 15),
                width: bottomPlanetSize,
                height: bottomPlanetSize,
                type: 'planet',
                planetType: bottomPlanet,
                moveSpeed: Math.random() > 0.8 ? 0.4 + Math.random() * 0.4 : 0,
                moveDirection: Math.random() > 0.5 ? 1 : -1,
                baseY: Math.min(canvasHeight - bottomPlanetSize - 20, gapY + gapSize + 15)
            });
        }

        // Add special random objects only after 40 points, at intervals that don't conflict with invisible pipes
        // Invisible pipes: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100...
        // Random objects: 45, 55, 65, 75, 85, 95, 105... (every 10 points starting from 45)
        const shouldAddRandomObject = currentScore >= 45 && (currentScore - 45) % 10 === 0;

        if (shouldAddRandomObject) { // No need to check invisible pipe since they're at different intervals
            // Add 1 special object positioned safely away from main pipe
            const objectType = Math.random() > 0.7 ? 'asteroid' : 'special-planet';

            if (objectType === 'asteroid') {
                const asteroidSize = 35 + Math.random() * 20;
                const asteroidX = pipeX + (Math.random() > 0.5 ? 150 + Math.random() * 50 : -150 - Math.random() * 50);
                const asteroidY = 100 + Math.random() * (canvasHeight - 200);

                obstacles.push({
                    x: asteroidX,
                    y: asteroidY,
                    width: asteroidSize,
                    height: asteroidSize,
                    type: 'asteroid',
                    moveSpeed: 1.0 + Math.random() * 1.0,
                    moveDirection: Math.random() > 0.5 ? 1 : -1,
                    baseY: asteroidY
                });
            } else if (objectType === 'special-planet') {
                // Add a single random planet positioned away from main pipe
                const specialPlanet = PLANETS[Math.floor(Math.random() * PLANETS.length)];
                const planetSize = 45 + Math.random() * 25; // 45-70px size
                const planetX = pipeX + (Math.random() > 0.5 ? 120 + Math.random() * 80 : -120 - Math.random() * 80);
                const planetY = 80 + Math.random() * (canvasHeight - 160);

                obstacles.push({
                    x: planetX,
                    y: planetY,
                    width: planetSize,
                    height: planetSize,
                    type: 'planet',
                    planetType: specialPlanet,
                    moveSpeed: 0.5 + Math.random() * 0.8, // Moderate movement speed
                    moveDirection: Math.random() > 0.5 ? 1 : -1,
                    baseY: planetY
                });
            }
        }

        // Coin in the gap for bonus (sometimes)
        if (Math.random() > 0.3) {
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

    // Create particles for effects - optimized version with better bounds
    const createParticles = useCallback((x: number, y: number, count: number, type: 'jump' | 'score' | 'explosion' | 'coin' = 'jump') => {
        const particles: Particle[] = [];

        // Limit particle count for better performance
        const maxCount = Math.min(count, 12);

        for (let i = 0; i < maxCount; i++) {
            // Reduce particle velocities to keep them more contained, especially for explosions
            let velocityMultiplier = 6;
            if (type === 'explosion') {
                velocityMultiplier = 4; // Reduced from 8 to 4 for better containment
            } else if (type === 'jump') {
                velocityMultiplier = 3; // Reduced for more subtle jump effects
            }

            const particle: Particle = {
                x,
                y,
                vx: (Math.random() - 0.5) * velocityMultiplier,
                vy: (Math.random() - 0.5) * velocityMultiplier,
                life: type === 'explosion' ? 35 : type === 'coin' ? 25 : 30, // Reduced lifespans for better performance
                maxLife: type === 'explosion' ? 35 : type === 'coin' ? 25 : 30,
                size: type === 'coin' ? 3 + Math.random() * 2 : 2 + Math.random() * 3
            };
            particles.push(particle);
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
                4,
                'jump'
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
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];

            if (obstacle.type === 'coin' && !obstacle.collected) {
                // Coin collection (adjusted for larger UFO)
                if (ufo.x + 15 < obstacle.x + obstacle.width &&
                    ufo.x + 45 > obstacle.x &&
                    ufo.y + 15 < obstacle.y + obstacle.height &&
                    ufo.y + 35 > obstacle.y) {

                    // Mark as collected to prevent duplicate collection
                    obstacle.collected = true;

                    // Give 2 coins per collection as per Plan.md (Practice Mode only)
                    gameStateRef.current.coins += 2;

                    // Note: Don't save to localStorage here - will be saved when game ends

                    const coinParticles = createParticles(obstacle.x, obstacle.y, 6, 'coin');
                    gameStateRef.current.particles.push(...coinParticles);

                    // Remove collected coin immediately
                    obstacles.splice(i, 1);
                    continue; // Skip to next obstacle
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
            } else if (obstacle.type === 'asteroid') {
                // Asteroid collision - slightly smaller hitbox than planets
                const distance = Math.sqrt(
                    Math.pow((ufo.x + 30) - (obstacle.x + obstacle.width / 2), 2) +
                    Math.pow((ufo.y + 25) - (obstacle.y + obstacle.height / 2), 2)
                );

                if (distance < (obstacle.width / 2 + 15)) { // Slightly smaller collision radius for asteroids
                    return true; // Collision with asteroid
                }
            } else if (obstacle.type === 'dust-particle') {
                // Dust particle collision - small particles with forgiving hitbox
                if (ufo.x + 25 < obstacle.x + obstacle.width &&
                    ufo.x + 35 > obstacle.x &&
                    ufo.y + 25 < obstacle.y + obstacle.height &&
                    ufo.y + 35 > obstacle.y) {

                    return true; // Collision with dust particle
                }
            } else if (obstacle.type === 'energy-barrier' || obstacle.type === 'laser-grid') {
                // Energy barriers and laser grids - precise collision
                if (ufo.x + 20 < obstacle.x + obstacle.width &&
                    ufo.x + 40 > obstacle.x &&
                    ufo.y + 20 < obstacle.y + obstacle.height &&
                    ufo.y + 40 > obstacle.y) {

                    return true; // Collision with energy/laser barrier
                }
            } else if (obstacle.type === 'asteroid-chunk' || obstacle.type === 'space-debris') {
                // Asteroid chunks and space debris - circular collision
                const distance = Math.sqrt(
                    Math.pow((ufo.x + 30) - (obstacle.x + obstacle.width / 2), 2) +
                    Math.pow((ufo.y + 25) - (obstacle.y + obstacle.height / 2), 2)
                );

                if (distance < (obstacle.width / 2 + 18)) { // Forgiving collision for chunks
                    return true; // Collision with asteroid chunk or debris
                }
            } else if (obstacle.type === 'nebula-cloud') {
                // Nebula clouds - softer collision detection (more forgiving)
                if (ufo.x + 28 < obstacle.x + obstacle.width &&
                    ufo.x + 32 > obstacle.x &&
                    ufo.y + 28 < obstacle.y + obstacle.height &&
                    ufo.y + 32 > obstacle.y) {

                    return true; // Collision with nebula cloud
                }
            } else if (obstacle.type === 'invisible-wall') {
                // Invisible wall collision for moving planet pipes
                if (ufo.x + 20 < obstacle.x + obstacle.width &&
                    ufo.x + 40 > obstacle.x &&
                    ufo.y + 20 < obstacle.y + obstacle.height &&
                    ufo.y + 40 > obstacle.y) {

                    return true; // Collision with invisible boundary
                }
            }
        }

        return false;
    }, [createParticles]);    // Main game loop
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

                // Move planets and asteroids up and down if they have movement (frame-rate independent)
                if ((obstacle.type === 'planet' || obstacle.type === 'asteroid') && obstacle.moveSpeed && obstacle.moveSpeed > 0 && obstacle.baseY !== undefined) {
                    obstacle.y += obstacle.moveDirection! * obstacle.moveSpeed * timeMultiplier;

                    // Bounce at boundaries (keep within reasonable limits)
                    const bounceRange = obstacle.type === 'asteroid' ? 50 : 30; // Asteroids move more
                    if (obstacle.y < obstacle.baseY - bounceRange || obstacle.y > obstacle.baseY + bounceRange) {
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
                    const scoreParticles = createParticles(state.ufo.x, state.ufo.y, 4, 'score');
                    state.particles.push(...scoreParticles);
                }

                return obstacle.x > -150; // Remove off-screen obstacles
            });

            // Generate new obstacles
            if (state.obstacles.length === 0 ||
                state.obstacles[state.obstacles.length - 1].x < canvas.width - 350) {
                const newObstacles = createObstacles(canvas.width + 100, state.score, state.obstacleCount, state.gamePatternSeed);
                state.obstacles.push(...newObstacles);
                state.obstacleCount++; // Increment obstacle counter for pattern variation
            }

            // Update particles (frame-rate independent) with performance optimization
            if (state.particles.length > 0) {
                state.particles = state.particles.filter(particle => {
                    particle.x += particle.vx * timeMultiplier;
                    particle.y += particle.vy * timeMultiplier;
                    particle.vx *= Math.pow(0.96, timeMultiplier); // Slightly improved drag
                    particle.vy *= Math.pow(0.96, timeMultiplier);
                    particle.life -= timeMultiplier;
                    return particle.life > 0;
                });

                // Limit total particles for performance
                if (state.particles.length > 50) {
                    state.particles = state.particles.slice(-50);
                }
            }

            // Check collisions
            if (checkCollisions()) {
                state.gameStatus = 'gameOver';

                // Call onGameEnd immediately
                if (!state.gameEndCalled) {
                    state.gameEndCalled = true;
                    onGameEnd(state.score, state.coins);
                }

                // Explosion particles for visual effect
                const explosionParticles = createParticles(state.ufo.x, state.ufo.y, 12, 'explosion');
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

        // Optimized animated starfield (frame-rate independent with reduced star count)
        ctx.globalAlpha = 1;
        const starCount = 60; // Reduced from 100 for better performance
        for (let i = 0; i < starCount; i++) {
            const x = ((i * 150 + currentTime * 0.015) % (canvas.width + 100)) - 50; // Slightly slower movement
            const y = (i * 234) % canvas.height;
            const size = Math.random() * 1.5 + 0.5; // Slightly smaller stars
            const twinkle = 0.3 + Math.sin(currentTime * 0.002 + i) * 0.7; // Slower twinkling

            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = twinkle;
            ctx.fillRect(x, y, size, size);
        }
        ctx.globalAlpha = 1;

        // Draw planets, asteroids, coins, and dust particles
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

            } else if (obstacle.type === 'asteroid') {
                // Draw asteroid with rocky texture
                const centerX = obstacle.x + obstacle.width / 2;
                const centerY = obstacle.y + obstacle.height / 2;
                const radius = obstacle.width / 2;

                ctx.save();

                // Asteroid glow (orange/red)
                ctx.globalAlpha = 0.4;
                ctx.shadowColor = '#FF6B35';
                ctx.shadowBlur = 15;
                const asteroidGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.2);
                asteroidGlow.addColorStop(0, '#FF6B3560');
                asteroidGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = asteroidGlow;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;

                // Irregular asteroid shape
                ctx.beginPath();
                const sides = 8;
                for (let i = 0; i < sides; i++) {
                    const angle = (i / sides) * Math.PI * 2;
                    const radiusVariation = radius * (0.7 + Math.random() * 0.3); // Irregular shape
                    const x = centerX + Math.cos(angle) * radiusVariation;
                    const y = centerY + Math.sin(angle) * radiusVariation;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();

                // Asteroid gradient
                const asteroidGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
                asteroidGradient.addColorStop(0, '#8B4513');
                asteroidGradient.addColorStop(0.5, '#654321');
                asteroidGradient.addColorStop(1, '#3E2723');
                ctx.fillStyle = asteroidGradient;
                ctx.fill();

                // Add some texture lines
                ctx.strokeStyle = '#2E1A17';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.restore();

            } else if (obstacle.type === 'energy-barrier') {
                // Energy Barrier - glowing vertical energy beam
                const centerX = obstacle.x + obstacle.width / 2;
                const animatedGlow = obstacle.glowIntensity! * (0.7 + Math.sin(currentTime * 0.005 + obstacle.animationPhase!) * 0.3);

                ctx.save();
                ctx.globalAlpha = animatedGlow;

                // Energy beam gradient
                const energyGradient = ctx.createLinearGradient(obstacle.x, 0, obstacle.x + obstacle.width, 0);
                energyGradient.addColorStop(0, 'transparent');
                energyGradient.addColorStop(0.5, '#00BFFF');
                energyGradient.addColorStop(1, 'transparent');

                ctx.fillStyle = energyGradient;
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

                // Add energy particles
                ctx.shadowColor = '#00BFFF';
                ctx.shadowBlur = 15;
                ctx.fillStyle = '#00BFFF';
                ctx.fillRect(centerX - 1, obstacle.y, 2, obstacle.height);

                ctx.restore();

            } else if (obstacle.type === 'asteroid-chunk') {
                // Asteroid Chunk - rocky space debris
                const centerX = obstacle.x + obstacle.width / 2;
                const centerY = obstacle.y + obstacle.height / 2;
                const radius = obstacle.width / 2;

                ctx.save();

                // Rotating asteroid
                ctx.translate(centerX, centerY);
                ctx.rotate(currentTime * 0.001 + obstacle.animationPhase!);

                // Asteroid shape
                ctx.beginPath();
                const sides = 6;
                for (let i = 0; i < sides; i++) {
                    const angle = (i / sides) * Math.PI * 2;
                    const radiusVar = radius * (0.8 + Math.random() * 0.4);
                    const x = Math.cos(angle) * radiusVar;
                    const y = Math.sin(angle) * radiusVar;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();

                // Asteroid gradient
                const asteroidGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
                asteroidGradient.addColorStop(0, '#8B7355');
                asteroidGradient.addColorStop(0.7, '#5D4E37');
                asteroidGradient.addColorStop(1, '#2F1B14');
                ctx.fillStyle = asteroidGradient;
                ctx.fill();

                ctx.strokeStyle = '#3E2723';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.restore();

            } else if (obstacle.type === 'nebula-cloud') {
                // Nebula Cloud - colorful space gas
                const centerX = obstacle.x + obstacle.width / 2;
                const centerY = obstacle.y + obstacle.height / 2;
                const radius = obstacle.width / 2;
                const animatedAlpha = obstacle.glowIntensity! * (0.4 + Math.sin(currentTime * 0.003 + obstacle.animationPhase!) * 0.2);

                ctx.save();
                ctx.globalAlpha = animatedAlpha;

                // Nebula colors (purple, pink, blue)
                const nebulaColors = ['#9333EA', '#EC4899', '#3B82F6'];
                const color = nebulaColors[Math.floor(obstacle.animationPhase! * nebulaColors.length) % nebulaColors.length];

                // Multi-layer nebula effect
                for (let layer = 0; layer < 3; layer++) {
                    const layerRadius = radius * (1 + layer * 0.3);
                    const nebulaGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, layerRadius);
                    nebulaGradient.addColorStop(0, color + '40');
                    nebulaGradient.addColorStop(0.7, color + '20');
                    nebulaGradient.addColorStop(1, 'transparent');

                    ctx.fillStyle = nebulaGradient;
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, layerRadius, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();

            } else if (obstacle.type === 'space-debris') {
                // Space Debris - satellites and space junk
                const centerX = obstacle.x + obstacle.width / 2;
                const centerY = obstacle.y + obstacle.height / 2;

                ctx.save();

                // Rotating debris
                ctx.translate(centerX, centerY);
                ctx.rotate(currentTime * 0.002 + obstacle.animationPhase!);

                // Metallic debris shape
                ctx.fillStyle = '#708090';
                ctx.strokeStyle = '#2F4F4F';
                ctx.lineWidth = 1;

                // Random debris shape
                ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
                ctx.strokeRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);

                // Blinking light
                if (Math.sin(currentTime * 0.01 + obstacle.animationPhase!) > 0.5) {
                    ctx.fillStyle = '#FF0000';
                    ctx.fillRect(-2, -2, 4, 4);
                }

                ctx.restore();

            } else if (obstacle.type === 'laser-grid') {
                // Laser Grid - thin laser lines
                const animatedAlpha = obstacle.glowIntensity! * (0.8 + Math.sin(currentTime * 0.008 + obstacle.animationPhase!) * 0.2);

                ctx.save();
                ctx.globalAlpha = animatedAlpha;
                ctx.shadowColor = '#FF0000';
                ctx.shadowBlur = 8;

                // Red laser beam
                ctx.fillStyle = '#FF0000';
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

                // Laser pulse effect
                const pulse = Math.sin(currentTime * 0.01 + obstacle.animationPhase!);
                if (pulse > 0.7) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(obstacle.x + 0.5, obstacle.y, obstacle.width - 1, obstacle.height);
                }

                ctx.restore();

            } else if (obstacle.type === 'dust-particle') {
                // Optimized space dust particles rendering
                const centerX = obstacle.x + obstacle.width / 2;
                const centerY = obstacle.y + obstacle.height / 2;
                const radius = obstacle.width / 2;

                ctx.save();

                // Dust particle with subtle glow - reduced shadow blur for performance
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = '#87CEEB'; // Sky blue dust

                // Only add glow effect occasionally for performance
                if (Math.random() > 0.7) {
                    ctx.shadowColor = '#87CEEB';
                    ctx.shadowBlur = 2;
                }

                // Small glowing dot
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fill();

                // Add tiny sparkle effect less frequently for performance
                if (Math.random() > 0.98) {
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(centerX - 0.5, centerY - 0.5, 1, 1);
                }

                ctx.restore();
                ctx.shadowBlur = 0;

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

        // Optimized particle rendering with better visual effects
        if (state.particles.length > 0) {
            state.particles.forEach(particle => {
                const alpha = particle.life / particle.maxLife;
                ctx.globalAlpha = alpha * 0.9; // Slightly more transparent

                // Different colors based on particle age for better visual effect
                if (alpha > 0.7) {
                    ctx.fillStyle = '#00BFFF'; // Bright cyan when fresh
                } else if (alpha > 0.4) {
                    ctx.fillStyle = '#87CEEB'; // Sky blue when aging
                } else {
                    ctx.fillStyle = '#4682B4'; // Steel blue when fading
                }

                ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
            });
            ctx.globalAlpha = 1;
        }

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