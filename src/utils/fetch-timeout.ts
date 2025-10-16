/**
 * Fetch with Timeout Utility
 * Prevents hanging requests by adding automatic timeout
 */

export class FetchTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FetchTimeoutError';
    }
}

/**
 * Fetch with automatic timeout
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeout - Timeout in milliseconds (default: 10000ms = 10s)
 * @returns Promise<Response>
 * @throws FetchTimeoutError if timeout is reached
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = 10000
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new FetchTimeoutError(`Request timeout after ${timeout}ms: ${url}`);
        }
        throw error;
    }
}
