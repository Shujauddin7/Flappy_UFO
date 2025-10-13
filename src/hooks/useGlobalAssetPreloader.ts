"use client";

import { useEffect, useState, useCallback } from 'react';

// Define all game assets that need to be preloaded (WebP format for 87% smaller files)
export const GAME_ASSETS = {
    planets: [
        '/Earth.webp',
        '/Jupiter.webp',
        '/Mercury.webp',
        '/Neptune.webp',
        '/Saturn.webp',
        '/Uranus.webp',
        '/Venus.webp',
        '/OSIRIS.webp'  // UFO/spaceship image
    ],
    // Add other asset types here if needed in the future
    // sounds: [],
    // ui: []
} as const;

// Global cache to store preloaded assets
class GlobalAssetCache {
    private cache = new Map<string, HTMLImageElement>();
    private loadPromises = new Map<string, Promise<HTMLImageElement>>();
    private preloadStarted = false;

    async preloadAsset(src: string, retries = 3): Promise<HTMLImageElement> {
        // Return cached asset if available
        if (this.cache.has(src)) {
            return this.cache.get(src)!;
        }

        // Return existing promise if already loading
        if (this.loadPromises.has(src)) {
            return this.loadPromises.get(src)!;
        }

        // Create new loading promise
        const loadPromise = this.loadAssetWithRetry(src, retries);
        this.loadPromises.set(src, loadPromise);

        try {
            const image = await loadPromise;
            this.cache.set(src, image);
            return image;
        } catch (error) {
            throw error;
        } finally {
            this.loadPromises.delete(src);
        }
    }

    private async loadAssetWithRetry(src: string, retries: number): Promise<HTMLImageElement> {
        let lastError: Error;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    const timeout = setTimeout(() => {
                        reject(new Error(`Timeout loading ${src}`));
                    }, 10000); // 10 second timeout

                    img.onload = () => {
                        clearTimeout(timeout);
                        resolve(img);
                    };

                    img.onerror = () => {
                        clearTimeout(timeout);
                        reject(new Error(`Failed to load ${src}`));
                    };

                    img.src = src;
                });
            } catch (error) {
                lastError = error as Error;
                if (attempt < retries) {
                    // Wait before retry with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
        }

        throw lastError!;
    }

    async preloadAllAssets(): Promise<void> {
        if (this.preloadStarted) {
            return;
        }

        this.preloadStarted = true;
        const allAssets = [...GAME_ASSETS.planets];

        // Load assets in parallel but handle failures gracefully
        await Promise.allSettled(
            allAssets.map(asset => this.preloadAsset(asset))
        );
    }

    getAsset(src: string): HTMLImageElement | null {
        return this.cache.get(src) || null;
    }

    isAssetLoaded(src: string): boolean {
        return this.cache.has(src);
    }

    getCacheStats() {
        return {
            cachedCount: this.cache.size,
            loadingCount: this.loadPromises.size
        };
    }

    clearCache() {
        this.cache.clear();
        this.loadPromises.clear();
        this.preloadStarted = false;
    }
}

// Global singleton instance
export const globalAssetCache = new GlobalAssetCache();

// Hook to manage global asset preloading
export function useGlobalAssetPreloader() {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [allLoaded, setAllLoaded] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const startPreloading = useCallback(async () => {
        if (allLoaded || isLoading) return;

        setIsLoading(true);
        setErrors([]);

        try {
            const allAssets = [...GAME_ASSETS.planets];
            let loadedCount = 0;

            // Check already cached assets
            const initialLoaded = allAssets.filter(asset =>
                globalAssetCache.isAssetLoaded(asset)
            ).length;

            setLoadingProgress(Math.round((initialLoaded / allAssets.length) * 100));

            if (initialLoaded === allAssets.length) {
                setAllLoaded(true);
                setIsLoading(false);
                return;
            }

            // Load remaining assets with progress tracking
            const loadPromises = allAssets.map(async (asset) => {
                try {
                    if (!globalAssetCache.isAssetLoaded(asset)) {
                        await globalAssetCache.preloadAsset(asset);
                    }
                    loadedCount++;
                    setLoadingProgress(Math.round((loadedCount / allAssets.length) * 100));
                } catch {
                    setErrors(prev => [...prev, asset]);
                    loadedCount++;
                    setLoadingProgress(Math.round((loadedCount / allAssets.length) * 100));
                }
            });

            await Promise.allSettled(loadPromises);
            setAllLoaded(true);

        } catch (error) {
            console.error('Error during global asset preloading:', error);
        } finally {
            setIsLoading(false);
        }
    }, [allLoaded, isLoading]);

    // Auto-start preloading when hook is used
    useEffect(() => {
        startPreloading();
    }, [startPreloading]);

    return {
        isLoading,
        loadingProgress,
        allLoaded,
        errors,
        startPreloading,
        getAsset: (src: string) => globalAssetCache.getAsset(src),
        getCacheStats: () => globalAssetCache.getCacheStats()
    };
}

// Hook specifically for game components that need assets
export function useGameAssets() {
    const globalPreloader = useGlobalAssetPreloader();

    return {
        ...globalPreloader,
        // Helper methods for specific asset types
        getPlanetImage: (planetName: string) => {
            const src = planetName.startsWith('/') ? planetName : `/${planetName}`;
            return globalAssetCache.getAsset(src);
        },
        getUFOImage: () => globalAssetCache.getAsset('/OSIRIS.webp'),
        // Check if critical assets are loaded
        areCriticalAssetsLoaded: () => {
            const criticalAssets = ['/OSIRIS.webp', '/Earth.webp', '/Jupiter.webp'];
            return criticalAssets.every(asset => globalAssetCache.isAssetLoaded(asset));
        }
    };
}