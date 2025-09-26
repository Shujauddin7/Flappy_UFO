"use client";

import { useGlobalAssetPreloader } from '@/hooks/useGlobalAssetPreloader';
import { useEffect } from 'react';

interface GlobalAssetPreloaderProps {
    children: React.ReactNode;
    showLoadingScreen?: boolean;
}

export function GlobalAssetPreloader({ children, showLoadingScreen = false }: GlobalAssetPreloaderProps) {
    const { isLoading, loadingProgress, allLoaded, errors, startPreloading } = useGlobalAssetPreloader();

    // Start preloading immediately when component mounts
    useEffect(() => {
        startPreloading();
    }, [startPreloading]);

    // If we want to show a loading screen and assets aren't ready
    if (showLoadingScreen && (isLoading || !allLoaded)) {
        return (
            <div
                className="fixed inset-0 flex flex-col items-center justify-center z-50"
                style={{
                    background: 'linear-gradient(135deg, #0B1426 0%, #1a237e 50%, #0B1426 100%)',
                    backdropFilter: 'blur(10px)'
                }}
            >
                <div className="text-center space-y-8 max-w-sm px-6">
                    {/* Game Title */}
                    <div className="space-y-4">
                        <h1 className="text-4xl font-bold text-white mb-2">
                            🛸 Flappy UFO
                        </h1>
                        <p className="text-cyan-300 text-lg font-medium">
                            Loading Space Assets...
                        </p>
                    </div>

                    {/* Circular Progress Indicator */}
                    <div className="flex flex-col items-center">
                        <div className="relative w-36 h-36">
                            {/* Outer glow effect */}
                            <div
                                className="absolute inset-0 rounded-full"
                                style={{
                                    background: 'radial-gradient(circle, rgba(0, 245, 255, 0.1) 0%, transparent 70%)',
                                    filter: 'blur(8px)'
                                }}
                            />

                            <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
                                {/* Background circle */}
                                <path
                                    stroke="rgba(255, 255, 255, 0.1)"
                                    strokeWidth="2.5"
                                    fill="transparent"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                {/* Progress circle with animated gradient */}
                                <path
                                    stroke="url(#globalProgressGradient)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    fill="transparent"
                                    strokeDasharray={`${loadingProgress}, 100`}
                                    style={{
                                        filter: 'drop-shadow(0 0 8px #00f5ff)',
                                        transition: 'stroke-dasharray 0.3s ease-out'
                                    }}
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                {/* Define gradient for progress circle */}
                                <defs>
                                    <linearGradient id="globalProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" style={{ stopColor: '#00f5ff', stopOpacity: 1 }} />
                                        <stop offset="50%" style={{ stopColor: '#9333ea', stopOpacity: 1 }} />
                                        <stop offset="100%" style={{ stopColor: '#ec4899', stopOpacity: 1 }} />
                                    </linearGradient>
                                </defs>
                            </svg>

                            {/* Percentage text in center */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="text-center">
                                    <span className="text-3xl font-bold text-white block mb-1">
                                        {loadingProgress}%
                                    </span>
                                    <span className="text-xs text-cyan-300 uppercase tracking-widest font-medium">
                                        COMPLETE
                                    </span>
                                </div>
                            </div>

                            {/* Pulse animation */}
                            <div
                                className="absolute inset-0 rounded-full border border-cyan-400 opacity-30"
                                style={{
                                    animation: 'pulse 2s infinite',
                                    boxShadow: '0 0 20px rgba(0, 245, 255, 0.3)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Error Messages */}
                    {errors.length > 0 && (
                        <div className="mt-4 p-3 bg-red-900 bg-opacity-30 rounded-lg border border-red-500 border-opacity-30">
                            <p className="text-red-300 text-sm">
                                Some images couldn&apos;t load, but the game will work with fallbacks.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Otherwise render children normally
    return <>{children}</>;
}