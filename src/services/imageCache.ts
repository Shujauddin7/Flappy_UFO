"use client";

// Simple Image Cache Service for memory caching
export class ImageCacheService {
    private memoryCache = new Map<string, HTMLImageElement>();

    /**
     * Preload an image and cache it in memory
     */
    async preloadImage(url: string): Promise<HTMLImageElement> {
        // Check memory cache first
        if (this.memoryCache.has(url)) {
            return this.memoryCache.get(url)!;
        }

        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                this.memoryCache.set(url, img);
                resolve(img);
            };

            img.onerror = () => {
                reject(new Error(`Failed to load image: ${url}`));
            };

            img.src = url;
        });
    }

    /**
     * Preload multiple images
     */
    async preloadImages(urls: string[]): Promise<HTMLImageElement[]> {
        const promises = urls.map((url) =>
            this.preloadImage(url).catch(() => {
                return null;
            })
        );

        const results = await Promise.allSettled(promises);
        return results
            .map((result) => (result.status === 'fulfilled' ? result.value : null))
            .filter((img): img is HTMLImageElement => img !== null);
    }

    /**
     * Get cached image from memory
     */
    getImage(url: string): HTMLImageElement | null {
        return this.memoryCache.get(url) || null;
    }

    /**
     * Clear memory cache
     */
    clearCache(): void {
        this.memoryCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { memoryCount: number } {
        return { memoryCount: this.memoryCache.size };
    }
}

// Export singleton instance
export const imageCacheService = new ImageCacheService();