"use client";

import React from 'react';

interface PlanetProps {
    name: string;
    image: string;
    size: number;
}

// Planet-specific glow colors for realistic appearance
const getPlanetGlow = (name: string): string => {
    const planetGlows: { [key: string]: string } = {
        'Earth': '#4A90E2', // Blue glow
        'Mars': '#FF6B35', // Red-orange glow
        'Jupiter': '#FFB347', // Orange-yellow glow
        'Saturn': '#F4D03F', // Golden glow
        'Venus': '#FFC300', // Bright yellow glow
        'Neptune': '#3498DB', // Deep blue glow
        'Uranus': '#85C1E9', // Light blue glow
        'Mercury': '#D7DBDD', // Gray-white glow
    };

    return planetGlows[name] || '#FFFFFF'; // Default white glow
};

export default function Planet({ name, image, size }: PlanetProps) {
    const glowColor = getPlanetGlow(name);

    return (
        <div
            className="planet-container relative"
            style={{ width: `${size}px`, height: `${size}px` }}
        >
            {/* Outer glow effect */}
            <div
                className="absolute inset-0 rounded-full blur-sm opacity-60 animate-pulse"
                style={{
                    background: `radial-gradient(circle, ${glowColor}40 0%, transparent 70%)`,
                    transform: 'scale(1.2)',
                }}
            />

            {/* Main planet sphere */}
            <div
                className="planet-sphere relative rounded-full animate-spin shadow-inner overflow-hidden"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundImage: `url(${image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: `
                        inset -${size * 0.1}px -${size * 0.1}px ${size * 0.2}px rgba(0, 0, 0, 0.8),
                        0 0 ${size * 0.3}px ${glowColor}60
                    `,
                    animationDuration: '20s', // Slow, realistic rotation
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite',
                }}
            >
                {/* Inner highlight for 3D depth effect */}
                <div
                    className="absolute rounded-full opacity-30"
                    style={{
                        width: `${size * 0.4}px`,
                        height: `${size * 0.4}px`,
                        top: `${size * 0.15}px`,
                        left: `${size * 0.15}px`,
                        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, transparent 50%)',
                    }}
                />
            </div>

            {/* Subtle atmospheric ring for gas giants */}
            {(name === 'Jupiter' || name === 'Saturn' || name === 'Uranus' || name === 'Neptune') && (
                <div
                    className="absolute rounded-full border opacity-20 animate-pulse"
                    style={{
                        width: `${size * 1.1}px`,
                        height: `${size * 1.1}px`,
                        top: `${size * -0.05}px`,
                        left: `${size * -0.05}px`,
                        borderColor: glowColor,
                        borderWidth: '1px',
                        animationDuration: '3s',
                    }}
                />
            )}
        </div>
    );
}

// CSS keyframes are handled by Tailwind's animate-spin class
// For custom rotation speed, we override with inline styles
