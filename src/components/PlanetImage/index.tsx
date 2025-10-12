"use client";

import React, { useState, memo } from 'react';
import Image from 'next/image';

interface PlanetImageProps {
    name: string;
    src: string;
    size: number;
    className?: string;
    priority?: boolean;
    onLoad?: () => void;
    onError?: () => void;
}

// Planet-specific fallback colors and gradients
const getPlanetFallback = (name: string): string => {
    const planetFallbacks: { [key: string]: string } = {
        'Earth': 'linear-gradient(135deg, #4A90E2 0%, #2E7D32 50%, #1565C0 100%)', // Blue to green to deep blue
        'Mars': 'linear-gradient(135deg, #FF6B35 0%, #E53935 50%, #C62828 100%)', // Orange to red
        'Jupiter': 'linear-gradient(135deg, #FFB347 0%, #FF8F00 50%, #E65100 100%)', // Yellow-orange bands
        'Saturn': 'linear-gradient(135deg, #F4D03F 0%, #FFB300 50%, #FF8F00 100%)', // Golden bands
        'Venus': 'linear-gradient(135deg, #FFC300 0%, #FFB300 50%, #FF8F00 100%)', // Bright yellow to orange
        'Neptune': 'linear-gradient(135deg, #3498DB 0%, #1976D2 50%, #0D47A1 100%)', // Deep blue gradient
        'Uranus': 'linear-gradient(135deg, #85C1E9 0%, #42A5F5 50%, #1976D2 100%)', // Light to medium blue
        'Mercury': 'linear-gradient(135deg, #D7DBDD 0%, #95A5A6 50%, #5D6D7E 100%)', // Gray gradient
    };

    return planetFallbacks[name] || 'linear-gradient(135deg, #6C7B7F 0%, #4A5568 100%)'; // Default gray
};

// Planet-specific glow colors
const getPlanetGlow = (name: string): string => {
    const planetGlows: { [key: string]: string } = {
        'Earth': '#4A90E2',
        'Mars': '#FF6B35',
        'Jupiter': '#FFB347',
        'Saturn': '#F4D03F',
        'Venus': '#FFC300',
        'Neptune': '#3498DB',
        'Uranus': '#85C1E9',
        'Mercury': '#D7DBDD',
    };

    return planetGlows[name] || '#FFFFFF';
};

const PlanetImage = memo(({
    name,
    src,
    size,
    className = '',
    priority = false,
    onLoad,
    onError
}: PlanetImageProps) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const glowColor = getPlanetGlow(name);
    const fallbackGradient = getPlanetFallback(name);

    const handleImageLoad = () => {
        setImageLoaded(true);
        onLoad?.();
    };

    const handleImageError = () => {
        setImageError(true);
        onError?.();
    };

    return (
        <div
            className={`planet-image-container relative ${className}`}
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

            {/* Main planet container */}
            <div
                className="relative rounded-full overflow-hidden animate-spin shadow-inner"
                style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    animationDuration: '20s',
                    animationTimingFunction: 'linear',
                    animationIterationCount: 'infinite',
                    boxShadow: `
            inset -${size * 0.1}px -${size * 0.1}px ${size * 0.2}px rgba(0, 0, 0, 0.8),
            0 0 ${size * 0.3}px ${glowColor}60
          `,
                }}
            >
                {/* Fallback background (always present) */}
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background: fallbackGradient,
                        opacity: imageError || !imageLoaded ? 1 : 0,
                        transition: 'opacity 0.3s ease-in-out'
                    }}
                />

                {/* Planet texture pattern overlay for fallback */}
                {(imageError || !imageLoaded) && (
                    <div
                        className="absolute inset-0 rounded-full opacity-20"
                        style={{
                            background: `
                radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 40%),
                radial-gradient(ellipse at 70% 60%, rgba(0,0,0,0.2) 0%, transparent 30%),
                radial-gradient(ellipse at 40% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)
              `,
                        }}
                    />
                )}

                {/* Next.js optimized image */}
                {!imageError && (
                    <Image
                        src={src}
                        alt={`${name} planet`}
                        width={size}
                        height={size}
                        priority={priority}
                        quality={90}
                        className="rounded-full"
                        style={{
                            objectFit: 'cover',
                            objectPosition: 'center',
                            opacity: imageLoaded ? 1 : 0,
                            transition: 'opacity 0.3s ease-in-out'
                        }}
                        onLoad={handleImageLoad}
                        onError={handleImageError}
                        sizes={`${size}px`}
                        placeholder="empty"
                    />
                )}

                {/* Inner highlight for 3D depth effect */}
                <div
                    className="absolute rounded-full opacity-30 pointer-events-none"
                    style={{
                        width: `${size * 0.4}px`,
                        height: `${size * 0.4}px`,
                        top: `${size * 0.15}px`,
                        left: `${size * 0.15}px`,
                        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, transparent 50%)',
                    }}
                />
            </div>

            {/* Atmospheric ring for gas giants */}
            {(name === 'Jupiter' || name === 'Saturn' || name === 'Uranus' || name === 'Neptune') && (
                <div
                    className="absolute rounded-full border opacity-20 animate-pulse pointer-events-none"
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

            {/* Loading indicator */}
            {!imageLoaded && !imageError && (
                <div
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black bg-opacity-20"
                >
                    <div
                        className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"
                        style={{ borderTopColor: 'transparent' }}
                    />
                </div>
            )}
        </div>
    );
});

PlanetImage.displayName = 'PlanetImage';

export default PlanetImage;
