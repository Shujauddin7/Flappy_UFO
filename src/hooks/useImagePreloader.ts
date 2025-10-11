"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ImagePreloadResult {
    src: string;
    loaded: boolean;
    error: boolean;
    element?: HTMLImageElement;
}

export interface UseImagePreloaderOptions {
    timeout?: number; // Timeout in milliseconds
    retries?: number; // Number of retry attempts
    priority?: boolean; // Whether to preload immediately
}

export interface UseImagePreloaderReturn {
    images: Record<string, ImagePreloadResult>;
    allLoaded: boolean;
    loadingProgress: number; // 0 to 100
    isLoading: boolean;
    errors: string[];
    preloadImages: (imageSrcs: string[], options?: UseImagePreloaderOptions) => Promise<void>;
    getImage: (src: string) => HTMLImageElement | null;
    clearCache: () => void;
}

// Global image cache to persist across component re-mounts
const globalImageCache = new Map<string, HTMLImageElement>();
const globalImagePromises = new Map<string, Promise<HTMLImageElement>>();

export function useImagePreloader(): UseImagePreloaderReturn {
    const [images, setImages] = useState<Record<string, ImagePreloadResult>>({});
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Calculate derived states
    const safeImages = images || {};
    const imageEntries = Object.entries(safeImages);
    const totalImages = imageEntries.length;
    const loadedImages = imageEntries.filter(([, result]) => result.loaded).length;
    const allLoaded = totalImages > 0 && loadedImages === totalImages;
    const loadingProgress = totalImages > 0 ? Math.round((loadedImages / totalImages) * 100) : 0;
    const errors = imageEntries.filter(([, result]) => result.error).map(([src]) => src);

    // Load a single image with retry logic
    const loadSingleImage = useCallback(
        (src: string, options: UseImagePreloaderOptions = {}): Promise<HTMLImageElement> => {
            const { timeout = 10000, retries = 2 } = options;

            // Check global cache first
            if (globalImageCache.has(src)) {
                return Promise.resolve(globalImageCache.get(src)!);
            }

            // Check if we're already loading this image
            if (globalImagePromises.has(src)) {
                return globalImagePromises.get(src)!;
            }

            const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
                let attempts = 0;

                const attemptLoad = () => {
                    attempts++;
                    const img = new Image();
                    let timeoutId: NodeJS.Timeout | null = null;

                    const cleanup = () => {
                        if (timeoutId) clearTimeout(timeoutId);
                        img.onload = null;
                        img.onerror = null;
                    };

                    const handleSuccess = () => {
                        cleanup();
                        // Cache the successful image
                        globalImageCache.set(src, img);
                        globalImagePromises.delete(src);

                        // Update state
                        setImages(prev => ({
                            ...prev,
                            [src]: { src, loaded: true, error: false, element: img }
                        }));

                        resolve(img);
                    };

                    const handleError = () => {
                        cleanup();

                        if (attempts < retries + 1) {
                            // Retry after a short delay
                            setTimeout(attemptLoad, 1000 * attempts);
                            return;
                        }

                        // All retries failed
                        globalImagePromises.delete(src);
                        setImages(prev => ({
                            ...prev,
                            [src]: { src, loaded: false, error: true }
                        }));

                        reject(new Error(`Failed to load image after ${attempts} attempts: ${src}`));
                    };

                    // Set up timeout
                    timeoutId = setTimeout(() => {
                        handleError();
                    }, timeout);

                    // Set up event listeners
                    img.onload = handleSuccess;
                    img.onerror = handleError;

                    // Start loading
                    img.src = src;
                };

                // Initialize state as loading
                setImages(prev => ({
                    ...prev,
                    [src]: { src, loaded: false, error: false }
                }));

                attemptLoad();
            });

            globalImagePromises.set(src, loadPromise);
            return loadPromise;
        },
        []
    );

    // Preload multiple images with progress tracking
    const preloadImages = useCallback(
        async (imageSrcs: string[], options: UseImagePreloaderOptions = {}) => {
            if (imageSrcs.length === 0) return;

            // Cancel any existing operations
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            setIsLoading(true);

            try {
                // Initialize all images as loading
                const initialState: Record<string, ImagePreloadResult> = {};
                imageSrcs.forEach(src => {
                    // If already cached, mark as loaded
                    if (globalImageCache.has(src)) {
                        initialState[src] = {
                            src,
                            loaded: true,
                            error: false,
                            element: globalImageCache.get(src)
                        };
                    } else {
                        initialState[src] = { src, loaded: false, error: false };
                    }
                });
                setImages(initialState);

                // Filter out already cached images
                const uncachedImages = imageSrcs.filter(src => !globalImageCache.has(src));

                if (uncachedImages.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // Load all uncached images concurrently with individual error handling
                const loadPromises = uncachedImages.map(src =>
                    loadSingleImage(src, options).catch(() => {
                        return null; // Continue with other images even if one fails
                    })
                );

                await Promise.allSettled(loadPromises);
            } catch (error) {
                console.error('Error during image preloading:', error);
            } finally {
                setIsLoading(false);
            }
        },
        [loadSingleImage]
    );

    // Get a cached image
    const getImage = useCallback((src: string): HTMLImageElement | null => {
        return globalImageCache.get(src) || null;
    }, []);

    // Clear the cache
    const clearCache = useCallback(() => {
        globalImageCache.clear();
        globalImagePromises.clear();
        setImages({});
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        images,
        allLoaded,
        loadingProgress,
        isLoading,
        errors,
        preloadImages,
        getImage,
        clearCache,
    };
}

// Predefined planet images for the game
export const PLANET_IMAGES = [
    'Earth.jpg',
    'Jupiter.jpg',
    'Mercury.jpg',
    'Neptune.jpg',
    'Saturn.jpg',
    'Uranus.jpg',
    'Venus.jpg',
] as const;

// Utility hook specifically for game images
export function useGameImagePreloader() {
    const preloader = useImagePreloader();

    // Preload all planet images on mount
    useEffect(() => {
        const planetSrcs = PLANET_IMAGES.map(img => `/${img}`);
        preloader.preloadImages(planetSrcs, {
            timeout: 15000, // Longer timeout for slow connections
            retries: 3, // More retries for better reliability
            priority: true
        });
    }, [preloader]);

    return {
        ...preloader,
        // Helper method to get planet image
        getPlanetImage: (planetName: string) => {
            const src = `/${planetName}`;
            return preloader.getImage(src);
        }
    };
}