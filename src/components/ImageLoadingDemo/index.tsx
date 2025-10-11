"use client";

import React from 'react';
import { useGameImagePreloader } from '@/hooks/useImagePreloader';
import PlanetImage from '@/components/PlanetImage';
import { imageCacheService } from '@/services/imageCache';

export default function ImageLoadingDemo() {
    const imagePreloader = useGameImagePreloader();
    const [cacheStats, setCacheStats] = React.useState({ memoryCount: 0 });

    // Update cache stats periodically
    React.useEffect(() => {
        const updateStats = () => {
            setCacheStats(imageCacheService.getCacheStats());
        };

        updateStats();
        const interval = setInterval(updateStats, 1000);
        return () => clearInterval(interval);
    }, []);

    const clearCache = () => {
        imageCacheService.clearCache();
        setCacheStats({ memoryCount: 0 });
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900 p-6">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-white">
                        🛸 Flappy UFO - Image Loading Demo
                    </h1>
                    <p className="text-cyan-300 text-lg">
                        Demonstrating optimized image loading with fallbacks
                    </p>
                </div>

                {/* Loading Status */}
                <div className="bg-slate-800 rounded-lg p-6 space-y-4">
                    <h2 className="text-2xl font-semibold text-white mb-4">Loading Status</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-700 rounded p-4 text-center">
                            <div className="text-2xl font-bold text-cyan-400">
                                {imagePreloader.loadingProgress}%
                            </div>
                            <div className="text-sm text-gray-300">Progress</div>
                        </div>

                        <div className="bg-slate-700 rounded p-4 text-center">
                            <div className="text-2xl font-bold text-green-400">
                                {imagePreloader.images ? Object.keys(imagePreloader.images).length : 0}
                            </div>
                            <div className="text-sm text-gray-300">Total Images</div>
                        </div>

                        <div className="bg-slate-700 rounded p-4 text-center">
                            <div className="text-2xl font-bold text-red-400">
                                {imagePreloader.errors.length}
                            </div>
                            <div className="text-sm text-gray-300">Failed Images</div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500 relative"
                            style={{ width: `${imagePreloader.loadingProgress}%` }}
                        >
                            <div className="absolute inset-0 bg-white opacity-30 animate-pulse" />
                        </div>
                    </div>

                    {/* Loading/Ready Status */}
                    <div className="text-center">
                        {imagePreloader.isLoading ? (
                            <div className="text-yellow-400 font-semibold">⏳ Loading images...</div>
                        ) : imagePreloader.allLoaded ? (
                            <div className="text-green-400 font-semibold">✅ All images loaded!</div>
                        ) : (
                            <div className="text-blue-400 font-semibold">🎮 Ready to play with fallbacks!</div>
                        )}
                    </div>

                    {/* Error Messages */}
                    {imagePreloader.errors.length > 0 && (
                        <div className="mt-4 p-3 bg-red-900 bg-opacity-50 rounded-lg">
                            <p className="text-red-300 font-semibold mb-2">Failed Images:</p>
                            <ul className="text-red-200 text-sm space-y-1">
                                {imagePreloader.errors.map((error, index) => (
                                    <li key={index} className="truncate">• {error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Cache Statistics */}
                <div className="bg-slate-800 rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold text-white">Cache Statistics</h2>
                        <button
                            onClick={clearCache}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                            Clear Cache
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-700 rounded p-4">
                            <div className="text-lg font-semibold text-cyan-400">
                                {cacheStats.memoryCount} images
                            </div>
                            <div className="text-sm text-gray-300">In Memory Cache</div>
                        </div>

                        <div className="bg-slate-700 rounded p-4">
                            <div className="text-lg font-semibold text-purple-400">
                                {imagePreloader.allLoaded ? 'Optimal' : 'Loading'}
                            </div>
                            <div className="text-sm text-gray-300">Performance Status</div>
                        </div>
                    </div>
                </div>

                {/* Planet Gallery */}
                <div className="bg-slate-800 rounded-lg p-6">
                    <h2 className="text-2xl font-semibold text-white mb-6">Planet Gallery</h2>
                    <p className="text-gray-300 mb-6">
                        Each planet shows optimized Next.js Image with intelligent fallbacks.
                        If images fail to load, you&apos;ll see beautiful CSS gradient fallbacks.
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
                        {[
                            { name: 'Earth', file: 'Earth.webp' },
                            { name: 'Mars', file: 'Mars.webp' },
                            { name: 'Jupiter', file: 'Jupiter.webp' },
                            { name: 'Saturn', file: 'Saturn.webp' },
                            { name: 'Venus', file: 'Venus.webp' },
                            { name: 'Neptune', file: 'Neptune.webp' },
                            { name: 'Uranus', file: 'Uranus.webp' },
                        ].map((planet) => (
                            <div key={planet.name} className="text-center space-y-2">
                                <PlanetImage
                                    name={planet.name}
                                    src={`/${planet.file}`}
                                    size={100}
                                    priority={true}
                                />
                                <div className="text-sm text-gray-300">{planet.name}</div>
                                <div className="text-xs text-gray-500">
                                    {imagePreloader.getImage(`/${planet.file}`) ? '✅ Loaded' : '⏳ Loading'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Test Controls */}
                <div className="bg-slate-800 rounded-lg p-6">
                    <h2 className="text-2xl font-semibold text-white mb-4">Test Controls</h2>
                    <p className="text-gray-300 mb-6">
                        Test different network conditions and see how the system handles failures gracefully.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            🔄 Reload Page (Test Fresh Load)
                        </button>

                        <button
                            onClick={() => {
                                // Simulate slow network by adding delay
                                alert('In development mode, you can simulate slow network using Chrome DevTools > Network > Slow 3G');
                            }}
                            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                        >
                            🐌 Simulate Slow Network
                        </button>
                    </div>
                </div>

                {/* Implementation Details */}
                <div className="bg-slate-800 rounded-lg p-6">
                    <h2 className="text-2xl font-semibold text-white mb-4">How It Works</h2>
                    <div className="space-y-4 text-gray-300">
                        <div className="p-4 bg-slate-700 rounded-lg">
                            <h3 className="font-semibold text-cyan-400 mb-2">🎯 Smart Preloading</h3>
                            <p>Images are preloaded with retry logic, timeout protection, and progress tracking.</p>
                        </div>

                        <div className="p-4 bg-slate-700 rounded-lg">
                            <h3 className="font-semibold text-green-400 mb-2">🛡️ Fallback System</h3>
                            <p>If images fail, beautiful CSS gradients matching each planet&apos;s theme are shown.</p>
                        </div>

                        <div className="p-4 bg-slate-700 rounded-lg">
                            <h3 className="font-semibold text-purple-400 mb-2">⚡ Next.js Optimization</h3>
                            <p>Images are automatically optimized, compressed, and served in modern formats.</p>
                        </div>

                        <div className="p-4 bg-slate-700 rounded-lg">
                            <h3 className="font-semibold text-yellow-400 mb-2">💾 Memory Caching</h3>
                            <p>Successfully loaded images are cached in memory for instant subsequent access.</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}