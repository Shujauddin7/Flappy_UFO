'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface ErudaProviderProps {
    children: React.ReactNode;
}

function ErudaLoader() {
    const searchParams = useSearchParams();

    useEffect(() => {
        // Never load in production environment
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod' ||
            (typeof window !== 'undefined' && window.location.hostname === 'flappyufo.vercel.app');

        if (isProduction) {
            return;
        }

        const debugKey = process.env.NEXT_PUBLIC_DEBUG_KEY;
        const debugParam = searchParams.get('debug');

        // Only load Eruda if the debug parameter matches the secret key and not in production
        if (debugKey && debugParam === debugKey) {
            // Check if Eruda is already loaded to avoid duplicate loading
            if (window.eruda) {
                return;
            }

            // Load Eruda script from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/eruda@3/eruda.min.js';
            script.onload = () => {
                // Initialize Eruda after the script loads
                if (window.eruda) {
                    window.eruda.init();
                }
            };
            document.head.appendChild(script);
        }
    }, [searchParams]);

    return null;
}

export function ErudaProvider({ children }: ErudaProviderProps) {
    return (
        <>
            <Suspense fallback={null}>
                <ErudaLoader />
            </Suspense>
            {children}
        </>
    );
}

// Add type declaration for eruda
declare global {
    interface Window {
        eruda?: {
            init: () => void;
        };
    }
}
