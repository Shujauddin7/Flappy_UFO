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
        const debugKey = process.env.NEXT_PUBLIC_DEBUG_KEY;
        const debugParam = searchParams.get('debug');

        // Check if accessing with the secret debug key
        const hasValidDebugKey = debugKey && debugParam === debugKey;

        // Check if on production environment
        const isProduction = process.env.NEXT_PUBLIC_ENV === 'prod' ||
            (typeof window !== 'undefined' && window.location.hostname === 'flappyufo.vercel.app');

        // Only load Eruda if:
        // 1. Has valid debug key (works on both dev and prod)
        // 2. OR if not in production (dev environment without key)
        if (hasValidDebugKey || !isProduction) {
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
