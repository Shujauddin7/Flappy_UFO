'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

/**
 * Custom hook to handle session persistence in World App environment
 * Addresses the issue where users have to sign in repeatedly when app is reopened
 * Enhanced for dev environment with better logging and recovery
 */
export const useSessionPersistence = () => {
    const { data: session, status } = useSession({
        required: false,
    });
    const [isSessionReady, setIsSessionReady] = useState(false);

    useEffect(() => {
        // Wait for NextAuth to finish loading the session
        if (status !== 'loading') {
            setIsSessionReady(true);

            if (session?.user?.walletAddress) {
                // Additional dev environment debugging
                if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview') {
                    }
            } else {
                }
        } else {
            }
    }, [session, status]);

    return {
        session,
        status,
        isSessionReady,
        isSignedIn: !!session?.user?.walletAddress,
        walletAddress: session?.user?.walletAddress || null,
        username: session?.user?.username || null,
    };
};
