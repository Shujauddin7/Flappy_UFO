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

    // Save user to database AND track tournament sign-in when session becomes available
    useEffect(() => {
        if (session?.user?.id && status === 'authenticated') {
            const saveUserAndTrackSignIn = async () => {
                try {
                    const user = session.user as { id: string; username?: string; world_id?: string };

                    // First, save user to database (existing functionality)
                    const userResponse = await fetch('/api/users', {
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

                    if (userResponse.ok) {
                        console.log('✅ User saved to database via API');
                    } else {
                        console.warn('❌ Database save failed:', await userResponse.text());
                    }

                    // Second, track tournament sign-in (NEW: permanent sign-in tracking)
                    try {
                        // Get current tournament ID from current tournament
                        const tournamentResponse = await fetch('/api/tournament/current');
                        if (tournamentResponse.ok) {
                            const tournamentData = await tournamentResponse.json();

                            if (tournamentData.success && tournamentData.tournament?.id) {
                                const signInResponse = await fetch('/api/tournament/sign-in', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        wallet: user.id,
                                        username: user.username || 'Unknown',
                                        worldId: user.world_id || null,
                                        tournamentId: tournamentData.tournament.id
                                    }),
                                });

                                if (signInResponse.ok) {
                                    const signInData = await signInResponse.json();
                                    console.log('✅ Tournament sign-in tracked:', signInData.message);
                                } else {
                                    console.warn('❌ Tournament sign-in tracking failed:', await signInResponse.text());
                                }
                            }
                        }
                    } catch (signInError) {
                        console.warn('❌ Tournament sign-in tracking failed (non-blocking):', signInError);
                    }

                } catch (dbError) {
                    console.warn('❌ User save failed (non-blocking):', dbError);
                }
            };

            // Only save once per session
            const userId = session.user.id;
            if (!sessionStorage.getItem('user_saved_' + userId)) {
                saveUserAndTrackSignIn();
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
