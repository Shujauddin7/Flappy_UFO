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

        // 🔒 CRITICAL: Prevent duplicate authentication attempts
        if (isAuthenticating) {
            console.log('⏳ Authentication already in progress, waiting...');
            return false;
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
    }, [isInstalled, isAuthenticated, isAuthenticating, update]);

    // Removed auto-update to prevent infinite loop

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

                    if (!userResponse.ok) {
                        // User creation failed
                    }

                    // Second, track tournament sign-in (NEW: permanent sign-in tracking)
                    try {
                        // Get current tournament ID from current tournament
                        const tournamentResponse = await fetch('/api/tournament/current');
                        if (tournamentResponse.ok) {
                            const tournamentData = await tournamentResponse.json();
                            if (tournamentData.tournament?.id) {
                                const signInPayload = {
                                    wallet: user.id,
                                    username: user.username || 'Unknown',
                                    worldId: user.world_id || null,
                                    tournamentId: tournamentData.tournament.id
                                };
                                await fetch('/api/tournament/sign-in', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify(signInPayload),
                                });
                            }
                        }
                    } catch {
                        // Intentionally ignore sign-in errors
                    }

                } catch {
                    // Intentionally ignore user creation errors
                }
            };

            // ALWAYS track tournament sign-in for debugging - remove sessionStorage blocking
            saveUserAndTrackSignIn();
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
