'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { walletAuth } from '@/auth/wallet';

export const useGameAuth = () => {
    const { data: session, status, update } = useSession();
    const { isInstalled } = useMiniKit();
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    const isAuthenticated = status === 'authenticated' && !!session;
    const isLoading = status === 'loading' || isAuthenticating;

    const authenticate = useCallback(async (): Promise<boolean> => {
        if (!isInstalled) {
            console.error('MiniKit not installed');
            return false;
        }

        if (isAuthenticated) {
            return true;
        }

        setIsAuthenticating(true);
        try {
            const result = await walletAuth();

            // Check if sign in was successful
            if (result && !result.error) {
                // Trigger session update to get the new session
                await update();
                setIsAuthenticating(false);
                return true;
            } else {
                // Authentication failed
                console.error('Sign in failed:', result?.error);
                setIsAuthenticating(false);
                return false;
            }
        } catch (error) {
            console.error('Authentication failed:', error);
            setIsAuthenticating(false);
            return false;
        }
    }, [isInstalled, isAuthenticated, update]);

    // Auto-update session status after authentication
    useEffect(() => {
        if (status === 'unauthenticated' && !isAuthenticating) {
            update();
        }
    }, [status, isAuthenticating, update]);

    // Save user to database when session becomes available
    useEffect(() => {
        if (session?.user?.id && status === 'authenticated') {
            const saveUser = async () => {
                try {
                    const user = session.user as {id: string; username?: string; world_id?: string};
                    const response = await fetch('/api/users', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            wallet: user.id,
                            username: user.username || null,
                            world_id: user.world_id || null,
                        }),
                    });
                    
                    if (response.ok) {
                        console.log('✅ User saved to database via API');
                    } else {
                        console.warn('❌ Database save failed:', await response.text());
                    }
                } catch (dbError) {
                    console.warn('❌ Database save failed (non-blocking):', dbError);
                }
            };
            
            // Only save once per session
            const userId = session.user.id;
            if (!sessionStorage.getItem('user_saved_' + userId)) {
                saveUser();
                sessionStorage.setItem('user_saved_' + userId, 'true');
            }
        }
    }, [session, status]);

    return {
        isAuthenticated,
        isLoading,
        isAuthenticating,
        authenticate,
        session,
        user: session?.user,
    };
};
